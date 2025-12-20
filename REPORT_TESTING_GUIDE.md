# Report System - Testing Guide

## Quick Start Testing

### Prerequisites
- Ensure you're logged into your shop account on WhatsApp
- You have sales, expenses, and stock transactions in the past 30 days
- Firebase Cloud Storage is enabled in your project

---

## Test Scenario 1: Weekly Report (Last 7 Days)

**Steps:**
1. Send: `4` (Select Weekly Report)
2. Wait for menu to appear
3. Send: `1` (Last 7 days)
4. Wait 60-120 seconds for report generation
5. Receive: ✅ Success message with download URL

**Expected Output:**
```
✅ Weekly Report Generated!

📊 Period: Last 7 days
📥 Download: https://storage.googleapis.com/...pdf?signature=...
```

**Verify:**
- Click the download URL
- PDF opens with 2 pages
- Page 1 shows summary cards and product tables
- Page 2 shows daily breakdown
- All data is accurate

---

## Test Scenario 2: Weekly Report (Last 30 Days)

**Steps:**
1. Send: `4` (Select Weekly Report)
2. Send: `2` (Last 30 days)
3. Wait for generation
4. Receive download URL

**Expected Output:**
```
✅ Weekly Report Generated!

📊 Period: Last 30 days
📥 Download: [URL]
```

---

## Test Scenario 3: Monthly Report

**Steps:**
1. Send: `5` (Select Monthly Report)
2. Send: `1` or `2` (Choose date range)
3. Wait for generation
4. Receive download URL

**Expected Output:**
```
✅ Monthly Report Generated!

📊 Period: Last [7 or 30] days
📥 Download: [URL]
```

---

## Test Scenario 4: Previous Reports

**Prerequisites:**
- Have already generated at least 1 report

**Steps:**
1. Send: `4` (Weekly Report)
2. Menu shows: "Recent Reports:" with dates
3. Send: `3` (First previous report)
4. Receive download URL for that report

**Expected Output:**
```
📊 Weekly Report

📅 Period: 01/11/2025 to 07/11/2025
📥 Download: [URL]
```

---

## Test Scenario 5: Navigation

**Steps:**
1. Send: `4` (Weekly Report menu)
2. Send: `0` (Back)
3. Receive MY_SHOP_MENU

**Expected:**
- Returns to shop menu successfully

---

## Troubleshooting

### Issue: "Failed to generate report"

**Possible Causes:**
1. **No data in Firestore**
   - Solution: Add some sales/expenses first
   - Command: `sold rice 2kg 500`

2. **Cloud Storage not configured**
   - Solution: Ensure Firebase Storage bucket exists
   - Check: Firebase Console → Storage tab

3. **Puppeteer timeout**
   - Solution: Increase timeout in generatePDF()
   - Check: Network connectivity for CDN downloads

4. **Firestore permission error**
   - Solution: Check Firestore security rules
   - Ensure functions can read from shops collection

### Issue: Download URL expires

**Expected Behavior:**
- URLs are valid for 7 days
- After 7 days, users should regenerate or download within the period
- Solution: Refresh download URL via getReportDownloadUrl()

### Issue: Report data is empty or wrong

