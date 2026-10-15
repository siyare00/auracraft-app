# AuraCraft launch checklist

This is an upload prototype, not a finished image-generation application. The safety changes do not enable uploads or launch a public service.

## Implemented in this branch

- `GET /api/r2-sign` returns 405 instead of issuing anonymous write URLs.
- `POST /api/r2-sign` returns 503 until real server-side integrations exist. R2 credentials or environment flags alone cannot enable it.
- A dependency-injected upload handler has tests for authentication, origin checks, bounded metadata bodies, quota reservation, generated per-user pending keys, and generic failures.
- JPEG, PNG, and WebP metadata are accepted up to 5 MiB; active formats such as SVG and HTML are excluded.
- The dormant R2 signer uses a 60-second URL and signed content type and declared content length. It does not return a public object URL.
- The prototype handles cancellation, timeout, repeated clicks, invalid responses, unavailable service, and failed uploads.
- The homepage and metadata identify the actual development status. Builds no longer download Google fonts.

## Required before enabling uploads

1. Choose and integrate account authentication. Verify server-side sessions and map to an immutable internal user ID. Never trust a header, request-body user ID, browser API key, shared static token, or environment bypass flag.
2. Add a durable database for upload intents and ownership, plus atomic per-account request and byte quotas. `reserve` must persist the generated key and declared metadata before signing. Define expiry, cleanup, refund policy for failures, and abuse controls. An in-memory limiter is not enough for multiple workers.
3. Use a private R2 bucket for quarantine. A path called `uploads/pending/` does not make a public bucket private. Confirm bucket privacy and least-privilege credentials in the deployment environment without committing credentials. Supply a validated `R2Config` to `createR2Signer` only on the server.
4. Configure the exact HTTPS app origin and R2 origin. Limit bucket CORS to the intended app origin, PUT, and required headers. CORS is not authentication. Verify that browser-generated `Content-Length` and `Content-Type` match the presigned request in a real R2 integration test.
5. Build a server-side completion/verification workflow. Read actual object size and bytes, check file signatures, safely decode with pixel/dimension limits, perform applicable content/malware checks, reject and remove invalid objects, and publish only validated assets. Claimed MIME type, filename extension, and declared size are not content validation. Keep originals inaccessible. Consider a bounded upload proxy if authoritative pre-storage byte limits are required.
6. Account for presigned URL reuse until expiry, overwrites, and completion races. The current signer does not promise single-use URLs or immutable objects. Ensure consumers use a validated immutable copy/version and cannot race a later PUT.
7. Add end-to-end coverage for login expiry, owner isolation, quota races across workers, invalid binary content, oversized PUTs, malformed headers, URL expiry/replay, failed verification, and cleanup. Test actual R2 behavior with an approved non-production account before wiring `UploadServices` into the route.
8. Review external data handling, retention/deletion, privacy disclosures, terms, and abuse/reporting processes before collecting user uploads.

## Product work still absent

- Confirm product requirements and supported generation/editing flows.
- Choose and authorize a model provider, usage budget, and service credentials; implement an asynchronous generation backend with job status, retries, cancellation, and cost limits.
- Add project persistence, history/gallery, verified asset ownership, user deletion/export, and the final user interface.
- If monetized, define plans and implement/test payments, webhooks, entitlements, refunds, and usage reconciliation.
- Complete accessibility, mobile/responsive, onboarding, empty/error states, and browser end-to-end QA.

## Deployment and release gate

- Verify which hosting project and repository revision serve the intended domain. This repository alone does not establish the production connection to `auracraft.ai`.
- Investigate origin/TLS failures using the authorized hosting and DNS configuration. Do not weaken TLS or claim a site restored from a code-only change.
- Configure approved production secrets, storage, database, origins, monitoring, backup/restore, alerts, and operational ownership.
- Run `npm ci`, `npm run check`, and `npm audit --audit-level=high` with the final lockfile. Resolve applicable advisories; a passing unit suite does not verify a deployment.
- Require review and exact-commit CI before merge. Merging/deploying is a separate release action.
- Complete staging smoke tests and an explicit launch decision. No provider, account, billing, DNS, or deployment changes are performed by this branch.

## References

- [Next.js October 14, 2026 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026): the old 16.0.1 dependency is not an acceptable deployment baseline; use patched 16.4.1 or a later verified safe release.
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/): URLs are bearer capabilities and can be reused until expiry.
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/): configure only required origins, methods, and headers.
