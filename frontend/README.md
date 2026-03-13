# Psilo — Frontend

Next.js 16 (App Router) frontend for the Psilo personal cloud storage app.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
npm run test:coverage
```

## Environment Variables

Create a `.env.local` file:

```
BACKEND_API_URL=<API Gateway base URL from CDK output>
COGNITO_USER_POOL_ID=<from CDK output>
COGNITO_APP_CLIENT_ID=<from CDK output>
AWS_REGION=<e.g. ap-southeast-1>
```

## Structure

```
app/
  (auth)/           # Public auth pages (login, signup)
  (protected)/      # Authenticated pages
    dashboard/      # Photo grid with infinite scroll, upload, bulk actions
    albums/         # Album list + detail pages
    storage/        # Storage usage breakdown + retrieval cost estimates
    restore-requests/ # Glacier retrieval batches + per-file status
    trash/          # Deleted photos with restore support
    components/     # Shared UI: PhotoGrid, ImageViewer, DeleteConfirmDialog,
                    #   FileDropZone, DownloadModal, NavBar
  api/              # BFF routes (read httpOnly cookies, proxy to API Gateway)
  lib/
    api.ts          # Client-side fetch wrapper (get/post/put/delete)
    services/       # Service modules wrapping api.* calls
    env.server.ts   # Validated server-side env vars
  components/ui/    # shadcn/ui components
```

## Key Conventions

- All backend calls go through BFF API routes under `app/api/` — never call API Gateway directly from the browser
- Use `api.get()` / `api.post()` / `api.put()` / `api.delete()` from `app/lib/api.ts` — never raw `fetch`
- shadcn/ui components added via `npx shadcn add <component>`
- Tests live in `__tests__/unit/`, mirroring the `app/` structure
