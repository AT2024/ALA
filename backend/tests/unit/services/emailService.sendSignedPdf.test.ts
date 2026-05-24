// sendSignedPdf must report an HONEST delivery status so the treatment audit
// trail cannot record a suppressed/skipped email as "sent".
import { describe, test, expect, jest } from "@jest/globals";

jest.mock("../../../src/config/appConfig", () => ({
  config: {
    emailConnectionString: "",
    emailSenderAddress: "sender@x.com",
    pdfRecipientEmail: "records@x.com",
    testUserEmail: "test@example.com",
    pdfAdditionalRecipients: [],
    emailMaxRetries: 1,
    emailRetryDelayMs: 1,
  },
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { sendSignedPdf } from "../../../src/services/emailService";

const sig = {
  type: "alphatau_verified" as const,
  signerName: "Dr X",
  signerEmail: "drx@hospital.com",
  signerPosition: "Surgeon",
  signedAt: new Date("2026-05-20T10:00:00Z"),
};

describe("sendSignedPdf delivery status", () => {
  test("returns 'suppressed' for the configured test user (never delivered)", async () => {
    const status = await sendSignedPdf(
      "test@example.com",
      Buffer.from("pdf"),
      "T-1",
      sig,
    );
    expect(status).toBe("suppressed");
  });

  test("returns 'skipped_dev' when email sending is disabled (non-prod)", async () => {
    // NODE_ENV=test and FORCE_EMAIL_IN_DEV unset => SHOULD_SEND_EMAILS is false.
    const status = await sendSignedPdf(
      "real@hospital.com",
      Buffer.from("pdf"),
      "T-2",
      sig,
    );
    expect(status).toBe("skipped_dev");
  });
});
