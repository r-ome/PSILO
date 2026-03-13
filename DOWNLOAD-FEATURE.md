# Download / Glacier Restore Feature

## Overview

This document covers the design, data flow, and user journey for the photo download feature implemented in this session. The feature handles two distinct cases:

1. **STANDARD storage** — photos are served via a presigned S3 GET URL immediately.
2. **GLACIER storage** — photos must be restored from Glacier first; the user receives an email with a download link when the restore completes.

---

## New Files

### Backend (Lambda services)
| Path | Description |
|---|---|
| `services/request-restore/src/handler.ts` | `POST /files/restore` — ownership check, HeadObject, presigned URL or RestoreObject |
| `services/handle-restore-completed/src/handler.ts` | EventBridge trigger — sends SES email when Glacier restore finishes |

### Frontend
| Path | Description |
|---|---|
| `frontend/app/(protected)/components/DownloadModal.tsx` | Modal with tier selection for Glacier, immediate download for STANDARD |
| `frontend/app/lib/services/download.service.ts` | Client-side service wrapping `POST /api/files/restore` |
| `frontend/app/api/files/restore/route.ts` | Next.js BFF route — reads `access_token` cookie, forwards to API Gateway |
| `frontend/app/components/ui/dropdown-menu.tsx` | shadcn/ui DropdownMenu component (installed via `npx shadcn add`) |

### Modified Files
| Path | Change |
|---|---|
| `frontend/app/lib/services/photo.service.ts` | Added `storageClass: "STANDARD" \| "GLACIER"` to `Photo` interface |
| `frontend/app/(protected)/components/ImageViewer.tsx` | Replaced "Add to Album" button with `DropdownMenu` (⋯) containing Download + Add to Album |
| `frontend/app/(protected)/dashboard/page.tsx` | Added Download button to bulk selection bar |
| `frontend/app/(protected)/albums/[albumId]/page.tsx` | Added Download Album button to header actions |
| `infrastructure/lib/stack.ts` | Added 2 Lambdas, 1 API route, 1 EventBridge rule, IAM permissions |

---

## Architecture

```
Browser
  │
  │  POST /api/files/restore { keys, tier }
  ▼
Next.js BFF (/api/files/restore/route.ts)
  │  reads access_token cookie
  │  POST /files/restore  Authorization: Bearer <token>
  ▼
API Gateway (JWT authorizer)
  │
  ▼
request-restore Lambda
  │  1. Verify ownership: SELECT from photos WHERE s3Key IN keys AND userId = sub
  │  2. HeadObject each key → get actual S3 storage class + Restore header
  │  3a. STANDARD or restored copy available → GetObjectCommand presigned URL (1hr, attachment)
  │  3b. GLACIER not yet restored → RestoreObjectCommand (tier, Days=7)
  │     catch RestoreAlreadyInProgress → flag it
  │
  ▼
{ standardUrls, glacierInitiated, glacierAlreadyInProgress }
  │
  ▼
Browser
  │  standardUrls → triggerDownload() per URL (50ms offset, avoids popup blocker)
  │  glacierInitiated → show "Restore started — email coming" message
  │  glacierAlreadyInProgress → show "Restore already in progress" message


─ ─ ─ ─ ─ ─ ─ ─ ─ ─  async, when restore finishes  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

S3 (Glacier restore completes)
  │  emits: Object Restore Completed (EventBridge)
  ▼
EventBridge Rule (S3RestoreCompletedRule)
  │  filter: source=aws.s3, detailType=Object Restore Completed, bucket=psilo-<account>
  ▼
handle-restore-completed Lambda
  │  1. URL-decode object key from event.detail.object.key
  │  2. SELECT photo from photos WHERE s3Key = key
  │  3. SELECT user from users WHERE id = photo.userId
  │     fallback: AdminGetUser from Cognito if user row missing from DB
  │  4. GetObjectCommand presigned URL (7 days, attachment disposition)
  │  5. SES SendEmail → user's email with download link
  ▼
User receives email with 7-day download link
```

---

## `request-restore` Lambda — Key Design Decisions

### HeadObject before deciding action
The Lambda always calls `HeadObject` to read the **actual S3 storage class**, rather than trusting the DB's `storageClass` column. This handles the race condition where:
- S3 lifecycle rule has already transitioned the object to Glacier
- But the `lifecycle-transition` EventBridge event hasn't fired yet
- So the DB still says `"STANDARD"`

Without this check, we'd generate a presigned `GetObjectCommand` URL for a Glacier object — which S3 would reject at download time.

### Restore states handled
| `StorageClass` (HeadObject) | `Restore` header | Action |
|---|---|---|
| `STANDARD` | — | Presigned URL → immediate download |
| `GLACIER` | absent | `RestoreObjectCommand` → email when done |
| `GLACIER` | `ongoing-request="true"` | Caught as `RestoreAlreadyInProgress` → message to user |
| `GLACIER` | `ongoing-request="false"` | Restored copy available → presigned URL → immediate download |

### Ownership verification
Before any S3 call, the Lambda queries the DB for all requested keys scoped to the authenticated user's `sub`. If the count doesn't match the requested keys, it returns 403.

