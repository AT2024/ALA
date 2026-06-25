import express, { Request, Response } from "express";
import TreatmentPdf from "../models/TreatmentPdf";
import logger from "../utils/logger";

// Development-only routes. Mounted at /api/dev. Every handler 404s unless
// NODE_ENV === "development", mirroring the debug-sites gate in authController.
// These exist so a developer can view the finalized PDF locally (no email is
// sent in dev). They are inert in production.
const router = express.Router();

router.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
});

// Stream a stored treatment PDF inline so the browser renders it.
async function streamPdf(
  res: Response,
  pdf: InstanceType<typeof TreatmentPdf> | null,
) {
  if (!pdf) {
    res.status(404).json({ error: "No treatment PDF found" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="Treatment_Report_${pdf.treatmentId}.pdf"`,
  );
  res.send(pdf.pdfData);
}

// GET /api/dev/pdf/latest — newest finalized PDF.
router.get("/pdf/latest", async (_req: Request, res: Response) => {
  const pdf = await TreatmentPdf.findOne({ order: [["createdAt", "DESC"]] });
  logger.info(
    `[DEV] Serving latest treatment PDF: ${pdf?.treatmentId ?? "none"}`,
  );
  await streamPdf(res, pdf);
});

// GET /api/dev/pdf/:treatmentId — a specific treatment's PDF.
router.get("/pdf/:treatmentId", async (req: Request, res: Response) => {
  const pdf = await TreatmentPdf.findOne({
    where: { treatmentId: req.params.treatmentId },
  });
  await streamPdf(res, pdf);
});

export default router;
