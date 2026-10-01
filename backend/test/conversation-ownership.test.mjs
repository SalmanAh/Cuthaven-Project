import assert from "node:assert/strict";
import test from "node:test";
import {
  ConversationAccessError,
  hashGuestConversationToken,
  resolveConversationOwner,
  safeTokenHashEquals,
} from "../dist/services/conversationAccess.service.js";

const accountConversation = {
  id: "conversation-a",
  customerId: "customer-a",
  guestTokenHash: null,
};

function dependencies(overrides = {}) {
  return {
    findCustomerIdByAuthId: async (authId) =>
      authId === "auth-a" ? "customer-a" : null,
    findByCustomerId: async (customerId) =>
      customerId === "customer-a" ? accountConversation : null,
    findByGuestTokenHash: async () => null,
    ...overrides,
  };
}

async function rejectsWithAccess(promise, status) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ConversationAccessError);
    assert.equal(error.status, status);
    return true;
  });
}

test("account ownership is derived only from the verified auth ID", async () => {
  const owner = await resolveConversationOwner(
    { authId: "auth-a", role: "customer", guestToken: "ignored-guest-token" },
    dependencies(),
  );
  assert.deepEqual(owner, accountConversation);
});

test("another account and a non-customer role cannot access the conversation", async () => {
  await rejectsWithAccess(
    resolveConversationOwner(
      { authId: "auth-b", role: "customer" },
      dependencies(),
    ),
    403,
  );
  await rejectsWithAccess(
    resolveConversationOwner(
      { authId: "auth-a", role: "admin" },
      dependencies(),
    ),
    403,
  );
});

test("a guest email or missing token is never ownership proof", async () => {
  await rejectsWithAccess(resolveConversationOwner({}, dependencies()), 401);
});

test("only the correct opaque guest token resolves its conversation", async () => {
  const rawToken = "guest-secret-token";
  const tokenHash = hashGuestConversationToken(rawToken);
  const guestConversation = {
    id: "conversation-g",
    customerId: null,
    guestTokenHash: tokenHash,
  };
  const deps = dependencies({
    findByGuestTokenHash: async (candidate) =>
      candidate === tokenHash ? guestConversation : null,
  });

  assert.deepEqual(
    await resolveConversationOwner({ guestToken: rawToken }, deps),
    guestConversation,
  );
  await rejectsWithAccess(
    resolveConversationOwner({ guestToken: "wrong-token" }, deps),
    403,
  );
  assert.notEqual(tokenHash, rawToken);
  assert.equal(safeTokenHashEquals(rawToken, tokenHash), true);
  assert.equal(safeTokenHashEquals("wrong-token", tokenHash), false);
});

test("expired or revoked guest records are rejected by an absent repository result", async () => {
  await rejectsWithAccess(
    resolveConversationOwner(
      { guestToken: "expired-or-revoked-token" },
      dependencies({ findByGuestTokenHash: async () => null }),
    ),
    403,
  );
});
