# Stock Search Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working `⌘K`/`Ctrl+K` stock search command dialog to the app header, backed by a server action that uses Finnhub when a key is configured and otherwise degrades to a small local dataset.

**Architecture:** A new server action (`lib/actions/finnhub.actions.ts`) exposes `searchStocks(query?: string)`. A new client component (`components/SearchCommand.tsx`) renders the existing `cmdk`-based `Command`/`CommandDialog` primitives, calls `searchStocks` on open and on debounced query change, and owns the global `⌘K` listener. `NavItems.tsx` (already a client component) owns the dialog's open/close state and renders `SearchCommand`; its "Search" nav entry becomes a button instead of a dead link. `Header.tsx` (server component) fetches the initial popular-stocks list once and passes it down.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `cmdk` (via `components/ui/command.tsx`), `@base-ui/react` Dialog (via `components/ui/dialog.tsx`), `tsx` for standalone verification scripts (existing pattern: `scripts/test-db.ts`).

## Global Constraints

- No automated test framework (Jest/Vitest/RTL) exists in this repo and none is being introduced — verification for the server action uses a standalone `tsx` script (mirroring the existing `scripts/test-db.ts` convention); verification for UI/wiring is manual via the dev server.
- `isInWatchlist` on every returned stock is hardcoded `false` — no watchlist model/persistence exists and none is added by this plan.
- Selecting a search result only closes the dialog — no navigation, no stock details page, no new route is added.
- No `/search` page route is created — the existing "Search" nav entry becomes a button that opens the dialog instead of linking to a page.
- An empty `FINNHUB_API_KEY=` line is added to `.env`; when unset, `searchStocks` must never make a network call and must never throw.
- Follow the existing code style already in the repo: single quotes, no semicolons in `.tsx`/`.ts` app code (see `Header.tsx`, `NavItems.tsx`, `lib/constants.ts`), double quotes in `components/ui/*` (shadcn-generated files use TS with double quotes — do not touch those files' style, only add new files/edits matching their respective existing file's own style).

---

### Task 1: Fix duplicate `SearchCommandProps` type

**Files:**
- Modify: `types/global.d.ts:58-62` and `types/global.d.ts:171-178`

**Interfaces:**
- Produces: a single `SearchCommandProps` type used by Task 3 (`SearchCommand.tsx`):
  ```ts
  type SearchCommandProps = {
    open?: boolean
    setOpen?: (open: boolean) => void
    initialStocks: StockWithWatchlistStatus[]
  }
  ```

There are currently two conflicting declarations of `SearchCommandProps` in this file (one near line 58, one near line 171). This task merges them into one, dropping the trigger-styling fields (`renderAs`, `buttonLabel`, `buttonVariant`, `className`) since no component in this plan renders its own trigger button — `NavItems` owns the trigger.

- [ ] **Step 1: Confirm the current baseline compiles**

Run: `npx tsc --noEmit`
Expected: no errors (this file isn't imported by any component yet, so the duplicate declaration doesn't currently cause a conflict — this step just establishes a clean baseline to compare against).

- [ ] **Step 2: Remove the first `SearchCommandProps` declaration**

In `types/global.d.ts`, delete this block (around line 58):

```ts
  type SearchCommandProps = {
    renderAs?: 'button' | 'text'
    label?: string
    initialStocks: StockWithWatchlistStatus[]
  }
```

- [ ] **Step 3: Replace the second `SearchCommandProps` declaration with the merged shape**

