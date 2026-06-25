/**
 * The dev PDF route exists so a developer can view a finalized treatment PDF
 * locally (no email is sent in dev). It MUST be inert in production. These tests
 * pin both halves: it streams the stored PDF in development, and 404s in prod.
 */
import express from "express";
import request from "supertest";

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const findOne = jest.fn();
jest.mock("../../../src/models/TreatmentPdf", () => ({
  __esModule: true,
  default: { findOne: (...args: unknown[]) => findOne(...args) },
}));

function appWithDevRoutes() {
  // Re-require under the current NODE_ENV so the router's gate sees it.
  jest.isolateModules(() => {});
  const devRoutes = require("../../../src/routes/devRoutes").default;
  const app = express();
  app.use("/api/dev", devRoutes);
  return app;
}

describe("devRoutes — GET /api/dev/pdf/latest", () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it("streams the newest PDF as application/pdf in development", async () => {
    process.env.NODE_ENV = "development";
    findOne.mockResolvedValue({
      treatmentId: "T-123",
      pdfData: Buffer.from("%PDF-1.4 fake"),
    });

    const res = await request(appWithDevRoutes()).get("/api/dev/pdf/latest");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(findOne).toHaveBeenCalledWith({ order: [["createdAt", "DESC"]] });
  });

  it("404s when no PDF exists (development)", async () => {
    process.env.NODE_ENV = "development";
    findOne.mockResolvedValue(null);

    const res = await request(appWithDevRoutes()).get("/api/dev/pdf/latest");

    expect(res.status).toBe(404);
  });

  it("404s in production without touching the database", async () => {
    process.env.NODE_ENV = "production";
    findOne.mockResolvedValue({
      treatmentId: "T-1",
      pdfData: Buffer.from("x"),
    });

    const res = await request(appWithDevRoutes()).get("/api/dev/pdf/latest");

    expect(res.status).toBe(404);
    expect(findOne).not.toHaveBeenCalled();
  });
});
