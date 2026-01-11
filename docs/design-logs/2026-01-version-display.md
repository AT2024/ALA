# DL-003: Version Number Display Across All Pages

**Status**: Implemented
**Created**: 2026-01-11
**Author**: Claude Code / amitaik
**Stakeholders**: Development Team

## Context

The ALA medical treatment tracking application currently displays no version information to users. This makes it difficult to:
- Verify which version is deployed to production
- Debug issues by confirming version alignment
- Track PWA update deployments
- Provide support when users report issues

### Current State
- `frontend/package.json` has version `0.1.0`
- `Layout.tsx` has a footer (line 197-199) with copyright but no version
- `LoginPage.tsx` and `VerificationPage.tsx` are standalone pages (no Layout wrapper)
- No version injection mechanism exists

## Design Questions

- [x] Where should version be sourced? **Decision: package.json (single source of truth)**
- [x] How to inject at build time? **Decision: Vite `define` option**
- [x] Where should version appear? **Decision: All pages - footer and auth pages**
- [x] What styling? **Decision: Subtle, muted text below copyright/form**

## Proposed Solution

### Technical Approach: Vite `define` Option

Use Vite's built-in `define` configuration to inject the version as a global constant at build time.

**Why this approach:**
- Zero runtime overhead (replaced at build time)
- No additional dependencies
- Standard Vite pattern
- Works in both dev and production builds

### Implementation

#### 1. Update `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

export default defineConfig({
  define: {
    APP_VERSION: JSON.stringify(version),
  },
  // ... rest of config
});
```

#### 2. Add TypeScript Declaration (`frontend/src/vite-env.d.ts`)

```typescript
/// <reference types="vite/client" />

declare const APP_VERSION: string;
```

#### 3. Update `Layout.tsx` Footer (lines 197-199)

```tsx
<footer className="border-t bg-secondary p-4 text-center text-sm text-muted-foreground">
  <p>&copy; {new Date().getFullYear()} AlphaTau Medical Ltd. All rights reserved.</p>
  <p className="mt-1 text-xs text-muted-foreground/70">v{APP_VERSION}</p>
</footer>
```

#### 4. Update `LoginPage.tsx` (after form, before closing div ~line 188)

```tsx
      </form>
      <p className="mt-8 text-center text-xs text-gray-400">v{APP_VERSION}</p>
    </div>
  </div>
```

#### 5. Update `VerificationPage.tsx` (same pattern, ~line 197)

```tsx
      </form>
      <p className="mt-8 text-center text-xs text-gray-400">v{APP_VERSION}</p>
    </div>
  </div>
```

## Decision

**Selected Approach: Vite `define` option with subtle UI placement**

Rationale:
- Simple, no external dependencies
- Consistent with Vite best practices
- Version appears on ALL user-facing pages
- Subtle styling doesn't distract from core functionality

## Implementation Notes

### Files Modified

| File | Change |
|------|--------|
| `frontend/vite.config.ts` | Add `fs` import, read package.json, add `define` option |
| `frontend/src/vite-env.d.ts` | Add `APP_VERSION` type declaration |
| `frontend/src/components/Layout.tsx` | Add version to footer |
| `frontend/src/pages/Auth/LoginPage.tsx` | Add version below form |
| `frontend/src/pages/Auth/VerificationPage.tsx` | Add version below form |

## Results

**Implementation Date**: 2026-01-11

### Outcome

All changes implemented and verified:

1. **vite.config.ts** - Added `fs` import and `define` option to inject `APP_VERSION` at build time
2. **vite-env.d.ts** - Added TypeScript declaration for `APP_VERSION` global constant
3. **Layout.tsx** - Added version display in footer below copyright
4. **LoginPage.tsx** - Added version display below login form
5. **VerificationPage.tsx** - Added version display below verification form

### Verification

- TypeScript compilation: Passed
- Vite build: Succeeded in 29.21s
- Version `0.1.0` will display on all pages

### Lessons Learned

1. **Vite `define` is simpler than env vars** - Using `define` option avoids the `VITE_` prefix requirement and provides cleaner build-time replacement
2. **Consistent auth page styling** - LoginPage and VerificationPage use `text-gray-400` while Layout uses `text-muted-foreground/70` (both achieve subtle gray appearance)
3. **Local Testing Workflow** - For local testing, always use `npm run dev` in both `frontend/` and `backend/` directories. The Docker images are outdated and should only be used for the PostgreSQL database. Never rely on Docker containers for frontend/backend testing locally.
