'use client'

import { createContext, useContext, useState } from 'react'
import SearchCommand from './SearchCommand'

const SearchCommandContext = createContext<{
  openSearch: () => void
} | null>(null)

export const useSearchCommand = () => {
  const context = useContext(SearchCommandContext)

  if (!context) {
    throw new Error(
      'useSearchCommand must be used within a SearchCommandProvider'
    )
  }

  return context
}

const SearchCommandProvider = ({
  initialStocks,
  children,
}: {
  initialStocks: StockWithWatchlistStatus[]
  children: React.ReactNode
}) => {
  const [open, setOpen] = useState(false)

  return (
    <SearchCommandContext.Provider value={{ openSearch: () => setOpen(true) }}>
      {children}
      <SearchCommand open={open} setOpen={setOpen} initialStocks={initialStocks} />
    </SearchCommandContext.Provider>
  )
}

export default SearchCommandProvider
