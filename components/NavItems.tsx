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