**Debug Steps:**
1. Check if sales/expenses were recorded:
   - Command: `0` then `2` (Today's Summary)
2. Verify Firestore collections exist:
   - Firebase Console → Firestore Database
   - Check: `shops/{shopId}/summaries/{DDMMYYYY}`
3. Check aggregation logic:
   - Ensure daily summaries have data
   - Verify date parsing in DDMMYYYY format

---

## Performance Expectations

| Operation | Expected Time |
|-----------|---------------|
| Load report menu | < 1 second |
| Generate report (7 days) | 60-90 seconds |
| Generate report (30 days) | 90-120 seconds |
| Upload to Cloud Storage | 5-10 seconds |
| Download URL generation | < 1 second |

---

## Report Validation Checklist

After downloading a PDF, verify:

### Page 1 - Summary
- [ ] Shop name appears in header
- [ ] Owner name visible
- [ ] Business type shown
- [ ] Contact info displayed
- [ ] Report period badge shows correct dates
- [ ] Summary cards show correct totals:
  - [ ] Total Sales > 0
  - [ ] Total Expenses > 0
  - [ ] Profit = Sales - Expenses
  - [ ] Transactions count > 0
- [ ] Top Products table populated (up to 5)
- [ ] Low Moving Products table shown (up to 3)
- [ ] Expense Breakdown by category visible
- [ ] Cogvana watermark appears semi-transparent

### Page 2 - Daily Breakdown
- [ ] Daily data table shows all days in period
- [ ] Date format is DD/MM/YYYY
- [ ] Sales, Expenses, Profit amounts correct
- [ ] Transaction counts accurate
- [ ] Footer shows Cogvana branding
- [ ] Generation date shown in footer
- [ ] Report period type shown (Weekly/Monthly)

### Overall Quality
- [ ] PDF is 2 pages exactly
- [ ] Text is clear and readable
- [ ] Colors are consistent (green=sales, red=expenses, blue=profit)
- [ ] Numbers are currency formatted (KES)
- [ ] Layout looks professional
- [ ] No text is cut off

---

## Database Verification

### Check Firestore Collections

**Command:**
```bash
# Via Firebase CLI
firebase firestore:get /shops/{shopId}/weeklyReports

# Via Firebase Console
Navigate to: Firestore Database → shops → {shopId} → weeklyReports
```

**Expected Structure:**
```
weeklyReports/
├── [reportId1]/
│   ├── id: string
│   ├── shopId: string
│   ├── period: "weekly"
│   ├── dateRange: "last7days"
│   ├── startDate: "05/11/2025"
│   ├── endDate: "11/11/2025"
│   ├── generatedAt: timestamp
│   ├── downloadUrl: string
│   ├── fileSize: number
│   └── cloudStoragePath: string
└── [reportId2]/
    └── ...
```

### Check Cloud Storage

**Via Firebase Console:**
1. Storage → Reports folder
2. Navigate: `reports/{shopId}/weekly/` or `reports/{shopId}/monthly/`
3. Each PDF file should be listed with metadata

**Via gsutil CLI:**
```bash
gsutil ls gs://your-bucket/reports/{shopId}/weekly/
gsutil ls gs://your-bucket/reports/{shopId}/monthly/
```

---

## Logs to Monitor

### Success Indicators
```
[INFO] Starting report generation { shopId: "...", period: "weekly", dateRange: "last7days" }
[INFO] Report data aggregated { shopId: "...", totalSales: 15000, totalExpenses: 5000, profit: 10000 }
[INFO] PDF generated successfully { size: 2458624, shop: "My Shop" }
[INFO] PDF uploaded to Cloud Storage { shopId: "...", reportId: "...", cloudStoragePath: "..." }
[INFO] Report metadata saved to Firestore { shopId: "...", reportId: "...", period: "weekly" }
[INFO] Report generated successfully { shopId: "...", reportId: "...", fileSize: 2458624 }
```

### Error Indicators
```
[ERROR] Failed to aggregate report data { shopId: "...", error: "..." }
[ERROR] Failed to generate PDF { error: "..." }
[ERROR] Failed to upload PDF to Cloud Storage { shopId: "...", error: "..." }
[ERROR] Failed to save report metadata { shopId: "...", error: "..." }
```

---

## Common Test Cases

### Test Case 1: Single Transaction
**Setup:**
- Create 1 sale: `sold rice 2kg 500`

**Expected:**
- Top Products: rice (1 sale, 500 KES)
- Total Sales: 500 KES
- Profit: 500 KES (if no expenses)

### Test Case 2: Mixed Transactions
**Setup:**
- Create 3 sales: rice, sugar, salt
- Create 2 expenses: rent, fuel

**Expected:**
- Top Products: Multiple items sorted by revenue
- Expense Breakdown: 2 categories shown
- Profit = Sales - Expenses

### Test Case 3: Low Moving Products
**Setup:**
- Create sales for 6 different products
- 3 products with high revenue
- 3 products with low revenue

**Expected:**
- Top Products: Top 3 by revenue
- Low Moving: Bottom 3 by revenue

---

## Manual Testing Commands Sequence

**To fully test the system:**

```
# Week 1: Generate some transactions
sold rice 10kg 5000
sold salt 5 1000
paid rent 2000
paid fuel 500
add sugar 20kg

# Week 2: More transactions
sold rice 8kg 4000
sold salt 3 600
paid utilities 300

# Generate reports
4              → Weekly Report
1              → Last 7 days
               → Get download URL

5              → Monthly Report
2              → Last 30 days
               → Get download URL

4              → Weekly Report
3              → Previous report
               → Get previous download URL
```

---

## Rollback/Reset Instructions

If you need to clear all reports and restart:

### Option 1: Delete via Firebase Console
1. Go to Firestore Database
2. Navigate to `shops/{shopId}/weeklyReports`
3. Delete all documents
4. Navigate to `shops/{shopId}/monthlyReports`
5. Delete all documents
6. Go to Cloud Storage
7. Delete folder: `reports/{shopId}/`

### Option 2: Delete via Firebase CLI
```bash
firebase firestore:delete shops/{shopId}/weeklyReports
firebase firestore:delete shops/{shopId}/monthlyReports
gsutil -m rm -r gs://your-bucket/reports/{shopId}/
```

---

## Success Criteria

Report system is working correctly when:

✅ Users can select report options (4 or 5)
✅ Report menu displays with date range options
✅ Reports generate within 60-120 seconds
✅ Download URLs are provided via WhatsApp
✅ PDFs download and open successfully
✅ Report data is accurate and complete
✅ Report styling is professional
✅ Previous reports are accessible
✅ Navigation back works correctly
✅ Bilingual messages display properly
✅ Cloud Storage files are created
✅ Firestore metadata is persistent

---

**Last Updated:** November 11, 2025
**Status:** Ready for Testing ✅

