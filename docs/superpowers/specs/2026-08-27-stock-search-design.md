# Stock Search Command — Design

## Goal

Add a working stock search experience to the header: a `⌘K`/`Ctrl+K` command dialog that lists popular stocks on open and filters as the user types. No live Finnhub key is configured yet, so search must degrade gracefully to a local static dataset rather than break.

Explicitly out of scope (deferred to future work):
- Watchlist model, "add to watchlist" toggle, `isInWatchlist` persistence.
- A stock details page / navigation on result select (selecting a result just closes the dialog for now).

## Current state (relevant facts)

- `types/global.d.ts` already declares `SearchCommandProps` **twice** (once near line 58, once near line 171) with different, inconsistent shapes. This is pre-existing drift, not something introduced by this work — it will be resolved as part of this change.
- `types/global.d.ts` also already declares `Stock`, `StockWithWatchlistStatus`, `FinnhubSearchResult`, `FinnhubSearchResponse` — these are reused as-is.
- `components/ui/command.tsx` already wraps `cmdk` with `Command`, `CommandDialog`, `CommandInput` (has a built-in search icon), `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`. This work builds on top of these primitives — it does not modify them.
- `lib/constants.ts` has `POPULAR_STOCK_SYMBOLS` (ticker-only, no names) and several `*_WIDGET_CONFIG` objects whose `tabs`/`symbolsGroups` already pair some symbols with display names (e.g. `NASDAQ:AAPL` / `Apple`).
- `NavItems.tsx` renders a "Search" link pointing at `/search`, which does not exist and 404s today.
- No `FINNHUB_API_KEY` in `.env`. No watchlist model/collection exists in `database/`.

## Architecture

### 1. Type cleanup (`types/global.d.ts`)

Merge the two `SearchCommandProps` declarations into a single type. Since `SearchCommand` never renders its own trigger in this design (`NavItems` owns the trigger button), the trigger-styling fields from both old declarations (`renderAs`, `label`/`buttonLabel`, `buttonVariant`, `className`) are dropped as unused rather than carried forward speculatively:

```ts
type SearchCommandProps = {
  open?: boolean
  setOpen?: (open: boolean) => void
  initialStocks: StockWithWatchlistStatus[]
}
```

(`initialStocks` kept required since the component's caller — `Header` — will fetch it server-side; `open`/`setOpen` stay optional since `SearchCommand` manages its own state when uncontrolled.)

### 2. Data layer (`lib/actions/finnhub.actions.ts`, new file)

Single exported server action:

```ts
export async function searchStocks(query?: string): Promise<StockWithWatchlistStatus[]>
```

Behavior:
1. If `process.env.FINNHUB_API_KEY` is set, call Finnhub's `/search?q=...` endpoint (empty/no query → skip the network call and go straight to the local dataset, since Finnhub's search needs a non-empty query anyway). On any fetch error or non-OK response, fall through to step 2 instead of throwing.
2. Local fallback dataset: a small hardcoded `Stock[]` built from the symbol/name pairs already present in `MARKET_OVERVIEW_WIDGET_CONFIG.tabs` in `lib/constants.ts` (JPM, WFC, BAC, HSBC, C, MA, AAPL, GOOGL, MSFT, META, ORCL, INTC, AMZN, BABA, T, WMT, V — 17 symbols, exchange taken from the `NYSE:`/`NASDAQ:` prefix, `type: 'Common Stock'`). No new list is invented — this reuses existing data.
   - Empty/no query → return the full local list (acts as "popular stocks").
   - Non-empty query → case-insensitive substring match against symbol or name.
3. Map results to `StockWithWatchlistStatus` with `isInWatchlist: false` (hardcoded — no watchlist model exists yet).

`.env` gets one new, empty line: `FINNHUB_API_KEY=` — so wiring a real key later is a one-line change requiring no code edits.

### 3. `SearchCommand` component (`components/SearchCommand.tsx`, new file)

Client component using `SearchCommandProps`. Renders `CommandDialog` (already sr-only titled) containing `CommandInput` + `CommandList` with `CommandGroup`/`CommandItem` per stock (symbol, name, exchange badge).

- **Open state**: uses `open`/`setOpen` props if provided (controlled), otherwise its own `useState` (uncontrolled). No self-rendered trigger button — the dialog's visibility is driven entirely by its parent (`Header`) or its own internal state plus the global shortcut.
- **Global shortcut**: a `useEffect` keydown listener for `(e.metaKey || e.ctrlKey) && e.key === 'k'`, `preventDefault`, toggle open. Registered once, cleaned up on unmount.
- **Data fetching**: on open (and on debounced query change, ~300ms via a small `useEffect` + `setTimeout`/clear pattern — no new dependency needed), calls `searchStocks(query)` and sets local `results` state. Loading state shows existing `CommandEmpty` text ("Loading...", then "No results found." when settled and empty).
- **Select behavior**: `onSelect` on `CommandItem` just calls `setOpen(false)` (closes dialog). No routing/navigation — explicitly deferred.
- Does **not** implement any watchlist toggle UI — `isInWatchlist` is read from the data purely because the shared type carries it, but no checkbox/star is rendered.

### 4. Wiring into the header

- `Header.tsx` (server component) fetches `initialStocks = await searchStocks()` once and passes it down, so the popular list is ready with zero loading flash the first time the dialog opens.
- `NavItems.tsx`: the "Search" entry stops being a `<Link href="/search">` and becomes a `<button>` that calls a `setOpen(true)` passed down from `Header`. `Header` holds the `open` boolean state and renders one `<SearchCommand open={open} setOpen={setOpen} initialStocks={initialStocks} />` alongside `NavItems`.
- Global `⌘K` still works from anywhere on the page because the listener lives inside `SearchCommand` itself, which is always mounted in the header.

## Data flow summary

1. Page loads → `Header` server-fetches popular stocks once → passed as `initialStocks`.
2. User presses `⌘K` or clicks "Search" in nav → dialog opens, `CommandList` initially shows `initialStocks` (no fetch needed).
3. User types → debounced → `searchStocks(query)` server action runs → local fallback list filtered by substring (or Finnhub if a key is ever added) → list updates.
4. User clicks a result → dialog closes. Nothing else happens (no navigation, no watchlist mutation).

## Error handling

- Finnhub fetch errors/non-OK responses are caught and swallowed, falling back to the static dataset — the user never sees a broken search due to a missing/invalid key.
- Empty query never hits the network — always resolves to the local "popular" list.

## Testing

- Manual verification via dev server: open dialog with `⌘K` and via nav click, confirm popular list appears immediately, type a partial symbol/name (e.g. "app", "goog") and confirm filtering works, confirm selecting a row closes the dialog, confirm no console errors.
- No automated test suite exists in this repo (no test runner configured) — this spec does not introduce one.

## Out of scope / explicit non-goals

- Finnhub API key acquisition/configuration (left empty in `.env`).
- Watchlist persistence (`isInWatchlist` is always `false`).
- Stock details page / navigation on select.
- A dedicated `/search` page route.
