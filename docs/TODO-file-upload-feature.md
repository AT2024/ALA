# File Upload Feature - Remaining Work

## Status: Infrastructure Complete, Feature Incomplete

**Branch**: `feature/applicator-file-upload-with-priority-sync`
**Last Commit**: Foundation infrastructure (a6d00f4)
**Committed**: 2025-11-18

---

## ✅ What's COMPLETE (Committed)

### Backend Infrastructure
- ✅ [backend/src/middleware/upload.ts](../backend/src/middleware/upload.ts) - Multer configuration
  - File type validation (images: JPEG, PNG, GIF, WebP; videos: MP4, MPEG, MOV, AVI, WMV)
  - 50MB max file size per file, 10 files max per request
  - Temporary directory cleanup functions

- ✅ [backend/src/services/zipService.ts](../backend/src/services/zipService.ts) - ZIP file management
  - Create ZIP files from uploaded files with compression
  - Read/convert ZIP to Base64 for Priority sync
  - Cleanup methods (commented out until model has attachment fields)
  - Disk usage tracking

- ✅ Dependencies added to package.json:
  - `archiver@^7.0.1` - ZIP creation
  - `@types/archiver@^7.0.0`
  - `multer@^1.4.5-lts.1` - already existed
  - `node-cron@^4.2.1` - scheduled cleanup
  - `@types/node-cron@^3.0.11`

### Frontend Display
- ✅ [frontend/src/pages/Treatment/UseList.tsx](../frontend/src/pages/Treatment/UseList.tsx) - Upload status display
  - "Uploads" column in applicator list
  - File count badges with status (pending/syncing/synced/failed)

- ✅ [frontend/src/context/TreatmentContext.tsx](../frontend/src/context/TreatmentContext.tsx) - Type definitions
  - Added `attachmentFileCount?: number`
  - Added `attachmentSyncStatus?: 'pending' | 'syncing' | 'synced' | 'failed' | null`
  - Added `attachmentFilename?: string`

- ✅ [frontend/src/services/applicatorService.ts](../frontend/src/services/applicatorService.ts)
  - Returns full applicator object from save response

- ✅ Component cleanup:
  - Removed deprecated ApplicatorInformation component
  - Updated App.tsx routes

### Configuration
- ✅ Docker volumes for uploads persistence
- ✅ Nginx cache optimizations
- ✅ Jest config modernization
- ✅ TypeScript test improvements

---

## ❌ What's MISSING (Blockers)

### 🚨 BLOCKER 1: SyncService (High Priority)
**File**: `backend/src/services/syncService.ts` (DOES NOT EXIST)

**Status**: File missing, referenced in reverted controller code

**Required Implementation**:
```typescript
class SyncService {
  /**
   * Sync applicator with attachment to Priority ERP
   * @param applicatorId - Applicator UUID
   */
  async syncApplicatorById(applicatorId: string): Promise<void> {
    // 1. Load applicator from database
    // 2. Read ZIP file and convert to Base64
    // 3. Call priorityService.updateApplicatorWithAttachment()
    // 4. Update attachmentSyncStatus to 'syncing', then 'synced' or 'failed'
    // 5. Handle errors and retry logic
  }
}
```

**Depends on**:
- Priority API integration (priorityService.updateApplicatorWithAttachment exists but untested)
- Applicator model with attachment fields
- Database migration

**Testing needs**:
- Unit tests for sync logic
- Integration tests with Priority API
- Error handling and retry tests

---

### 🚨 BLOCKER 2: Database Migration (Critical)
**File**: `backend/src/migrations/YYYYMMDD-add-applicator-attachments.sql` (DOES NOT EXIST)

**Status**: Migration missing, model references fields that don't exist in database

**Required SQL**:
```sql
-- Add attachment fields to applicators table
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255);
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_zip_path VARCHAR(500);
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_file_count INTEGER DEFAULT 0;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER DEFAULT 0;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_sync_status VARCHAR(50);

-- Add index for sync status queries (performance)
CREATE INDEX IF NOT EXISTS idx_applicators_sync_status ON applicators(attachment_sync_status);

-- Add index for ZIP path lookups (orphaned file cleanup)
CREATE INDEX IF NOT EXISTS idx_applicators_zip_path ON applicators(attachment_zip_path);
```

**Migration steps**:
1. Create migration file with timestamp
2. Test on local database first
3. Plan rollback strategy
4. Apply to staging
5. Verify no data loss
6. Apply to production

**Notes**:
- Must run BEFORE uncommenting zipService cleanup methods
- Must run BEFORE adding upload handler to controller
- Test with existing treatments to ensure no breaking changes

---

### 🚨 BLOCKER 3: Applicator Model Fields (Critical)
**File**: [backend/src/models/Applicator.ts](../backend/src/models/Applicator.ts)

