# FairBloom Admin Web

Responsive administrator workspace that uses the existing FairBloom API. It supports administrator sign-in, pending transaction review, transaction history, member verification, account status and erasure actions, and database backup download.

## Run locally

1. Start the existing backend.
2. Copy `.env.example` to `.env.local`. Set `VITE_API_PROXY_TARGET` to the backend origin (for example `http://localhost:5000`). Keep `VITE_API_URL=/api` so browser requests are same-origin and Vite proxies them to the backend without a CORS error.
3. Run `npm install`, then `npm run dev`.

For production, serve the admin app behind a reverse proxy that forwards `/api` to the backend, or set `VITE_API_URL` to the API URL and allow the web origin in the backend's `CLIENT_ORIGIN`. The app does not implement its own authorization: every protected operation is sent to the backend with the signed-in administrator's bearer token, and non-admin accounts are denied access.

## Backend-supported pages

- Overview: current pending transaction, pending verification, and user totals from existing list endpoints.
- Transaction review and paginated transaction history.
- Verification queue, authenticated document viewing, approval, and reason-required rejection.
- Searchable member directory, account status changes, and confirmed account erasure with an explicit transaction-retention choice.
- Admin-only full backup download.

The application does not modify or add backend endpoints.

## Scripts

| Script                 | What it does                                 |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                    |
| `npm run build`        | Type-check and build static files to `dist/` |
| `npm run preview`      | Serve the built `dist/` locally              |
| `npm run typecheck`    | Type-check only                              |
| `npm run lint`         | Check code with ESLint                       |
| `npm run lint:fix`     | Auto-fix ESLint problems                     |
| `npm run format`       | Format code with Prettier                    |
| `npm run format:check` | Check formatting without changing files      |

## Deploying

The output of `npm run build` is a static site in `dist/`. Any static host works (Vercel, Netlify, Cloudflare Pages, Nginx).
Use build command `npm run build` and output directory `dist`. `VITE_API_URL` is baked in at build time, so set it
in the host's build environment.
