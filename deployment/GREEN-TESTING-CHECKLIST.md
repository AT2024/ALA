# Green Environment Testing Checklist

This checklist helps you test the green environment before switching production traffic.

## Prerequisites
- [ ] SSH connected to Azure VM: `ssh azureuser@20.217.84.100`
- [ ] Located in project directory: `cd ~/ala-improved`

---

## Step 1: Deploy to Green (Without Switching Traffic)

```bash
cd ~/ala-improved/deployment
./test-green-deployment.sh
```

**When prompted "Switch traffic to green? [y/N]:"** → Answer **N**

This deploys to green but keeps production on blue.

---

## Step 2: Verify Green Health

### Check Container Status
```bash
cd ~/ala-improved/deployment
docker ps --filter name=green
```

**Expected:** All green containers show "Up" and "healthy" status

### Check API Health
```bash
docker exec ala-api-green wget -q -O- http://localhost:5000/api/health
```

**Expected:** `{"status":"ok",...}`

### Check Frontend
```bash
docker exec ala-frontend-green wget -q -O- http://localhost | head -10
```

**Expected:** HTML content with `<title>ALA</title>`

---

## Step 3: View Green Logs (In Separate Terminal)

```bash
cd ~/ala-improved/deployment
docker-compose -f docker-compose.bluegreen.yml logs -f api-green frontend-green
```

**Watch for:**
- ✅ No error messages
- ✅ Successful API requests
- ❌ Any crashes or restart loops (if seen, rollback immediately)

Keep this terminal open while testing.

---

## Step 4: Switch Traffic to Green (For Browser Testing)

```bash
cd ~/ala-improved/deployment
./scripts/switch-traffic.sh green
```

**What this does:**
- Switches production traffic to green
- Users now access green environment
- Blue stays running (rollback ready)

---

## Step 5: Manual Browser Testing

### Test 1: Basic Functionality
- [ ] Open: https://ala-app.israelcentral.cloudapp.azure.com
- [ ] Login works (test@example.com / code: 123456)
- [ ] Select procedure type (Insertion)
- [ ] Select patient and create treatment
- [ ] Treatment creation successful

### Test 2: Applicator Processing
- [ ] Scan/add at least 2 applicators
- [ ] Process applicators (full use, faulty, etc.)
- [ ] Navigate to "Use List" page
- [ ] Summary table displays correctly
- [ ] All processed applicators visible

### Test 3: 🔑 KEY TEST - Page Refresh Persistence
- [ ] On UseList page with data visible
- [ ] **Press F5 (or Ctrl+R) to refresh page**
- [ ] **✅ CRITICAL: Data persists after refresh!**
- [ ] All applicators still visible in table
- [ ] Treatment summary still shows correct data

**If data is lost after refresh:** ❌ Rollback immediately (see Step 8)

### Test 4: SessionStorage Verification
- [ ] On UseList page, open DevTools (F12)
- [ ] Go to: Application → Storage → Session Storage
- [ ] Verify keys exist:
  - `currentTreatment` (with treatment data)
  - `processedApplicators` (with applicators array)
  - `availableApplicators` (with available applicators)
  - `individualSeedsRemoved` (with number)

### Test 5: Finalize Treatment
- [ ] Click "Finalize" button
- [ ] Success message appears
- [ ] Redirects to procedure type selection
- [ ] Open DevTools → Session Storage
- [ ] **✅ CRITICAL: All treatment keys removed!**

### Test 6: Browser Close Test
- [ ] Start new treatment, add applicators
- [ ] Navigate to UseList (data visible)
- [ ] **Close entire browser** (not just tab)
- [ ] Reopen browser, navigate to app
- [ ] Login again
- [ ] **✅ CRITICAL: No old treatment data (clean slate)**

---

## Step 6: Monitor Green Environment (30 Minutes)

### Check Container Health
```bash
watch -n 5 'docker ps --filter name=green'
```

**Watch for:**
- ✅ Status stays "Up"
- ✅ Health stays "healthy"
- ❌ Any restarts (if seen, investigate logs)

### Monitor Logs
Keep logs terminal open and watch for:
- ✅ Normal API requests
- ❌ Error messages
- ❌ Stack traces
- ❌ Database connection issues

---

## Step 7: If Everything Works (After 30 Min)

Green is now production. Stop old blue environment:

```bash
cd ~/ala-improved/deployment
docker-compose -f docker-compose.bluegreen.yml stop api-blue frontend-blue
```

**✅ Deployment Complete!**

---

## Step 8: Rollback (If ANY Issues Detected)

**INSTANT ROLLBACK** (takes <30 seconds):

```bash
cd ~/ala-improved/deployment
./rollback --force
```

**This will:**
1. Start blue environment if stopped
2. Switch traffic back to blue
3. Stop green environment

**When to rollback:**
- ❌ Page refresh loses data (main feature broken)
- ❌ SessionStorage not persisting
- ❌ Finalize doesn't clear sessionStorage
- ❌ Any errors in logs
- ❌ Containers crash or restart
- ❌ Users report issues

---

## Step 9: Post-Deployment Verification

After successful deployment and 30 min monitoring:

- [ ] Green environment stable (no errors)
- [ ] Page refresh persistence working
- [ ] Finalize clears sessionStorage properly
- [ ] Browser close clears session
- [ ] No user reports of issues
- [ ] Old blue environment stopped

---

## Quick Reference Commands

### Check Current Environment
```bash
cat ~/ala-improved/deployment/.current-env
```

### View Green Logs
```bash
cd ~/ala-improved/deployment
docker-compose -f docker-compose.bluegreen.yml logs api-green frontend-green
```

### Check Green Health
```bash
cd ~/ala-improved/deployment
./scripts/health-check.sh green
```

### Rollback
```bash
cd ~/ala-improved/deployment
./rollback --force
```

---

## Troubleshooting

### Green containers won't start
- Check logs: `docker-compose -f docker-compose.bluegreen.yml logs green`
- Check .env file: `cat .env`
- Try rebuild: `docker-compose -f docker-compose.bluegreen.yml build --no-cache green`

### Health checks fail
- Check API logs: `docker logs ala-api-green`
- Check database connection
- Verify environment variables

### Page refresh still loses data
- Check browser console for errors
- Verify sessionStorage in DevTools
- Check TreatmentContext.tsx loaded correctly
- **Rollback immediately** and investigate locally

---

## Success Criteria Summary

✅ All tests pass:
- Login works
- Treatment workflow completes
- **Page refresh preserves data** ← KEY
- Finalize clears sessionStorage
- Browser close clears session
- 30 minutes monitoring with no errors

**Only declare success if ALL criteria met!**