**Status**: Missing `attachmentSyncStatus` field definition

**Current State**:
- Model has: `attachmentFilename`, `attachmentZipPath`, `attachmentFileCount`, `attachmentSizeBytes`
- Model MISSING: `attachmentSyncStatus` (referenced in zipService and controller)

**Required Addition**:
```typescript
// In ApplicatorAttributes interface:
attachmentSyncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | null;

// In Applicator class:
public attachmentSyncStatus!: 'pending' | 'syncing' | 'synced' | 'failed' | null;

// In Applicator.init() schema:
attachmentSyncStatus: {
  type: DataTypes.ENUM('pending', 'syncing', 'synced', 'failed'),
  allowNull: true,
  field: 'attachment_sync_status'
}

// In ApplicatorCreationAttributes:
// Add 'attachmentSyncStatus' to optional fields list
```

**Must be done AFTER**:
- Database migration is applied

---

### 🚨 BLOCKER 4: File Upload UI (High Priority)
**File**: [frontend/src/pages/Treatment/TreatmentDocumentation.tsx](../frontend/src/pages/Treatment/TreatmentDocumentation.tsx)

**Status**: State variables exist but no UI controls

**Current State**:
- Has state: `selectedFiles`, `filePreviews`, `uploading`, `uploadSuccess`
- Missing: Actual UI to trigger file selection and upload

**Required UI Elements**:
1. **File Input Control**:
   ```tsx
   <input
     type="file"
     accept="image/*,video/*"
     multiple
     max={10}
     onChange={handleFilesChange}
   />
   ```

2. **File Preview Section**:
   - Show selected files before upload
   - Display thumbnails for images
   - Show file names and sizes for videos
   - Allow removal of individual files

3. **Upload Button**:
   - Trigger upload to backend
   - Show progress indicator
   - Disable during upload

4. **Status Messages**:
   - Success: "X files uploaded successfully"
   - Error: Display specific error messages
   - Validation errors: File size, file type, count limits

5. **Integration Point**:
   - Where in the workflow? (After applicator save? During? Separate step?)
   - Required or optional?
   - Link to specific applicator

**Service Integration**:
```typescript
// Already exists in treatmentService (currently reverted)
async uploadApplicatorFiles(
  treatmentId: string,
  applicatorId: string,
  files: File[]
): Promise<UploadResult>
```

**UX Considerations**:
- Show upload status after save
- Allow immediate file upload after applicator entry
- Clear feedback for sync status
- Retry mechanism for failed uploads

---

### 🚨 BLOCKER 5: Upload Controller Handler (Medium Priority)
**File**: [backend/src/controllers/applicatorController.ts](../backend/src/controllers/applicatorController.ts)

**Status**: Handler exists but was reverted due to dependencies

**Required Implementation**:
```typescript
export const uploadApplicatorFiles = asyncHandler(async (req: Request, res: Response) => {
  const { treatmentId, id } = req.params;
  const files = req.files as Express.Multer.File[];

  // 1. Verify files were uploaded
  // 2. Verify treatment exists and user has access
  // 3. Verify applicator belongs to treatment
  // 4. Create ZIP from uploaded files
  // 5. Update applicator with ZIP info and set syncStatus='pending'
  // 6. Clean up temp files
  // 7. Trigger background sync (syncService.syncApplicatorById)
  // 8. Return success response
});
```

**Route Registration**:
```typescript
// In backend/src/routes/treatmentRoutes.ts
router.post(
  '/:treatmentId/applicators/:id/upload',
  validateApplicatorUpdate,
  criticalOperationHealthCheck,
  uploadMiddleware.array('files', 10),
  uploadApplicatorFiles
);
```

**Depends on**:
- SyncService implementation
- Applicator model with attachment fields
- Database migration

---

### 🚨 BLOCKER 6: Priority API Integration (Medium Priority)
**File**: [backend/src/services/priorityService.ts](../backend/src/services/priorityService.ts)

**Status**: Method exists but was reverted, needs testing

**Method**: `updateApplicatorWithAttachment()`

**Implementation Exists**:
- Converts ZIP to Base64
- Calls Priority PATCH endpoint
- Updates SIBD_APPLICATUSELIST_SUBFORM
- Sets EXTFILENAME and EXTFILEDATA fields

**Testing Needs**:
1. **Unit Tests**:
   - Base64 conversion
   - OData endpoint construction
   - Error handling

2. **Integration Tests** (with Priority test environment):
   - Create test order
   - Add test applicator
   - Upload ZIP attachment
   - Verify in Priority UI
   - Test error scenarios (file too large, invalid format, etc.)

