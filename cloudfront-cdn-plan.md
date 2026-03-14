# CloudFront CDN for Photo Serving

## Context

Currently, every `GET /photos` call generates N unique S3 presigned URLs (one per photo thumbnail) using `@aws-sdk/s3-request-presigner`. These URLs embed a timestamp and signature that change on every request, making them **impossible to cache**. Every thumbnail view hits S3 directly, incurring S3 GET costs and data transfer costs with no edge delivery benefit.

CloudFront signed URLs solve this by stripping signature query params before computing the cache key. Two users requesting the same thumbnail get the same cache entry — after the first PoP miss, all subsequent requests are served from CloudFront edge at zero S3 cost. Thumbnails are immutable once generated, so cache hit ratios approach 100% for returning users.

**Why CloudFront signed URLs over S3 presigned URLs:**
- S3 presigned URLs: unique per request (timestamp in signature) → 0% cache hit ratio
- CloudFront signed URLs: signature stripped before cache key → high cache hit ratio
- CloudFront data transfer: cheaper than S3 data transfer out
- Edge delivery: 450+ PoPs globally vs. single ap-southeast-1 region
- OAC (Origin Access Control): S3 remains fully private, accessible only via CloudFront

**What stays unchanged:**
- Upload flow: presigned PUT URLs go directly to S3 (CloudFront doesn't support PUT)
- Glacier restore flow: `GET /files/restore` endpoint and restore pipeline unaffected
- Thumbnails for Glacier photos: thumbnails are NOT tagged `media-type=original`, so they stay STANDARD and are served normally via CloudFront

---

## Architecture

```
Before:
  Browser → GET /api/photos → BFF → API GW → manage-photos Lambda
                                                    ↓ getSignedUrl() × N (per photo)
                                              Returns: ?X-Amz-Signature=...&X-Amz-Date=... (NOT cacheable)
                                              Browser → S3 directly (N origin fetches per page load)

After:
  Browser → GET /api/photos → BFF → API GW → manage-photos Lambda
                                                    ↓ cfSignedUrl() × N (CloudFront-Signature=...)
                                              Returns: https://xxx.cloudfront.net/users/.../thumbnails/file.jpg?CloudFront-Policy=...

  Browser → CloudFront Edge PoP
                ↓ validate CloudFront-Signature (at edge, no origin call)
                ↓ strip signing params → cache key = /users/{sub}/thumbnails/file.jpg
                → HIT: serve from edge (zero S3 calls) ← target 90%+ for return visits
                → MISS: fetch from S3 via OAC (once per file per PoP)
                              ↓
                         S3 bucket (private, OAC only — no direct public/Lambda read access)
```

---

## Implementation Steps

### Step 0: Bootstrap CloudFront Key Pair (one-time manual step)

CloudFront signed URLs require an RSA key pair. CDK needs the **public key PEM** at synth time; the private key lives in Secrets Manager only.

```bash
# Generate RSA key pair
openssl genrsa -out cf-private.pem 2048
openssl rsa -pubout -in cf-private.pem -out cf-public.pem

# Store private key in Secrets Manager
aws secretsmanager create-secret \
  --name "psilo/cloudfront-private-key" \
  --secret-string file://cf-private.pem \
  --region ap-southeast-1
# Save the returned SecretARN

# Delete local key files immediately
rm cf-private.pem

# Add to GitHub repo secrets:
# CLOUDFRONT_PUBLIC_KEY_PEM = content of cf-public.pem
# CLOUDFRONT_PRIVATE_KEY_SECRET_ARN = ARN from above
rm cf-public.pem
```

---

### Step 1: `infrastructure/lib/constructs/cdn.ts` (NEW — already implemented)

- CloudFront `Distribution` with S3 OAC origin
- `PublicKey` + `KeyGroup` for signed URL validation
- `Secret.fromSecretCompleteArn` to reference the private key in Secrets Manager — use the **full ARN including the 6-char suffix** (e.g. `...secret:psilo/cloudfront-private-key-4cRyP2`). Using `fromSecretPartialArn` with a complete ARN breaks `grantRead` because CDK appends an extra `-??????` wildcard, causing IAM to deny `GetSecretValue`.
- Per-path cache behaviors:

| Path | Default TTL | Max TTL | Rationale |
|---|---|---|---|
| `users/*/thumbnails/*` | 24h | 7d | Immutable once generated |
| `users/*/videos/*` | 1h | 24h | Large files, reasonable TTL |
| Default (`*`) | 1h | 24h | Photo originals, previews |

- All cache policies: `queryStringBehavior: none()` — CloudFront strips `CloudFront-Signature`, `CloudFront-Policy`, `CloudFront-Key-Pair-Id` before computing cache key

---

### Step 2: `services/shared/cloudfront.ts` (NEW — already implemented)

- `getPrivateKey()`: fetches RSA private key from Secrets Manager; module-level cache means **one Secrets Manager call per Lambda container lifetime** (cold start only)
- `cfSignedUrl(key, privateKey, expiresInSeconds)`: builds `https://{CLOUDFRONT_DOMAIN}/{key}` and signs with `@aws-sdk/cloudfront-signer`
- Env vars consumed: `CLOUDFRONT_PRIVATE_KEY_SECRET_ARN`, `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`

---

### Step 3: `infrastructure/lib/constructs/api.ts` (MODIFIED — already implemented)

Added to `managePhotosFn` and `manageAlbumsFn`:
```typescript
CLOUDFRONT_DOMAIN: cdn.cloudfrontDomain,
CLOUDFRONT_KEY_PAIR_ID: cdn.keyPairId,
CLOUDFRONT_PRIVATE_KEY_SECRET_ARN: cdn.privateKeySecret.secretArn,
USE_CLOUDFRONT: "true",  // feature flag for safe rollback
```
Plus `cdn.privateKeySecret.grantRead(fn)` for both Lambdas.

---

### Step 4: `infrastructure/lib/stack.ts` (MODIFIED — already implemented)

- Instantiates `CdnConstruct` with bucket, public key PEM, and secret ARN from env
- Passes `cdn` to `ApiConstruct`
- Outputs `CloudFrontDomain`

---

### Step 5 & 6: `services/manage-photos/src/handler.ts` + `services/manage-albums/src/handler.ts` (MODIFIED — already implemented)

Feature-flagged via `USE_CLOUDFRONT` env var:
```typescript
const USE_CF = process.env.USE_CLOUDFRONT === "true";
const privateKey = USE_CF ? await getPrivateKey() : null;
const signUrl = async (key: string) =>
  USE_CF
    ? cfSignedUrl(key, privateKey!)
    : getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: 3600 });
```
Applied to all URL generation: `thumbnailUrl`, `signedUrl` (videos), `previewUrl`, and album cover URLs.

---

### Step 7: `frontend/next.config.ts` (MODIFIED — already implemented)

```typescript
remotePatterns: [
  { protocol: "https", hostname: "*.cloudfront.net" },      // CloudFront (new)
  { protocol: "https", hostname: "*.s3.ap-southeast-1.amazonaws.com" }, // S3 (rollback)
],
```

---

### Step 8: Tests (MODIFIED — already implemented)

Both `manage-photos` and `manage-albums` test files now mock `../../shared/cloudfront` instead of `@aws-sdk/s3-request-presigner`. URLs in assertions updated to `https://xxx.cloudfront.net/signed-url`.

---

### Step 9: `.github/workflows/infrastructure.yml` (MODIFIED — already implemented)

```yaml
- name: Install & Deploy
  env:
    CLOUDFRONT_PUBLIC_KEY_PEM: ${{ secrets.CLOUDFRONT_PUBLIC_KEY_PEM }}
    CLOUDFRONT_PRIVATE_KEY_SECRET_ARN: ${{ secrets.CLOUDFRONT_PRIVATE_KEY_SECRET_ARN }}
  run: ...
```

---

## File Change Summary

| File | Type | Status |
|---|---|---|
| `infrastructure/lib/constructs/cdn.ts` | NEW | ✅ Done |
| `infrastructure/lib/constructs/api.ts` | MODIFY | ✅ Done |
| `infrastructure/lib/stack.ts` | MODIFY | ✅ Done |
| `services/shared/cloudfront.ts` | NEW | ✅ Done |
| `services/manage-photos/package.json` | MODIFY | ✅ Done |
| `services/manage-photos/src/handler.ts` | MODIFY | ✅ Done |
| `services/manage-photos/__tests__/handler.test.ts` | MODIFY | ✅ Done |
| `services/manage-albums/package.json` | MODIFY | ✅ Done |
| `services/manage-albums/src/handler.ts` | MODIFY | ✅ Done |
| `services/manage-albums/__tests__/handler.test.ts` | MODIFY | ✅ Done |
| `frontend/next.config.ts` | MODIFY | ✅ Done |
| `.github/workflows/infrastructure.yml` | MODIFY | ✅ Done |

---

## Deployment Checklist

- [ ] **Step 0**: Generate RSA key pair, store private key in Secrets Manager, add both GitHub secrets
- [ ] **CDK type check**: `cd infrastructure && npx tsc --noEmit`
- [ ] **CDK synth**: `cd infrastructure && npm run synth` — verify CloudFront distribution + OAC in template
- [ ] **Service tests**: `cd services/manage-photos && npm test` + `cd services/manage-albums && npm test`
- [ ] **Deploy**: `npx cdk deploy psilo-dev-apse1-stack --require-approval never` (wait 5–15 min for CF rollout)
- [ ] **Smoke test — photos load**: Open dashboard, check DevTools Network tab for `cloudfront.net` requests returning 200
- [ ] **Cache hit test**: Reload page after 10s → thumbnails show `X-Cache: Hit from cloudfront` response header
- [ ] **Security test**: Copy a thumbnail URL, remove `CloudFront-Signature` param → should return HTTP 403
- [ ] **Lambda logs**: Check CloudWatch for `manage-photos` — Secrets Manager call on cold start only, not on warm invocations

---

## Rollback

Set `USE_CLOUDFRONT=false` on `managePhotosFn` and `manageAlbumsFn` via AWS console Lambda env vars — no redeploy needed, propagates in ~1 min. Frontend already accepts both `*.cloudfront.net` and `*.s3.amazonaws.com` remote patterns.
