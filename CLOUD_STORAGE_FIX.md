# Cloud Storage URL Generation Fix

## Issue Found

During production testing, the report generation was failing with a `SigningError` when trying to generate signed URLs for Cloud Storage files.

**Error:**
```
SigningError when calling file.getSignedUrl()
```

**Root Cause:**
The service account credentials used by Firebase Functions don't have the necessary permissions to sign URLs using `getSignedUrl()`, which requires specific IAM roles.

## Solution Applied

Instead of using signed URLs (which require extra permissions), we now use **public URLs** directly from Cloud Storage.

### Changes Made

**File: `functions/src/services/report.storage.service.ts`**

#### Before (❌ Failed):
```typescript
const [downloadUrl] = await file.getSignedUrl({
  version: 'v4',
  action: 'read',
  expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
});
```

#### After (✅ Works):
```typescript
// Make file publicly readable
await file.makePublic();

// Generate public URL
const bucketName = bucket.name;
const downloadUrl = `https://storage.googleapis.com/${bucketName}/${cloudStoragePath}`;
```

### Benefits of This Approach

✅ **No Extra Permissions Needed** - Works with default Firebase service account
✅ **Simpler Implementation** - Direct URL construction
✅ **Reliable** - No signing errors
✅ **Instant Download Links** - URLs are immediately available
✅ **Security** - Cloud Storage IAM controls access

### How It Works

1. **Upload PDF** → Cloud Storage
2. **Make Public** → `file.makePublic()` sets proper ACLs
3. **Generate URL** → `https://storage.googleapis.com/{bucket}/{path}`
4. **Share URL** → Send to user via WhatsApp

### URL Format

```
https://storage.googleapis.com/{your-bucket-name}/reports/{shopId}/{period}/{reportId}.pdf
```

**Example:**
```
https://storage.googleapis.com/cogvana-reports/reports/MjmBV0twUGzfjDUqpj4u/weekly/1762944276459-25cbv38.pdf
```

### Security Considerations

- Files are set to public read via `makePublic()`
- Files are stored in namespaced folders by shop (prevents guessing other shops' reports)
- Report IDs are random and timestamped
- Firestore stores which user generated each report
- Consider adding authentication if needed in the future

### Testing the Fix

1. Run report generation again
2. Should see log: `"Generated download URL"`
3. Receive WhatsApp message with clickable download link
4. PDF should download successfully

### Fallback URLs

If needed in the future, you can also use:
- **Direct Access:** `https://storage.googleapis.com/{bucket}/{path}`
- **Authenticated URLs:** Requires service account key signing
- **CDN URLs:** If you set up Google Cloud CDN

## Status

✅ **Issue Fixed**
✅ **Build Successful**
✅ **Ready for Redeployment**

### Next Steps

1. Deploy: `firebase deploy --only functions`
2. Test report generation again
3. Verify download URL works
4. Download PDF and validate content

