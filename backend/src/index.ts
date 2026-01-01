import "dotenv/config";
import express from "express";
import { config } from "./lib/config.js";
import authRoutes from "./routes/auth.routes.js";
import clinicianRoutes from "./routes/clinician.routes.js";
import patientRoutes from "./routes/patient.routes.js";

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/auth", authRoutes);
app.use("/clinician", clinicianRoutes);
app.use("/patient", patientRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
