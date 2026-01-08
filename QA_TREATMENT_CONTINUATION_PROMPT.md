# QA Testing Mission: Treatment Continuation Flow

## Your Role
You are a **Professional QA Engineer** testing the ALA Medical Treatment Tracking System. Your mission is to thoroughly test the "Treatment Continuation" feature - the ability for users to finish a treatment, return later (within 24 hours), and continue adding applicators to the same patient session.

## CRITICAL: Test Environment

- **Environment**: Local Development (http://localhost:5173 for frontend, http://localhost:5000 for backend)
- **User**: Admin User (amitaik@alphatau.com) - has Position 99 for full site access
- **Mode**: NORMAL MODE (NOT test mode) - use real Priority ERP data
- **Site**: Gulf Center - there is an existing treatment for today to test with
- **Tools**: Claude Code Chrome Extension (claude --chrome)

### Pre-Test Setup: Claude Code Chrome Extension

**IMPORTANT: Before running ANY tests, verify the Chrome extension is working!**

#### Step 1: Verify Claude Code Version
Run this command to check your version:
```bash
claude --version
```
**Required**: v2.0.73 or higher. If older, run `claude update`

#### Step 2: Install Chrome Extension (if not installed)
1. Open Chrome and go to: https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn
2. Click "Add to Chrome"
3. **Required version**: 1.0.36 or higher

#### Step 3: Start Claude Code with Chrome Enabled
```bash
claude --chrome
```
This launches Claude Code with browser automation capabilities.

#### Step 4: Verify Connection
In Claude Code, run:
```
/chrome
```
You should see the chrome tools are enabled. If you see "Chrome extension not detected":
- Make sure Chrome is open
- Restart Chrome completely
- Re-run `/chrome` command

#### Step 5: Start the Application
```bash
cd backend && npm run dev   # In one terminal
cd frontend && npm run dev  # In another terminal
```
Verify health: `curl http://localhost:5000/api/health`

### Chrome Extension Commands You'll Use
- **Navigate**: Claude will navigate to URLs automatically
- **Click**: Claude will click buttons and links
- **Type**: Claude will fill in forms
- **Scroll**: Claude will scroll to find elements
- **Screenshot**: Claude can take screenshots for verification
- **Read Console**: Claude can check browser console for errors

### Handling Login/CAPTCHAs
If Claude encounters a login page or CAPTCHA, it will pause and ask you to handle it manually. Once you've logged in, tell Claude to continue.

---

## UNDERSTANDING THE FEATURE

### What is Treatment Continuation?
When a medical staff completes an insertion treatment and signs it, they have a **24-hour window** to continue that treatment if needed. This allows:
- Adding more applicators to the same patient session
- Reusing applicators that were OPENED or LOADED but not INSERTED
- Generating a continuation PDF that references the original

### Key Technical Details

**Database Fields** (Treatment model):
- `parentTreatmentId`: Links continuation to parent treatment
- `lastActivityAt`: Timestamp of last applicator activity (used for 24-hour window)

**API Endpoints**:
- `GET /api/treatments/:id/continuable` - Check eligibility (returns canContinue, hoursRemaining, reusableApplicatorCount)
- `POST /api/treatments/:id/continue` - Create continuation treatment
- `GET /api/treatments/:id/parent` - Get parent treatment info

**Applicator Status Rules**:
- **Reusable** (can be used in continuation): SEALED, OPENED, LOADED
- **Terminal** (cannot be reused): INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE

**UI Indicators**:
- **Amber box**: "Continue This Treatment" - shown on completed treatments within 24-hour window
- **Blue box**: "Continuation Treatment" - shown when viewing a continuation treatment

**PDF Differences**:
- **Initial PDF**: No continuation notice
- **Continuation PDF**: Orange box at top saying "CONTINUATION TREATMENT - Original treatment PDF created at [timestamp]"

---

## TEST SCENARIOS

### SCENARIO 1: Complete Happy Path (MOST IMPORTANT)

**Objective**: Verify the full flow from initial treatment through continuation and final PDF verification.

#### Phase 1: Initial Treatment Setup

1. **Login**
   - Navigate to http://localhost:5173
   - Login with admin credentials (amitaik@alphatau.com)
   - If prompted for mode, select "Normal Mode" (NOT test mode)
   - **VERIFY**: Successful login, redirected to dashboard

2. **Select Existing Treatment for Today**
   - Click "New Treatment" or navigate to treatment selection
   - Select "Insertion" treatment type
   - Select site: **"Gulf Center"** (there's an existing treatment for today)
   - Look for patients with treatments scheduled for TODAY
   - Select one of the available patients
   - **VERIFY**: Treatment created/loaded, navigated to scan page
   - **NOTE**: You're using REAL Priority ERP data, not test data

3. **Add Applicators from Available List** (Add 3 applicators)

   **IMPORTANT**: Use the "Choose from List" feature to select real applicators assigned to this patient.

   **Applicator 1** (Will be INSERTED - terminal):
   - Go to "Choose from List" or scan an available applicator
   - Select an applicator from the patient's available list
   - Change status: SEALED → INSERTED
   - Add insertion time
   - Save applicator
   - **RECORD**: Note this applicator's serial number
   - **VERIFY**: Applicator appears in UseList with INSERTED status

   **Applicator 2** (Will stay OPENED - reusable):
   - Select another applicator from the list
   - Change status: SEALED → OPENED
   - Save applicator
   - **RECORD**: Note this applicator's serial number
   - **VERIFY**: Applicator appears in UseList with OPENED status

   **Applicator 3** (Will stay LOADED - reusable):
   - Select another applicator from the list
   - Change status: SEALED → LOADED
   - Save applicator
   - **RECORD**: Note this applicator's serial number
   - **VERIFY**: Applicator appears in UseList with LOADED status

   **NOTE**: These are REAL applicators from Priority ERP. Record their serial numbers for the continuation test.

4. **Verify UseList State**
   - Navigate to UseList (should already be there)
   - **VERIFY**: All 3 applicators displayed
   - **VERIFY**: Status badges show correct colors (INSERTED=green, OPENED=blue, LOADED=purple)
   - **VERIFY**: Treatment summary shows correct counts

#### Phase 2: Finalize Initial Treatment

5. **Initiate Finalization**
   - Click "Finish Treatment" button
   - **VERIFY**: Confirmation dialog appears
   - Confirm finalization

6. **Sign Treatment**
   - Signature modal appears
   - Draw/enter signature
   - Submit signature
   - **VERIFY**: Success message appears
   - **VERIFY**: Treatment marked as complete

7. **Verify Initial PDF** (IMPORTANT)
   - Wait for PDF generation (may take a few seconds)
   - Look for PDF download link or email notification
   - If possible, download/view the PDF
   - **VERIFY**: PDF contains all 3 applicators
   - **VERIFY**: PDF does NOT have orange "CONTINUATION TREATMENT" box
   - **RECORD**: Note the PDF creation timestamp for later comparison

#### Phase 3: Verify Continuation Option Appears

8. **Check UseList After Completion**
   - Should still be on UseList or navigate back to it
   - **VERIFY**: Treatment shows as "Complete"
   - **VERIFY**: Amber box appears with "Continue This Treatment" header
   - **VERIFY**: Shows hours remaining (should be ~24 hours)
   - **VERIFY**: Shows reusable applicator count (should be 2 - the OPENED and LOADED ones)
   - **SCREENSHOT**: Capture the continuation option UI

#### Phase 4: Create Continuation Treatment

9. **Click Continue Treatment**
   - Click the "Continue Treatment" button in the amber box
   - **VERIFY**: Loading indicator appears
   - **VERIFY**: Success message: "Continuation treatment created!"
   - **VERIFY**: Redirected to scan page

10. **Verify Continuation Treatment State**
    - Navigate to UseList
    - **VERIFY**: Blue info box appears with "Continuation Treatment" header
    - **VERIFY**: Shows original treatment date
    - **VERIFY**: Text mentions OPENED/LOADED applicators can be reused
    - **VERIFY**: Treatment date is TODAY (not parent treatment date)
    - **SCREENSHOT**: Capture the continuation indicator UI

#### Phase 5: Test Applicator Reuse Rules

11. **Try to Reuse INSERTED Applicator (Should FAIL)**
    - Go to scan page or "Choose from List"
    - Try to use Applicator 1's serial number (the one you set to INSERTED in step 3)
    - Attempt to add it
    - **VERIFY**: Error message appears
    - **VERIFY**: Message indicates applicator was already INSERTED in original treatment and cannot be reused
    - **RECORD**: Exact error message for verification

12. **Reuse OPENED Applicator (Should SUCCEED)**
    - Use Applicator 2's serial number (the one you set to OPENED in step 3)
    - **VERIFY**: Applicator is recognized and accepted
    - **VERIFY**: Status shows as OPENED (preserved from original treatment)
    - **VERIFY**: You can change the status (e.g., OPENED → LOADED → INSERTED)
    - Change status to INSERTED and complete processing
    - **VERIFY**: Appears in UseList with new status

13. **Verify LOADED Applicator Can Also Be Reused**
    - Use Applicator 3's serial number (the one you set to LOADED in step 3)
    - **VERIFY**: Applicator is recognized and accepted
    - **VERIFY**: Status shows as LOADED (preserved from original)
    - Process it as needed
    - **VERIFY**: Appears in UseList

#### Phase 6: Finalize Continuation & Verify PDF

14. **Finalize Continuation Treatment**
    - Click "Finish Treatment"
    - Sign and complete
    - **VERIFY**: Success

15. **Verify Continuation PDF** (CRITICAL)
    - Download/view the continuation PDF
    - **VERIFY**: Orange/amber box at top of PDF
    - **VERIFY**: Text says "CONTINUATION TREATMENT"
    - **VERIFY**: Shows "Original treatment PDF created at [timestamp]"
    - **VERIFY**: Timestamp matches the initial PDF creation time noted in step 7
    - **VERIFY**: Contains applicators processed in this continuation session
    - **COMPARE**: Initial PDF vs Continuation PDF - format should be identical except for continuation notice

---

### SCENARIO 2: Data Integrity Verification

**Objective**: Verify that patient/treatment data is correctly preserved in continuation.

1. **API Verification** (Use browser DevTools Network tab or curl)
   ```bash
   # After creating continuation, get the treatment details
   curl http://localhost:5000/api/treatments/{continuation-id}
   ```

   **VERIFY**:
   - `parentTreatmentId` matches the original treatment ID
   - `subjectId` matches original (same patient)
   - `patientName` matches original
   - `site` matches original
   - `surgeon` matches original
   - `activityPerSeed` matches original
   - `date` is TODAY (NOT the parent's date)
   - `type` is "insertion"

2. **Get Parent Treatment**
   ```bash
   curl http://localhost:5000/api/treatments/{continuation-id}/parent
   ```
   **VERIFY**: Returns the original treatment with correct data

---

### SCENARIO 3: Edge Cases & Error Handling

1. **Offline Behavior**
   - With continuation treatment loaded
   - Disconnect network/go offline
   - **VERIFY**: "Continue Treatment" button is disabled with appropriate message
   - **VERIFY**: Can still VIEW the treatment but not create continuation

2. **24-Hour Window Display**
   - When viewing a continuable treatment
   - **VERIFY**: Hours remaining is displayed
   - **VERIFY**: Reusable applicator count is accurate

3. **Multiple Continuations** (if time permits)
   - After completing first continuation
   - Check if can continue again (within 24 hours of last activity)
   - Verify chain: Original → Continuation 1 → Continuation 2

---

## VERIFICATION CHECKLIST

### Initial Treatment
- [ ] Treatment created successfully
- [ ] All applicators processed with correct statuses
- [ ] UseList displays all applicators correctly
- [ ] Finalization completes successfully
- [ ] Initial PDF generated WITHOUT continuation notice
- [ ] "Continue Treatment" option appears after completion

### Continuation Treatment
- [ ] Continuation created successfully via "Continue Treatment" button
- [ ] Blue "Continuation Treatment" indicator displayed
- [ ] Original treatment date shown in indicator
- [ ] Patient data preserved (subjectId, patientName, site, surgeon)
- [ ] Treatment date is NEW (today), not parent's date
- [ ] parentTreatmentId set correctly in API response

### Applicator Reuse Rules
- [ ] INSERTED applicator from parent: REJECTED with clear error
- [ ] OPENED applicator from parent: ACCEPTED, status preserved
- [ ] LOADED applicator from parent: ACCEPTED, status preserved
- [ ] New applicators can be added normally

### Continuation PDF
- [ ] PDF generated successfully
- [ ] Orange "CONTINUATION TREATMENT" notice at top
- [ ] Shows "Original treatment PDF created at [timestamp]"
- [ ] Timestamp matches initial PDF creation time
- [ ] All applicators from continuation session included
- [ ] Format identical to initial PDF except for notice

---

## BUG REPORTING FORMAT

If you find an issue, document it as follows:

### BUG REPORT: [Brief Title]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step n]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshot/Evidence**:
[Screenshot or console output]

**Relevant Files**:
- [File path 1]
- [File path 2]

**Suggested Fix** (if obvious):
[Your recommendation]

---

## IMPORTANT NOTES

1. **Do NOT fix bugs automatically** - Report them first and ask for permission to fix
2. **Take screenshots** using Chrome extension at key verification points
3. **Record all API responses** for data integrity checks (use Network tab or curl)
4. **If a test fails**, document it and continue with remaining tests
5. **REAL DATA WARNING**: You're using Normal Mode with real Priority ERP data from Gulf Center. Be careful with applicator status changes - they affect real records!
6. **Record Serial Numbers**: Write down applicator serial numbers during testing for the continuation reuse tests
7. **Chrome Extension Tips**:
   - If Claude gets stuck, ask it to take a screenshot to see the current state
   - Use "scroll down" if elements aren't visible
   - Check browser console for JavaScript errors if something doesn't work
   - The Chrome window must be visible (not minimized) for automation to work
8. **If login is required**, Claude will pause and ask you to log in manually, then continue

## Files to Reference if Issues Found

- **Continuation Logic**: `backend/src/services/treatmentService.ts` (lines 826-953)
- **Applicator Validation**: `backend/src/services/applicatorService.ts`
- **PDF Generation**: `backend/src/services/pdfGenerationService.ts` (lines 297-329 for continuation notice)
- **UseList UI**: `frontend/src/pages/Treatment/UseList.tsx` (lines 50-83, 321-384)
- **Treatment Context**: `frontend/src/context/TreatmentContext.tsx`

---

## START TESTING

### First: Verify Chrome Extension is Working
Before testing the application, verify the Chrome extension setup:
1. Run `/chrome` in Claude Code terminal
2. Ask Claude to navigate to http://localhost:5173
3. Ask Claude to take a screenshot
4. If you see the ALA login page, the extension is working!

### Then: Execute Test Scenarios
Begin with **Scenario 1 (Happy Path)** as it covers the most critical functionality.

Use the Chrome extension to:
- Navigate to pages
- Click buttons and fill forms
- Take screenshots at verification points
- Check browser console for errors

Document everything as you go. If you encounter any blockers (login, CAPTCHAs), handle them manually and tell Claude to continue.

Good luck, QA Engineer!