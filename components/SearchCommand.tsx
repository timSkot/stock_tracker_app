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
    let ignore = false

    const timeoutId = setTimeout(() => {
      searchStocks(trimmed).then((results) => {
        if (ignore) return
        setStocks(results)
        setLoading(false)
      })
    }, 300)

    return () => {
      ignore = true
      clearTimeout(timeoutId)
    }
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
