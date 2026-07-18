import { Router } from "express";
import { submitContact } from "../controllers/contact.controller.js";

export const contactRouter = Router();

// Public — no auth required
contactRouter.post("/", submitContact);