3. **Production Validation**:
   - Test with real user (not test@example.com)
   - Verify attachment appears in Priority
   - Check file integrity after download from Priority
   - Performance testing with large files (50MB)

**Priority API Endpoints Used**:
```
GET  /ORDERS('{orderId}')/SIBD_APPLICATUSELIST_SUBFORM?$filter=SERNUM eq '{serialNumber}'
PATCH /ORDERS('{orderId}')/SIBD_APPLICATUSELIST_SUBFORM({lineKey})
```

**Fields Updated**:
- `EXTFILENAME`: Filename (e.g., "applicator-uuid-timestamp.zip")
- `EXTFILEDATA`: Base64-encoded ZIP content

---

## 📋 Implementation Checklist

### Phase 1: Database & Model (Foundation)
- [ ] Create database migration file
- [ ] Test migration on local database
- [ ] Add `attachmentSyncStatus` field to Applicator model
- [ ] Run migration on staging database
- [ ] Verify no data corruption
- [ ] Update Sequelize model tests

### Phase 2: Backend Services
- [ ] Create SyncService class
  - [ ] `syncApplicatorById()` method
  - [ ] Error handling and retry logic
  - [ ] Status updates (pending → syncing → synced/failed)
- [ ] Uncomment zipService cleanup methods
- [ ] Add unit tests for SyncService
- [ ] Add integration tests for Priority API sync

### Phase 3: Backend Controller
- [ ] Implement `uploadApplicatorFiles` handler
- [ ] Add route registration
- [ ] Test file upload endpoint with Postman
- [ ] Add controller tests
- [ ] Add validation tests (file type, size, count)

### Phase 4: Frontend UI
- [ ] Design file upload UI flow
  - [ ] Decide: When does user upload? (After save? During? Separate?)
  - [ ] Sketch wireframe
- [ ] Implement file input control
- [ ] Add file preview section
- [ ] Add upload button and progress indicator
- [ ] Implement error/success messages
- [ ] Connect to treatmentService.uploadApplicatorFiles()
- [ ] Add UI tests (Vitest component tests)

### Phase 5: End-to-End Testing
- [ ] Test complete workflow:
  1. Create treatment
  2. Add applicator
  3. Upload files
  4. Verify ZIP created
  5. Verify sync to Priority
  6. Check Priority UI for attachment
  7. Download from Priority and verify integrity
- [ ] Test error scenarios:
  - [ ] File too large
  - [ ] Invalid file type
  - [ ] Network error during upload
  - [ ] Priority API error
  - [ ] Disk full scenario
- [ ] Test cleanup job:
  - [ ] Synced ZIPs are deleted
  - [ ] Orphaned files are removed
  - [ ] Database remains consistent

### Phase 6: Production Deployment
- [ ] Deploy to staging
- [ ] QA testing on staging
- [ ] Performance testing (50MB files)
- [ ] User acceptance testing
- [ ] Create deployment runbook
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Verify cleanup cron job runs

---

## 🎯 Next Steps (Recommended Order)

1. **Database Migration** (30 min)
   - Create migration SQL file
   - Test locally
   - Apply to staging

2. **Model Update** (10 min)
   - Add `attachmentSyncStatus` field
   - Update TypeScript interfaces

3. **SyncService** (2-3 hours)
   - Implement class with Priority API integration
   - Add error handling and retry
   - Write unit tests

4. **Upload Controller** (1-2 hours)
   - Implement handler
   - Add route
   - Test with Postman

5. **File Upload UI** (3-4 hours)
   - Design UX flow
   - Implement components
   - Connect to backend
   - Add component tests

6. **Integration Testing** (2-3 hours)
   - End-to-end workflow tests
   - Priority API validation
   - Error scenario testing

7. **Deployment** (1 hour)
   - Staging deployment
   - QA testing
   - Production deployment

**Total Estimate**: 10-15 hours of development work

---

## 💡 Design Decisions to Make

### 1. Upload Timing
**Question**: When should the user upload files?

**Options**:
- **A) Immediately after applicator save** (recommended)
  - Pros: User still in context, natural workflow
  - Cons: Adds friction to applicator entry

- **B) Separate step after treatment completion**
  - Pros: Faster applicator entry, batch uploads
  - Cons: User might forget, requires navigating back to treatment

- **C) Optional anytime via "Add Files" button in UseList**
  - Pros: Maximum flexibility
  - Cons: More complex UI, unclear when to upload

**Recommendation**: Option A (immediately after save) with skip option

### 2. Upload Requirement
**Question**: Are file uploads required or optional?

**Options**:
- **Required**: Every applicator must have files
  - Pros: Complete documentation
  - Cons: Blocks workflow if no photos taken

- **Optional**: Files are supplementary documentation
  - Pros: Flexible workflow
  - Cons: Inconsistent documentation

