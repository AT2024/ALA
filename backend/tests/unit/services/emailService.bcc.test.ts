/**
 * Tests for PDF email BCC injection (PDF_ADDITIONAL_RECIPIENTS env var).
 *
 * Lives in its own file rather than `emailService.test.ts` because it needs
 * FORCE_EMAIL_IN_DEV=true to take the production-send code path so we can
 * inspect the EmailMessage handed to Azure ACS. The existing test file
 * deliberately uses dev-mode short-circuit and would conflict.
 */

// Stable env required for emailService to enter the production send path.
process.env.NODE_ENV = "test";
process.env.FORCE_EMAIL_IN_DEV = "true";
process.env.AZURE_COMMUNICATION_CONNECTION_STRING =
  "endpoint=https://test.communication.azure.com/;accesskey=testkey";
process.env.AZURE_EMAIL_SENDER_ADDRESS = "test@test.azurecomm.net";
process.env.PDF_RECIPIENT_EMAIL = "fallback@test.example.com";

// Capture Azure ACS payloads. Name starts with "mock" so the jest.mock factory
// is allowed to close over it (jest hoists `jest.mock` above all imports and
// `const` declarations, but exempts identifiers prefixed with "mock").
const mockBeginSend = jest.fn();

jest.mock("@azure/communication-email", () => ({
  EmailClient: jest.fn().mockImplementation(() => ({
    beginSend: (...args: unknown[]) => mockBeginSend(...args),
  })),
  KnownEmailSendStatus: {
    Succeeded: "Succeeded",
    Failed: "Failed",
  },
}));

jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const SIGNATURE = {
  type: "hospital_auto" as const,
  signerName: "Dr. Test",
  signerEmail: "signer@hospital.test",
  signerPosition: "doctor",
  signedAt: new Date("2024-01-15T10:30:00Z"),
};

describe("sendSignedPdf — PDF_ADDITIONAL_RECIPIENTS BCC", () => {
  beforeEach(() => {
    // resetModules so appConfig re-evaluates PDF_ADDITIONAL_RECIPIENTS per test.
    jest.resetModules();
    mockBeginSend.mockReset();
    mockBeginSend.mockResolvedValue({
      pollUntilDone: jest.fn().mockResolvedValue({
        status: "Succeeded",
        id: "msg-id",
      }),
    });
  });

  afterEach(() => {
    delete process.env.PDF_ADDITIONAL_RECIPIENTS;
  });

  it("omits the bcc field when PDF_ADDITIONAL_RECIPIENTS is empty", async () => {
    process.env.PDF_ADDITIONAL_RECIPIENTS = "";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendSignedPdf } = require("../../../src/services/emailService");

    await sendSignedPdf(
      "signer@hospital.test",
      Buffer.from("pdf"),
      "tid-1",
      SIGNATURE,
    );

    expect(mockBeginSend).toHaveBeenCalledTimes(1);
    const msg = mockBeginSend.mock.calls[0][0] as {
      recipients: { to: Array<{ address: string }>; bcc?: unknown };
    };
    expect(msg.recipients.to).toEqual([{ address: "signer@hospital.test" }]);
    expect(msg.recipients.bcc).toBeUndefined();
  });

  it("BCCs the 3 additional recipients (trimmed, lowercased) alongside the signer's To:", async () => {
    process.env.PDF_ADDITIONAL_RECIPIENTS =
      "Ops@alphatau.test, qa@ALPHATAU.test , records@alphatau.test";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendSignedPdf } = require("../../../src/services/emailService");

    await sendSignedPdf(
      "signer@hospital.test",
      Buffer.from("pdf"),
      "tid-2",
      SIGNATURE,
    );

    expect(mockBeginSend).toHaveBeenCalledTimes(1);
    const msg = mockBeginSend.mock.calls[0][0] as {
      recipients: {
        to: Array<{ address: string }>;
        bcc?: Array<{ address: string }>;
      };
    };
    expect(msg.recipients.to).toEqual([{ address: "signer@hospital.test" }]);
    expect(msg.recipients.bcc).toEqual([
      { address: "ops@alphatau.test" },
      { address: "qa@alphatau.test" },
      { address: "records@alphatau.test" },
    ]);
  });

  it("drops a bcc entry that equals the signer email (case-insensitive)", async () => {
    process.env.PDF_ADDITIONAL_RECIPIENTS =
      "Signer@Hospital.test, qa@alphatau.test, records@alphatau.test";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendSignedPdf } = require("../../../src/services/emailService");

    await sendSignedPdf(
      "signer@hospital.test",
      Buffer.from("pdf"),
      "tid-3",
      SIGNATURE,
    );

    expect(mockBeginSend).toHaveBeenCalledTimes(1);
    const msg = mockBeginSend.mock.calls[0][0] as {
      recipients: {
        to: Array<{ address: string }>;
        bcc?: Array<{ address: string }>;
      };
    };
    expect(msg.recipients.to).toEqual([{ address: "signer@hospital.test" }]);
    expect(msg.recipients.bcc).toEqual([
      { address: "qa@alphatau.test" },
      { address: "records@alphatau.test" },
    ]);
  });
});
