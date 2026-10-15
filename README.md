# AuraCraft

AuraCraft is a Next.js development preview with an image-upload prototype. It does not yet include authentication, image generation, project persistence, billing, or a verified production deployment.

## Run locally

Use Node.js 24 (see `.nvmrc`):

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The prototype is at `/test`. No cloud credentials are needed to build, test, or view it.

## Upload safety

Uploads are intentionally unavailable. `GET /api/r2-sign` returns 405, and `POST /api/r2-sign` returns 503. There is no environment switch, static token, or anonymous mode that turns signing on.

`lib/server/upload-handler.ts` defines the tested integration contract for real session verification, durable quota/intent reservation, and storage signing. The public route supplies no integration. `lib/server/r2-signer.ts` preserves the R2 prototype as a dormant server-side helper; it is not invoked by the public route.

The UI and handler accept only declared JPEG/PNG/WebP images up to 5 MiB. These are metadata checks, not validation of file contents. Files must stay private until a server-side verification workflow approves an immutable asset. Presigned URLs are reusable bearer capabilities until expiry, not single-use uploads.

Do not enable the route until the requirements in [the launch checklist](docs/LAUNCH_CHECKLIST.md) are satisfied and tested against an approved non-production R2 account.

## Checks

```sh
npm test              # Node's test runner; no cloud credentials or service calls
npm run lint
npm run typecheck
npm run build
npm run check         # all four checks
npm audit --audit-level=high
```

GitHub Actions runs checks on pull requests and pushes to main. A draft PR is a reviewable safety improvement, not a launch approval. Dependency audit results are a point-in-time check, not a guarantee of security.

## Configuration

There are no required environment variables for the disabled prototype. Existing R2 variables are not read by the route. Future server-side integration will need a private bucket and validated account/bucket configuration, approved credentials, an exact HTTPS app origin, a real session verifier, and durable quotas. Never expose credentials through `NEXT_PUBLIC_*`, committed files, logs, or browser code.

## Remaining launch work

See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) for authentication, storage verification, generation backend, product experience, dependency/security review, staging, and production-domain/TLS requirements. The relationship between this source repository and `auracraft.ai` still needs verification.