Find this block (around what was originally line 171, now a few lines earlier after Step 2's deletion):

```ts
  type SearchCommandProps = {
    open?: boolean
    setOpen?: (open: boolean) => void
    renderAs?: 'button' | 'text'
    buttonLabel?: string
    buttonVariant?: 'primary' | 'secondary'
    className?: string
  }
```

Replace it with:

```ts
  type SearchCommandProps = {
    open?: boolean
    setOpen?: (open: boolean) => void
    initialStocks: StockWithWatchlistStatus[]
  }
```

- [ ] **Step 4: Verify the file still compiles and only one declaration remains**

Run: `grep -n "type SearchCommandProps" types/global.d.ts`
Expected: exactly one line printed.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add types/global.d.ts
git commit -m "fix: merge duplicate SearchCommandProps type declarations"
```

---

### Task 2: `searchStocks` server action with local fallback dataset

**Files:**
- Create: `lib/actions/finnhub.actions.ts`
- Create: `scripts/test-search.ts`
- Modify: `package.json` (add `test-search` script)
- Modify: `.env` (add empty `FINNHUB_API_KEY=` line — gitignored, local-only, not committed)

**Interfaces:**
- Consumes: ambient global types `Stock`, `StockWithWatchlistStatus`, `FinnhubSearchResult`, `FinnhubSearchResponse` from `types/global.d.ts` (already defined, no import needed — they're declared in a global `declare global` block).
- Produces: `export async function searchStocks(query?: string): Promise<StockWithWatchlistStatus[]>` — consumed by Task 3 (`SearchCommand.tsx`) and Task 4 (`Header.tsx`).

- [ ] **Step 1: Write the verification script against the not-yet-existing action**

Create `scripts/test-search.ts`:

```ts
import { searchStocks } from '../lib/actions/finnhub.actions'

async function run() {
  const popular = await searchStocks()
  if (popular.length === 0) {
    console.error('❌ Expected local fallback stocks for empty query, got empty list')
    process.exit(1)
  }
  console.log(`✅ Empty query returned ${popular.length} popular stocks`)

  const byName = await searchStocks('apple')
  if (!byName.some((s) => s.symbol === 'AAPL')) {
    console.error('❌ Expected query "apple" to match AAPL by name, got:', byName)
    process.exit(1)
  }
  console.log('✅ Query "apple" matched AAPL by company name')

  const bySymbol = await searchStocks('msft')
  if (!bySymbol.some((s) => s.symbol === 'MSFT')) {
    console.error('❌ Expected query "msft" to match MSFT by symbol, got:', bySymbol)
    process.exit(1)
  }
  console.log('✅ Query "msft" matched MSFT by symbol')

  const noMatch = await searchStocks('zzz-not-a-real-stock-zzz')
  if (noMatch.length !== 0) {
    console.error('❌ Expected no matches for a nonsense query, got:', noMatch)
    process.exit(1)
  }
  console.log('✅ Nonsense query returned no matches')

  const allFlaggedOut = popular.every((s) => s.isInWatchlist === false)
  if (!allFlaggedOut) {
    console.error('❌ Expected isInWatchlist to be false for every result')
    process.exit(1)
  }
  console.log('✅ Every result carries isInWatchlist: false')

  console.log('✅ All search action checks passed')
  process.exit(0)
}

run()
```

- [ ] **Step 2: Run it and confirm it fails because the action doesn't exist yet**

Run: `npx tsx scripts/test-search.ts`
Expected: FAIL — module resolution error, e.g. `Cannot find module '../lib/actions/finnhub.actions'`.

- [ ] **Step 3: Implement the server action**

Create `lib/actions/finnhub.actions.ts`:

```ts
'use server'

const LOCAL_STOCKS: Stock[] = [
  { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', type: 'Common Stock' },
  { symbol: 'GOOGL', name: 'Alphabet', exchange: 'NASDAQ', type: 'Common Stock' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', type: 'Common Stock' },
  { symbol: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', type: 'Common Stock' },
  { symbol: 'ORCL', name: 'Oracle Corp', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'INTC', name: 'Intel Corp', exchange: 'NASDAQ', type: 'Common Stock' },
  { symbol: 'AMZN', name: 'Amazon', exchange: 'NASDAQ', type: 'Common Stock' },
  { symbol: 'BABA', name: 'Alibaba Group Hldg Ltd', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'T', name: 'At&t Inc', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'WMT', name: 'Walmart', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'V', name: 'Visa', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'WFC', name: 'Wells Fargo Co New', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'BAC', name: 'Bank Amer Corp', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'HSBC', name: 'Hsbc Hldgs Plc', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'C', name: 'Citigroup Inc', exchange: 'NYSE', type: 'Common Stock' },
  { symbol: 'MA', name: 'Mastercard Incorporated', exchange: 'NYSE', type: 'Common Stock' },
]

function searchLocalStocks(query?: string): Stock[] {
  const q = query?.trim().toLowerCase()

  if (!q) return LOCAL_STOCKS

  return LOCAL_STOCKS.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(q) ||
      stock.name.toLowerCase().includes(q)
  )
}

async function searchFinnhub(query: string): Promise<Stock[]> {
  const apiKey = process.env.FINNHUB_API_KEY
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Finnhub search failed with status ${response.status}`)
  }

  const data: FinnhubSearchResponse = await response.json()

  return data.result.map((item) => ({
    symbol: item.displaySymbol ?? item.symbol,
    name: item.description,
    exchange: item.symbol.includes(':') ? item.symbol.split(':')[0] : 'US',
    type: item.type,
  }))
}

export async function searchStocks(
  query?: string
): Promise<StockWithWatchlistStatus[]> {
  const trimmed = query?.trim()
  let stocks: Stock[]

  if (trimmed && process.env.FINNHUB_API_KEY) {
    try {
      stocks = await searchFinnhub(trimmed)
    } catch (error) {
      console.error('Finnhub search failed, falling back to local stock list', error)
      stocks = searchLocalStocks(trimmed)
    }
  } else {
    stocks = searchLocalStocks(trimmed)
  }

  return stocks.map((stock) => ({ ...stock, isInWatchlist: false }))
}
```

- [ ] **Step 4: Add the empty Finnhub key placeholder to `.env`**

Append this line to `.env`:

```
FINNHUB_API_KEY=
```

Note: `.env` is matched by `.env*` in `.gitignore` — do not `git add` or commit it (it won't be picked up by `git add .` either, and force-adding a secrets file is never appropriate). This edit is local-only and is not part of the commit in Step 8.

- [ ] **Step 5: Add the npm script**

In `package.json`, add to `"scripts"` (alongside the existing `"test-db"` entry):

```json
"test-search": "tsx scripts/test-search.ts"
```

- [ ] **Step 6: Run the verification script and confirm it passes**

Run: `npm run test-search`
Expected:
```
✅ Empty query returned 17 popular stocks
✅ Query "apple" matched AAPL by company name
✅ Query "msft" matched MSFT by symbol
✅ Nonsense query returned no matches
✅ Every result carries isInWatchlist: false
✅ All search action checks passed
```
Exit code 0.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/finnhub.actions.ts scripts/test-search.ts package.json
git commit -m "feat: add searchStocks server action with local fallback dataset"
```

(`.env` is intentionally excluded — see the note in Step 4.)

---

### Task 3: `SearchCommand` component

**Files:**
- Create: `components/SearchCommand.tsx`

**Interfaces:**
- Consumes: `SearchCommandProps` (Task 1), `searchStocks(query?: string): Promise<StockWithWatchlistStatus[]>` (Task 2), and the existing `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` from `@/components/ui/command`.
- Produces: `export default function SearchCommand(props: SearchCommandProps)` — consumed by Task 4 (`NavItems.tsx`).

This component has no standalone runtime harness (no component test framework in this repo — see Global Constraints), so its own task is verified by type-checking only; full interactive behavior is verified once it's wired up in Task 4.

- [ ] **Step 1: Create the component**

Create `components/SearchCommand.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { searchStocks } from '@/lib/actions/finnhub.actions'

const SearchCommand = ({
  open: openProp,
  setOpen: setOpenProp,
  initialStocks,
}: SearchCommandProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = setOpenProp ?? setInternalOpen

  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setOpen(!open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  useEffect(() => {
    if (!open) return

    const trimmed = query.trim()

    if (!trimmed) {
      setStocks(initialStocks)
      setLoading(false)
      return
    }

    setLoading(true)

    const timeoutId = setTimeout(() => {
      searchStocks(trimmed)
        .then(setStocks)
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, open, initialStocks])

  const handleSelect = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title='Search stocks'
      description='Search for a stock by symbol or company name'
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder='Search stocks...'
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading ? (
            <CommandEmpty>Loading...</CommandEmpty>
          ) : stocks.length === 0 ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : (
            <CommandGroup heading={query.trim() ? 'Results' : 'Popular stocks'}>
              {stocks.map((stock) => (
                <CommandItem
                  key={stock.symbol}
                  value={stock.symbol}
                  onSelect={handleSelect}
                >
                  <span className='font-medium'>{stock.symbol}</span>
                  <span className='text-muted-foreground'>{stock.name}</span>
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {stock.exchange}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export default SearchCommand
```

Note `shouldFilter={false}` on the inner `Command` is required: `cmdk` filters rendered items against the input value by default, which would double-filter on top of the server-side filtering already done by `searchStocks` and could hide items unexpectedly.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SearchCommand.tsx
git commit -m "feat: add SearchCommand dialog component"
```

---

### Task 4: Wire search into the header

**Files:**
- Modify: `components/NavItems.tsx`
- Modify: `components/Header.tsx`

**Interfaces:**
- Consumes: `SearchCommand` (Task 3, default export), `searchStocks` (Task 2).

- [ ] **Step 1: Update `NavItems.tsx` to own the dialog's open state and render `SearchCommand`**

Replace the full contents of `components/NavItems.tsx`:

```tsx
'use client'

import { NAV_ITEMS } from '@/lib/constants'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import SearchCommand from './SearchCommand'

const NavItems = ({
  initialStocks,
}: {
  initialStocks: StockWithWatchlistStatus[]
}) => {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'

    return pathname.startsWith(path)
  }

  return (
    <>
      <ul className='flex flex-col sm:flex-row p-2 gap-3 sm:gap-10 font-medium'>
        {NAV_ITEMS.map(({ href, label }) =>
          href === '/search' ? (
            <li key={href}>
              <button
                type='button'
                onClick={() => setSearchOpen(true)}
                className='cursor-pointer hover:text-yellow-500 transition-colors'
              >
                {label}
              </button>
            </li>
          ) : (
            <li key={href}>
              <Link
                href={href}
                className={`hover:text-yellow-500 transition-colors ${
                  isActive(href) ? 'text-gray-100' : ''
                }`}
              >
                {label}
              </Link>
            </li>
          )
        )}
      </ul>

      <SearchCommand
        open={searchOpen}
        setOpen={setSearchOpen}
        initialStocks={initialStocks}
      />
    </>
  )
}

export default NavItems
```

- [ ] **Step 2: Update `Header.tsx` to fetch the popular stocks list and pass it down**

Replace the full contents of `components/Header.tsx`:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import NavItems from './NavItems'
import UserDropdown from './UserDropdown'
import { searchStocks } from '@/lib/actions/finnhub.actions'

const Header = async ({ user }: { user: User }) => {
  const initialStocks = await searchStocks()

  return (
    <header className='sticky top-0 header'>
      <div className='container header-wrapper'>
        <Link href='/'>
          <Image
            src='/assets/icons/logo.svg'
            alt='Signalist logo'
            width={140}
            height={32}
            className='h-8 w-auto cursor-pointer'
          />
        </Link>
        <nav className='hidden sm:block'>
          <NavItems initialStocks={initialStocks} />
        </nav>
        <UserDropdown user={user} />
      </div>
    </header>
  )
}

export default Header
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification via dev server**

Run: `npm run dev`, then in a browser signed in to the app (desktop viewport, ≥ `sm` breakpoint so the nav is visible):

1. Confirm the header shows a "Search" item in the nav.
2. Click "Search" → dialog opens showing a "Popular stocks" group with 17 rows (AAPL, GOOGL, MSFT, META, ORCL, INTC, AMZN, BABA, T, WMT, V, JPM, WFC, BAC, HSBC, C, MA).
3. Press `Escape` → dialog closes.
4. Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) from anywhere on the page → dialog opens.
5. Type `apple` → after ~300ms the list filters down to just the AAPL row under a "Results" heading.
6. Clear the input → list reverts to the full "Popular stocks" group.
7. Type `zzzzz` → list shows "No results found."
8. Click a result row → dialog closes; confirm no navigation happened and no errors were logged to the browser console.

Expected: all 8 checks pass with no console errors.

- [ ] **Step 5: Commit**

```bash
git add components/NavItems.tsx components/Header.tsx
git commit -m "feat: wire stock search dialog into header nav"
```
