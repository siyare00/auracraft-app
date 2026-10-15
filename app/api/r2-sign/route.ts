import { createUploadHandler, methodNotAllowed } from '../../../lib/server/upload-handler.ts';

export const runtime = 'nodejs';

// Deliberately unavailable: this repository has no real session verifier, durable
// quota/intent store, or post-upload verification. Do not replace these with an
// environment flag, static browser token, or client-supplied identity.
// See docs/LAUNCH_CHECKLIST.md before wiring up UploadServices.
export const POST = createUploadHandler(null);
export const GET = methodNotAllowed;
