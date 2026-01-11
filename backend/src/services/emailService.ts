import { EmailClient, EmailMessage, KnownEmailSendStatus } from '@azure/communication-email';
import logger from '../utils/logger';
import { config } from '../config/appConfig';

// Configuration (from centralized appConfig - single source of truth)
const AZURE_CONNECTION_STRING = config.emailConnectionString;
const SENDER_ADDRESS = config.emailSenderAddress;
const PDF_RECIPIENT_EMAIL = config.pdfRecipientEmail;
const NODE_ENV = process.env.NODE_ENV || 'development';

// In development, skip actual email sending unless explicitly configured
const IS_PRODUCTION = NODE_ENV === 'production';
const FORCE_EMAIL_IN_DEV = process.env.FORCE_EMAIL_IN_DEV === 'true';
const SHOULD_SEND_EMAILS = IS_PRODUCTION || FORCE_EMAIL_IN_DEV;

// Retry configuration (from centralized appConfig)
const MAX_RETRIES = config.emailMaxRetries;
const RETRY_DELAY_MS = config.emailRetryDelayMs;

// Email client singleton
let emailClient: EmailClient | null = null;

/**
 * Get or create email client singleton
 */
function getEmailClient(): EmailClient {
  if (!emailClient) {
    if (!AZURE_CONNECTION_STRING) {
      throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not configured');
    }
    emailClient = new EmailClient(AZURE_CONNECTION_STRING);
  }
  return emailClient;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send email with retry logic
 */
async function sendEmailWithRetry(message: EmailMessage, maxRetries: number = MAX_RETRIES): Promise<boolean> {
  const client = getEmailClient();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Email send attempt ${attempt}/${maxRetries} to ${message.recipients.to?.[0]?.address}`);

      const poller = await client.beginSend(message);
      const result = await poller.pollUntilDone();

      if (result.status === KnownEmailSendStatus.Succeeded) {
        logger.info(`Email sent successfully to ${message.recipients.to?.[0]?.address}`, {
          messageId: result.id,
          attempt
        });
        return true;
      }

      logger.warn(`Email send returned status: ${result.status}`, {
        attempt,
        error: result.error
      });

    } catch (error: any) {
      logger.warn(`Email send attempt ${attempt} failed`, {
        error: error.message,
        attempt,
        maxRetries
      });

      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  logger.error(`Email send failed after ${maxRetries} attempts`);
  throw new Error(`Failed to send email after ${maxRetries} attempts`);
}

/**
 * Send verification code email
 * @param email - Recipient email address
 * @param code - 6-digit verification code
 */
export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  // In development mode, just log the code instead of sending email
  if (!SHOULD_SEND_EMAILS) {
    logger.info(`[DEV MODE] Verification code for ${email}: ${code}`);
    logger.info(`[DEV MODE] To enable actual email sending, set FORCE_EMAIL_IN_DEV=true`);
    return true;
  }

  if (!SENDER_ADDRESS) {
    logger.error('AZURE_EMAIL_SENDER_ADDRESS is not configured');
    throw new Error('Email sender address is not configured');
  }

  const message: EmailMessage = {
    senderAddress: SENDER_ADDRESS,
    recipients: {
      to: [{ address: email }]
    },
    content: {
      subject: 'ALA Medical - Verification Code',
      plainText: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">ALA Medical - Verification Code</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #666;">This code will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you did not request this code, please ignore this email.</p>
          </body>
        </html>
      `
    }
  };

  logger.info(`Sending verification code to ${email}`);
  return sendEmailWithRetry(message);
}

/**
 * Signature details for PDF email
 */
export interface SignatureDetails {
  type: 'hospital_auto' | 'alphatau_verified';
  signerName: string;
  signerEmail: string;
  signerPosition: string;
  signedAt: Date;
}

/**
 * Send signed PDF email to clinic
 * @param toEmail - Recipient email address (defaults to PDF_RECIPIENT_EMAIL)
 * @param pdfBuffer - PDF file as Buffer
 * @param treatmentId - Treatment ID for reference
 * @param signatureDetails - Signature information
 */
export async function sendSignedPdf(
  toEmail: string | null,
  pdfBuffer: Buffer,
  treatmentId: string,
  signatureDetails: SignatureDetails
): Promise<boolean> {
  const recipientEmail = toEmail || PDF_RECIPIENT_EMAIL;

  // In development mode, log the PDF info instead of sending email
  if (!SHOULD_SEND_EMAILS) {
    logger.info(`[DEV MODE] Would send PDF for treatment ${treatmentId} to ${recipientEmail}`);
    logger.info(`[DEV MODE] PDF size: ${pdfBuffer.length} bytes`);
    logger.info(`[DEV MODE] Signature: ${signatureDetails.signerName} (${signatureDetails.signerPosition})`);
    logger.info(`[DEV MODE] To enable actual email sending, set FORCE_EMAIL_IN_DEV=true`);
    return true;
  }

  if (!SENDER_ADDRESS) {
    logger.error('AZURE_EMAIL_SENDER_ADDRESS is not configured');
    throw new Error('Email sender address is not configured');
  }
  const signatureTypeText = signatureDetails.type === 'hospital_auto'
    ? 'Hospital User (Auto-signed)'
    : 'Alpha Tau Verified';

  const formattedDate = signatureDetails.signedAt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const message: EmailMessage = {
    senderAddress: SENDER_ADDRESS,
    recipients: {
      to: [{ address: recipientEmail }]
    },
    content: {
      subject: `ALA Medical - Treatment Report ${treatmentId}`,
      plainText: `
Treatment Report - ${treatmentId}

A treatment has been finalized and signed.

Signature Details:
- Type: ${signatureTypeText}
- Signer: ${signatureDetails.signerName}
- Position: ${signatureDetails.signerPosition}
- Email: ${signatureDetails.signerEmail}
- Date: ${formattedDate}

The signed PDF report is attached to this email.

This is an automated message from the ALA Medical Treatment Tracking System.
      `.trim(),
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Treatment Report - ${treatmentId}</h2>
            <p>A treatment has been finalized and signed.</p>

            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #333; margin-top: 0;">Signature Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Type:</strong></td>
                  <td style="padding: 8px 0;">${signatureTypeText}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Signer:</strong></td>
                  <td style="padding: 8px 0;">${signatureDetails.signerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Position:</strong></td>
                  <td style="padding: 8px 0;">${signatureDetails.signerPosition}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0;">${signatureDetails.signerEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
              </table>
            </div>

            <p>The signed PDF report is attached to this email.</p>

            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This is an automated message from the ALA Medical Treatment Tracking System.
            </p>
          </body>
        </html>
      `
    },
    attachments: [
      {
        name: `Treatment_Report_${treatmentId}.pdf`,
        contentType: 'application/pdf',
        contentInBase64: pdfBuffer.toString('base64')
      }
    ]
  };

  logger.info(`Sending signed PDF for treatment ${treatmentId} to ${recipientEmail}`, {
    treatmentId,
    signatureType: signatureDetails.type,
    signerName: signatureDetails.signerName,
    signerPosition: signatureDetails.signerPosition
  });

  return sendEmailWithRetry(message);
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!(AZURE_CONNECTION_STRING && SENDER_ADDRESS);
}

/**
 * Get PDF recipient email
 */
export function getPdfRecipientEmail(): string {
  return PDF_RECIPIENT_EMAIL;
}

export default {
  sendVerificationCode,
  sendSignedPdf,
  isEmailConfigured,
  getPdfRecipientEmail
};