---

## `handle-restore-completed` Lambda — Key Design Decisions

### Cognito fallback for missing users
Users who registered before the `users` DB table was populated (e.g., before migrations ran) won't have a row in the `users` table. Rather than failing silently, the Lambda falls back to `AdminGetUser` from Cognito to resolve the email and given name.

```
SELECT from users WHERE id = userId
  ├─ found → use email + givenName from DB
  └─ not found → AdminGetUser(userId) from Cognito → use email + given_name attributes
```

### IAM permissions added
- `cognito-idp:AdminGetUser` on the User Pool
- `ses:SendEmail` on `*`
- `s3:GetObject` (via `grantRead`)

### SES sender requirement
The `SES_FROM_EMAIL` must be a domain you own and have verified in SES (with SPF + DKIM DNS records). **Gmail addresses cannot be used** as the `From` address via SES — Gmail enforces DMARC `p=reject`, which causes receiving mail servers to reject the email outright.

---

## Frontend — `DownloadModal`

### Props
```typescript
{ isOpen: boolean, onClose: () => void, photos: Photo[] }
```

### Logic
1. Splits `photos` into `standardPhotos` and `glacierPhotos` based on `storageClass`.
2. If **no Glacier** → single Download button → presigned URLs returned → `triggerDownload()` per file.
3. If **any Glacier** → shows tier selection cards with speed + pricing, then "Request Restore" button.
4. On success, triggers immediate downloads for any `standardUrls` in the response; shows inline message for glacier items.

### Glacier restore tiers
| Tier | Speed | Cost |
|---|---|---|
| Expedited | 1–5 min | $0.03/GB + $0.01/1,000 requests |
| Standard | 3–5 hrs | $0.01/GB + $0.05/1,000 requests |
| Bulk | 5–12 hrs | $0.025/1,000 requests |

### Download trigger
```typescript
function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```
Multiple files are triggered with a 50ms offset each to avoid browser popup blockers.

---

## User Journeys

### Journey 1 — Download a STANDARD photo (ImageViewer)
1. User opens a photo in the fullscreen viewer.
2. Clicks ⋯ menu → "Download".
3. `DownloadModal` opens — shows "1 photo ready to download."
4. User clicks "Download".
5. `POST /api/files/restore` → Lambda calls `HeadObject` → STANDARD → presigned URL returned.
6. Browser Save dialog appears immediately.

### Journey 2 — Download a Glacier photo (first request)
1. User opens a Glacier-archived photo in the viewer.
2. Clicks ⋯ → "Download".
3. `DownloadModal` opens — shows tier selection (Expedited / Standard / Bulk).
4. User selects "Expedited" → clicks "Request Restore".
5. Lambda calls `RestoreObjectCommand` with `Tier: "Expedited"`.
6. Modal shows: "Restore started — you'll receive an email when your Glacier photos are ready."
7. 1–5 minutes later, S3 emits `Object Restore Completed` → EventBridge → `handle-restore-completed` Lambda.
8. Lambda generates 7-day presigned URL → sends SES email.
9. User clicks link in email → file downloads.

### Journey 3 — Download a Glacier photo (already restored)
1. User opens the same Glacier photo again after restore completed.
2. Clicks ⋯ → "Download" → "Download" button in modal.
3. Lambda calls `HeadObject` → sees `ongoing-request="false"` → restored copy available.
4. Returns presigned URL → browser Save dialog appears immediately (no email needed).

### Journey 4 — Bulk download from dashboard
1. User enables Select mode on the dashboard.
2. Selects multiple photos (mix of STANDARD and GLACIER).
3. Clicks "Download" in the selection bar.
4. `DownloadModal` opens — shows count breakdown.
5. STANDARD photos download immediately; Glacier ones trigger restore with chosen tier.

### Journey 5 — Download entire album
1. User navigates to an album detail page.
2. Clicks "Download Album" in the header.
3. Same `DownloadModal` flow as Journey 4, scoped to all photos in the album.

---

## Infrastructure Changes (`stack.ts`)

```
RequestRestoreFn
  ├─ entry: services/request-restore/src/handler.ts
  ├─ runtime: Node.js 22
  ├─ timeout: 29s
  ├─ env: BUCKET_NAME, DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME
  └─ IAM: s3:GetObject (grantRead), s3:RestoreObject (users/*), RDS Data API, Secrets Manager

HandleRestoreCompletedFn
  ├─ entry: services/handle-restore-completed/src/handler.ts
  ├─ runtime: Node.js 22
  ├─ timeout: 30s
  ├─ env: BUCKET_NAME, SES_FROM_EMAIL, USER_POOL_ID, DB_*
  └─ IAM: s3:GetObject (grantRead), ses:SendEmail (*), cognito-idp:AdminGetUser, RDS Data API, Secrets Manager

API Gateway
  └─ POST /files/restore → RequestRestoreFn (JWT authorizer)

EventBridge Rule (S3RestoreCompletedRule)
  ├─ source: aws.s3
  ├─ detailType: Object Restore Completed
  ├─ detail.bucket.name: psilo-<account>
  └─ target: HandleRestoreCompletedFn
```
