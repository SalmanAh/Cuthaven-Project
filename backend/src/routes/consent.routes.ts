import { Router } from "express";
import { logConsent } from "../controllers/consent.controller.js";

export const consentRouter = Router();

// Public — no auth required
consentRouter.post("/", logConsent);
