# DL-004: Custom Email Domain Configuration

**Status**: Implemented
**Created**: 2026-01-11
**Author**: Claude (AI Assistant)
**Stakeholders**: Amit Aik

## Context

The ALA application uses Azure Communication Services for sending emails:
1. **Verification codes** during login (2FA)
2. **Signed treatment PDFs** after finalization

Previously, emails were sent from a default Azure domain:
- `DoNotReply@768e518f-10b8-4597-bb07-3f698ca92d21.azurecomm.net`

A new custom domain has been provisioned on Azure Communication Services:
- Service: `ala-communication-service` -> `ala-email-service`
- Domain: `alphatau.com` (verified, DNS records configured)
- Sender address: `www.ala@alphatau.com`

## Design Questions

- [x] Is the new sender address format correct? **Yes, user confirmed `www.ala@alphatau.com`**
- [x] Should we use a different sender name? **No, use as provisioned**
- [x] Do we need different sender addresses for verification codes vs. treatment PDFs? **No, same address**
- [x] Should we update the Azure Communication Services connection string? **Keep existing, should work**
- [x] Should local and production have a single source of truth? **Yes, implemented via appConfig.ts**

## Decision

**Chosen approach: Single Source of Truth via Centralized Config**

Instead of maintaining duplicate values in multiple `.env` files, we:
1. Added email configuration to `backend/src/config/appConfig.ts` with `www.ala@alphatau.com` as the default
2. Updated `emailService.ts` to import from centralized config
3. Environment variables can still override if needed

This follows the existing pattern in the codebase and eliminates configuration drift.

## Implementation Notes

### Files Modified

| File | Change |
|------|--------|
| `backend/src/config/appConfig.ts` | Added `emailSenderAddress`, `emailConnectionString`, `pdfRecipientEmail` |
| `backend/src/services/emailService.ts` | Import from config instead of direct `process.env` access |
| `deployment/.env.production.template` | Updated documentation to show new default |

### Key Code Changes

**appConfig.ts** (new configuration):
```typescript
// Email configuration
emailSenderAddress: process.env.AZURE_EMAIL_SENDER_ADDRESS || 'www.ala@alphatau.com',
emailConnectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '',
pdfRecipientEmail: process.env.PDF_RECIPIENT_EMAIL || '',
```

**emailService.ts** (using centralized config):
```typescript
import { config } from '../config/appConfig';

const AZURE_CONNECTION_STRING = config.emailConnectionString;
const SENDER_ADDRESS = config.emailSenderAddress;
const PDF_RECIPIENT_EMAIL = config.pdfRecipientEmail;
```

### Deployment

No special deployment steps needed - the default is now in code. To deploy:
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./swarm-deploy"
```

## Results

### Verification Checklist
- [ ] Verification code emails send successfully
- [ ] PDF treatment reports send successfully
- [ ] Email appears from correct sender (`www.ala@alphatau.com`)
- [ ] No SPF/DKIM/DMARC issues (emails not going to spam)

### Benefits Achieved
1. **Single Source of Truth**: Default email address is in code, not scattered across .env files
2. **Override Capability**: Environment variables still work for special cases
3. **Consistent Pattern**: Follows existing `appConfig.ts` pattern
4. **Less Duplication**: No need to update multiple .env files when changing email config