**Recommendation**: Optional (clinical workflow may not always allow photos)

### 3. Sync Strategy
**Question**: When should files sync to Priority?

**Options**:
- **Immediate**: Sync right after upload
  - Pros: Data in Priority ASAP
  - Cons: Blocks UI if Priority is slow

- **Background**: Queue for background sync
  - Pros: Non-blocking, resilient to errors
  - Cons: Status tracking required

- **Manual**: User triggers sync
  - Pros: Full control
  - Cons: User might forget

**Recommendation**: Background (already implemented in reverted controller)

### 4. Retry Logic
**Question**: How should failed syncs be handled?

**Recommendation**:
- Automatic retry: 3 attempts with exponential backoff
- After 3 failures: Mark as 'failed', require manual intervention
- Show failed status in UI with "Retry" button
- Log errors for debugging

---

## 🔍 Testing Strategy

### Unit Tests
- [ ] zipService: ZIP creation, Base64 conversion, cleanup
- [ ] SyncService: Sync logic, error handling, retry
- [ ] uploadMiddleware: File validation, size limits
- [ ] Controller: Authorization, file handling, cleanup on error

### Integration Tests
- [ ] End-to-end upload workflow
- [ ] Priority API sync with test data
- [ ] Database transactions and rollback
- [ ] File system cleanup after errors

### Manual Testing Checklist
- [ ] Upload 1 image (small, < 1MB)
- [ ] Upload 10 images (at max limit)
- [ ] Upload 1 video (large, 40MB)
- [ ] Upload mixed images + videos
- [ ] Try to upload 11 files (should reject)
- [ ] Try to upload 51MB file (should reject)
- [ ] Try to upload invalid file type (should reject)
- [ ] Verify ZIP file created correctly
- [ ] Verify sync to Priority works
- [ ] Download from Priority and verify integrity
- [ ] Test cleanup job (synced ZIPs deleted)
- [ ] Test orphaned file cleanup

---

## 📊 Metrics to Track

After deployment, monitor:
- Upload success rate
- Average file size
- Sync success rate to Priority
- Time to sync (from upload to synced)
- Failed syncs (and reasons)
- Disk usage trends
- Cleanup job effectiveness

---

## 🚨 Risks & Mitigations

### Risk 1: Disk Space Exhaustion
**Mitigation**:
- Cleanup cron job runs daily
- Monitor disk usage
- Alert if > 80% full
- Set max total upload size (e.g., 10GB limit)

### Risk 2: Priority API Failures
**Mitigation**:
- Retry logic with exponential backoff
- Persist failed sync status
- Manual retry option in UI
- Alert on high failure rate

### Risk 3: File Corruption
**Mitigation**:
- SHA-256 checksum verification
- Test file integrity after download from Priority
- Log checksums for debugging

### Risk 4: Performance Impact
**Mitigation**:
- Background sync (non-blocking)
- Compress with level 9 (smaller ZIPs)
- Limit max file size (50MB)
- Limit concurrent syncs

---

## 📝 Documentation Needed

- [ ] User guide: How to upload files
- [ ] Admin guide: Monitoring sync status
- [ ] Troubleshooting: Failed upload scenarios
- [ ] API documentation: Upload endpoint
- [ ] Database schema: Attachment fields
- [ ] Deployment runbook: Migration steps

---

## ✅ Acceptance Criteria

Feature is complete when:

1. **Upload Works**:
   - ✅ User can upload images/videos after applicator save
   - ✅ Files are validated (type, size, count)
   - ✅ ZIP is created and stored
   - ✅ Applicator record updated with ZIP info

2. **Sync Works**:
   - ✅ ZIP syncs to Priority in background
   - ✅ Sync status tracked (pending → syncing → synced/failed)
   - ✅ Retries on failure (3 attempts)
   - ✅ Manual retry available for failed syncs

3. **UI Works**:
   - ✅ Upload status visible in UseList
   - ✅ File count badge shows correct number
   - ✅ Sync status badge shows correct state
   - ✅ Upload UI is intuitive and clear

4. **Cleanup Works**:
   - ✅ Synced ZIPs are deleted after successful sync
   - ✅ Orphaned files are removed after 7 days
   - ✅ Temp files are cleaned after upload

5. **Testing Passes**:
   - ✅ All unit tests pass
   - ✅ Integration tests pass
   - ✅ Manual test checklist complete
   - ✅ QA approval on staging

6. **Production Ready**:
   - ✅ Migration applied successfully
   - ✅ No errors in logs
   - ✅ Monitoring in place
   - ✅ Documentation complete

---

**Last Updated**: 2025-11-18
**Next Review**: After Phase 1 (Database Migration) is complete
