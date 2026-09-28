import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import Stripe from "stripe";

process.env.NODE_ENV = "test";
process.env.FRONTEND_ORIGIN = "http://localhost:8080";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const { createApp } = await import("../dist/app.js");

const webhookSecret = "whsec_local_regression_test";
const stripe = new Stripe("sk_test_local_regression_test");
const observedWebhookBodies = [];
let acceptedEventCount = 0;
const testApiRouter = express.Router();

testApiRouter.post("/echo", (req, res) => {
  res.json({ body: req.body, isBuffer: Buffer.isBuffer(req.body) });
});

const app = createApp({
  webhookHandler: (req, res) => {
    observedWebhookBodies.push(req.body);
    const signature = req.headers["stripe-signature"];

    if (!Buffer.isBuffer(req.body) || typeof signature !== "string") {
      return res.status(400).json({ error: "Invalid webhook request" });
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
      acceptedEventCount += 1;
      return res.json({ id: event.id, type: event.type });
    } catch {
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }
  },
  mountedApiRouter: testApiRouter,
});

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const payload = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_test" } },
});

function signatureFor(body, secret = webhookSecret) {
  return stripe.webhooks.generateTestHeaderString({ payload: body, secret });
}

test("valid Stripe signature over exact raw bytes returns 200", async () => {
  const signature = signatureFor(payload);

  const response = await fetch(`${baseUrl}/api/checkout/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: "evt_test",
    type: "payment_intent.succeeded",
  });
  assert.equal(observedWebhookBodies.length, 1);
  assert(Buffer.isBuffer(observedWebhookBodies[0]));
  assert.equal(observedWebhookBodies[0].toString("utf8"), payload);
  assert.equal(acceptedEventCount, 1);
});

test("altered payload fails the signature and causes no accepted event", async () => {
  const alteredPayload = payload.replace("pi_test", "pi_tampered");
  const response = await fetch(`${baseUrl}/api/checkout/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signatureFor(payload),
    },
    body: alteredPayload,
  });

  assert.equal(response.status, 400);
  assert.equal(acceptedEventCount, 1);
});

test("missing signature returns 400 and causes no accepted event", async () => {
  const response = await fetch(`${baseUrl}/api/checkout/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });

  assert.equal(response.status, 400);
  assert.equal(acceptedEventCount, 1);
});

test("signature generated with the wrong secret returns 400", async () => {
  const response = await fetch(`${baseUrl}/api/checkout/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signatureFor(payload, "whsec_wrong_secret"),
    },
    body: payload,
  });

  assert.equal(response.status, 400);
  assert.equal(acceptedEventCount, 1);
});

test("ordinary API JSON endpoints still receive parsed objects", async () => {
  const payload = { productId: "test-product", quantity: 2 };

  const response = await fetch(`${baseUrl}/api/echo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { body: payload, isBuffer: false });
});

test("webhook raw parser rejects a non-JSON content type", async () => {
  const response = await fetch(`${baseUrl}/api/checkout/webhook`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not-json",
  });

  assert.equal(response.status, 400);
  assert.equal(acceptedEventCount, 1);
});

test("oversized webhook payload is rejected before verification", async () => {
  const oversizedPayload = JSON.stringify({ data: "x".repeat(1024 * 1024) });
  const response = await fetch(`${baseUrl}/api/checkout/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signatureFor(oversizedPayload),
    },
    body: oversizedPayload,
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "Request payload too large" });
  assert.equal(acceptedEventCount, 1);
});
