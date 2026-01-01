import { Router, Request, Response } from "express";
import { registerPatient, loginPatient, loginClinician } from "../services/auth.service.js";
import { patientRegisterSchema, loginSchema } from "../lib/validation.js";

const router = Router();

router.post("/patient/register", async (req: Request, res: Response) => {
  try {
    const parsed = patientRegisterSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const result = await registerPatient(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

router.post("/patient/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const result = await loginPatient(parsed.data);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/clinician/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const result = await loginClinician(parsed.data);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

export default router;
