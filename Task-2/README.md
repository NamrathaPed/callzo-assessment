# Task 2: Usage Admin Console

React + Tailwind CSS + Recharts admin console for viewing and editing account usage.
Data comes from the provided mock API (`meetrj/callzo-mock-usage-api`).

## Stack

- React 18 (Vite build)
- Tailwind CSS (styling)
- Recharts (summary chart — the only chart library used)
- No React Router, no Axios, no React Query, no date library — plain `fetch` and
  built-ins, per the "no other libraries" constraint.

## Run it

```bash
cd task2
docker compose up
```

This starts:
- `mock-api` (port 8001) — the provided mock API
- `frontend` (port 3000) — the admin console, Nginx-served

Open http://localhost:3000 in your browser. From inside the frontend container,
the mock API is reachable at `http://mock-api:8001`; Nginx proxies `/api/*` to it.

No manual setup steps. The frontend image is pre-built and published to Docker Hub,
and `docker-compose.yml` references it by `image:`
(`namrathapeddamalla/callzo-task2-frontend:latest`), so `docker compose up` pulls it
and never builds from source.

## Endpoints used

| Endpoint | Purpose |
|---|---|
| `GET /health` | Mock API health check |
| `GET /accounts?page=&page_size=&search=&status=&country=&plan=&date_from=&date_to=&sort_by=&sort_dir=` | Server-side search, sort, filter, paginate |
| `GET /accounts/{id}` | Single account |
| `GET /accounts/summary?date_from=&date_to=` | Aggregated usage series for the chart (fails randomly ~1/5) |
| `GET /accounts/{id}/settings` | Saved drafts keyed by step |
| `PUT /accounts/{id}/settings/step/{step}` | Save one step's data |
| `POST /accounts/{id}/settings/submit` | Finalize all 4 steps |

## Where state lives

**Server state** — accounts list, summary chart, per-account settings drafts. Owned
by the mock API. Fetched via `fetch` and polled every 30s. Cached in React component
state (no data-fetching library used, per stack limits).

**Client state** — UI-only state that never goes to the server:
- Row selection (`Set` of account IDs) — persists across page changes and periodic
  refreshes, so selection is never lost.
- Current view (accounts vs. settings), active form step, local draft field values
  (before autosave commits), filter/sort/pagination values.

**URL state** — intentionally not used. No router is in scope (React Router would be
a fourth library). Navigation between accounts list and settings is in-memory state.
The draft `accountId` is held in `App` state, not the URL. Trade-off: refreshing the
browser loses the selected account and returns to the list. Acceptable for this
scope; a router could add it later.

## Key behaviors

**Server-side table.** Search, status/plan/country filters, sort, and pagination are
all sent to `/accounts`. The mock API returns `total`, `page`, `page_size`, and
`data`; the UI renders from that response.

**Stable row selection.** Selected IDs live in a `Set` that survives page changes
and the 30s refresh. The refresh merges new data without remounting the table, so
the page doesn't jump and selection is preserved.

**Date-range filter.** One filter updates both the table (`/accounts`) and the chart
(`/accounts/summary`) via shared filter state — no full page reload.

**Chart failure handling.** `/accounts/summary` fails randomly ~1/5 calls. The API
client retries 3 times with backoff; if it still fails, the chart shows an inline
error with a retry button, and the rest of the page stays usable.

**4-step settings form.**
- Autosaves each step ~500ms after the last keystroke (debounced `PUT .../step/N`).
- Previous/Next buttons plus clickable step indicators let users move freely.
- Server validation errors (`422`) are shown on the step they belong to, even when
  later steps are already filled. Earlier steps' data is never lost.
- Deliberate API behavior: once step 4 is saved, step 2 may reject `billing_country`.
  The UI shows that error on step 2, keeps all other data, and still allows
  submitting. A notice explains the cross-step interaction.
- Submit (`POST .../submit`) requires all 4 steps saved; shows missing steps if not.

**Loading / empty / error / partial-failure.** Every async view has a loader, empty
state, and error state. The chart has a partial-failure state (inline error + retry)
that doesn't block the table.

**Keyboard & accessibility.** All controls are native `<button>`/`<input>`/`<select>`
elements with proper `<label>` associations, `aria-invalid`/`aria-describedby` on
invalid fields, `aria-sort` on sortable columns, and a skip link. Focus moves to the
first input when a form step changes. Usable at 375px (responsive flex layout,
overflow-x table).

**Failed saves roll back cleanly.** When a step save fails, the local draft is kept
(so the user can fix and re-save), the server error is shown on that step, and the
user is never navigated away or stuck.

## Design decisions & trade-offs

- **Nginx reverse proxy.** The frontend container serves static files and proxies
  `/api/*` to `http://mock-api:8001` on the Docker network. This keeps API calls
  same-origin from the browser (no CORS) and lets Nginx reach mock-api via Docker
  DNS, matching the spec's "reach mock-api at http://mock-api:8001 from inside the
  container."
- **No data-fetching library.** Plain `fetch` with a small retry wrapper. More code
  than React Query, but zero extra dependencies and every request is visible.
- **No router.** Single-page in-memory navigation. Keeps the library count at three
  (React, Tailwind, Recharts) as required.
- **In-process polling.** `setInterval` every 30s for both accounts and summary.
  Simpler than WebSockets; the small data drift between polls is expected and
  handled gracefully.
- **Pre-built image on Docker Hub.** `namrathapeddamalla/callzo-task2-frontend:latest`
  is public, so `docker compose up` pulls it without credentials. Rebuilding is only
  needed if you change the frontend: `docker build -t namrathapeddamalla/callzo-task2-frontend:latest .`

## What I cut and why

- **React Router / URL state.** Would add persistent deep links for account settings,
  but it's a fourth library beyond the allowed stack (React, Tailwind, one chart
  lib). Cut to honor the constraint.
- **React Query / SWR.** Would simplify caching and polling, but is another library.
  Cut; rolled a small custom hook instead.
- **Date-fns / date utilities.** Native `<input type="date">` and `Date` cover the
  spec's `YYYY-MM-DD` needs. Cut to avoid another dependency.
- **Backend persistence of drafts.** Drafts are saved to the mock API per step; no
  separate frontend draft DB. The API is the source of truth.
- **Tests.** No test runner configured for the frontend. Time spent on component
  robustness and edge cases (chart 500, step-2/step-4 interaction, selection
  stability) instead.
- **Per-account cap / audit trail.** Not part of Task 2 scope.

## Failure behavior

| Situation | Result |
|---|---|
| Mock API down | Error state on accounts and chart, with retry |
| `/accounts` 500 | Error state, retry button |
| `/accounts/summary` random 500 | Inline chart error + retry; table unaffected |
| Step save 422 | Error shown on that step; other step data preserved |
| Step save network failure | Retried up to 3×; error shown, draft kept |
| Submit with incomplete steps | 400 returned; missing steps surfaced |
| No results for filters | Empty state with hint to adjust filters |
