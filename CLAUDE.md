# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (`cd frontend`)

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
npm run test:coverage
```

Run a single test file:

```bash
npx vitest run __tests__/unit/api/auth/login/route.test.ts
```

### Infrastructure (`cd infrastructure`)

```bash
npm run build        # tsc compile
npm run test         # Jest
npm run synth        # cdk synth
npm run diff         # cdk diff
npx cdk deploy psilo-dev-apse1-stack --require-approval never
```

### Services (each has its own `node_modules`)

```bash
cd services/generate-presigned-url && npm install
cd services/user-provisioning && npm install
```

Run service tests:

```bash
cd services/generate-presigned-url && npm test
cd services/user-provisioning && npm test
```

## Pre-commit hooks

Husky runs automatically on commit:

- `lint-staged` runs ESLint on staged `frontend/**/*.{ts,tsx}` files
- If `frontend/` files are staged: runs `tsc --noEmit`, `vitest run`, and `next build`
- If `services/generate-presigned-url/` files are staged: runs `npm test` in that service
- If `services/user-provisioning/` files are staged: runs `npm test` in that service
- If `infrastructure/` files are staged: runs `npm test` in infrastructure

Fix type errors and failing tests before committing.

## Architecture

### Monorepo structure

Loose monorepo — no workspace manager (turbo/nx). Each package manages its own `node_modules`.

```
frontend/        Next.js 16 (App Router) — user-facing app
infrastructure/  AWS CDK — provisions all AWS resources
services/
  generate-presigned-url/  Lambda — returns S3 presigned PUT URLs
  manage-photos/           Lambda — list, delete photos; route via event.routeKey
  manage-albums/           Lambda — CRUD albums and album-photo associations
  user-provisioning/       Lambda — runs post-Cognito-confirmation to create S3 user folder
```

### AWS infrastructure

All resources are defined in `infrastructure/lib/stack.ts`:

- **S3 bucket** (`psilo-{account}`): user file storage, private, scoped per user via `users/{userId}/` key prefix
- **Cognito User Pool**: email-based auth, triggers `user-provisioning` Lambda on post-confirmation
- **API Gateway (HTTP API)**: single route `POST /files/presign`, protected by Cognito JWT authorizer
- **Lambdas**: bundled via `NodejsFunction` (esbuild), Node.js 22

CI/CD in `.github/workflows/infrastructure.yml` deploys on push to `main` when `infrastructure/**` or `services/**` change, using OIDC for AWS credentials.

### Auth flow

1. Login via `POST /api/auth/login` (Next.js API route) → calls Cognito SDK directly
2. Tokens stored as **httpOnly cookies**: `access_token`, `id_token`, `refresh_token`
3. `AuthContext` tracks `isAuthenticated` state client-side (no token access from browser)
4. Protected routes check auth via middleware/layout

### File upload flow

1. `FileDropZone` supports **multiple files**. On selection, all presigned URLs are fetched in parallel first (`Promise.all`), then all files are uploaded in parallel, then `onUploadComplete` is called **once** after all finish.
2. Next.js API route reads `access_token` cookie → calls API Gateway `POST /files/presign` with `Authorization: Bearer <token>`
3. Lambda validates JWT, scopes S3 key to `users/{sub}/{filename}`, returns presigned PUT URL
4. Client uses `XMLHttpRequest` to PUT file directly to S3 with real progress tracking per file

### Frontend conventions

- **Route groups**: `(auth)` for public auth pages, `(protected)` for authenticated pages
- **API routes** act as a proxy/BFF: they hold secrets, read httpOnly cookies, and forward to the real backend
- **`app/lib/api.ts`**: client-side fetch wrapper — use `api.post()` / `api.get()` for Next.js API routes (not raw `fetch`)
- **`app/lib/env.server.ts`**: validated server-side env vars (import only in server components/routes)
- **`app/lib/services/`**: service modules that wrap `api.*` calls (e.g. `auth.services.ts`, `cognito.service.ts`, `photo.service.ts`, `album.service.ts`)
- UI components from **shadcn/ui** (new-york style), added via `npx shadcn add <component>`

### Shared photo UI components (`frontend/app/(protected)/components/`)

- **`PhotoGrid`** — reusable grid for displaying photos. Props: `photos`, `selectedIds`, `onToggleSelect`, `onDeleteRequest`, `onPhotoClick`. Shows check icon (top-left) and trash button (top-right) on hover; selected photos get a `border-primary` ring.
- **`DeleteConfirmDialog`** — `AlertDialog` for single (`photo` prop) or bulk (`bulkCount` prop) delete confirmation. Pass only one at a time.
- **`ImageViewer`** — fullscreen `Dialog` + Embla `Carousel`. Props: `photos`, `initialIndex` (null = closed), `onClose`. Supports arrow key navigation and Escape to close. Uses explicit `width`/`height` props on `Image` (not `fill`) with `max-h-[calc(90vh-4rem)]` CSS constraint — do **not** switch to `fill` as the carousel's internal `overflow-hidden` breaks height propagation.
- **`FileDropZone`** — drag-and-drop / click-to-browse uploader with per-file progress bars.

### Bulk selection pattern (dashboard & album pages)

1. `selectedIds: Set<string>` + `setSelectedIds` state in the page
2. `bulkDeletePending / bulkRemovePending: boolean` state gates the confirm dialog
3. "Delete selected" button sets pending flag → `<DeleteConfirmDialog bulkCount={...}>` opens → confirm runs actual delete → clears both flag and selection
4. Individual delete also removes the photo from `selectedIds`

### shadcn/ui components installed

`alert-dialog`, `button`, `card`, `carousel` (embla-carousel-react), `dialog`, `input`, `label`, `navigation-menu`, `sonner`

### Testing conventions (frontend)

- Tests live in `frontend/__tests__/unit/`, mirroring the `app/` structure
- Mock `next/headers`, `env.server`, and service modules with `vi.mock()`
- Test API routes by directly calling the exported handler (e.g. `POST(req)`) with a real `NextRequest`

## Environment variables

Frontend (`.env.local`):
| Variable | Used in |
|---|---|
| `BACKEND_API_URL` | Server-only — API Gateway base URL |
| `COGNITO_USER_POOL_ID` | Server-only |
| `COGNITO_APP_CLIENT_ID` | Server-only |
| `AWS_REGION` | Server-only |
| `NODE_ENV` | Server-only — set automatically by Next.js |

`BACKEND_API_URL` is the `HttpApiUrl` output from CDK deploy.

## Workflow

- Always run `npx tsc --noEmit` after making changes across multiple files to catch missed consumer files and type errors before committing.

## Conventions

- When making API calls in the Next.js frontend, use the project's existing API library (e.g., `api.post()`, `api.get()`) — never use raw `fetch` directly.

## Performance

- For bulk changes across many files (10+), prefer using `sed` or scripted batch operations instead of editing files one by one to reduce token usage.

## Testing

- This project uses TypeScript with Next.js and AWS CDK. Always run tests (`npm test` or equivalent) after modifying test files or code that has test coverage. Ensure jest types are included in tsconfig for test files.
- Be careful with server-only imports (e.g., `import 'server-only'`) in utility modules — they will break Jest tests. Keep test-compatible code separate from server-only modules.
