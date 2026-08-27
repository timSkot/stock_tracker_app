import Image from 'next/image'
import Link from 'next/link'
import NavItems from './NavItems'
import UserDropdown from './UserDropdown'
import SearchCommandProvider from './SearchCommandProvider'
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
        <SearchCommandProvider initialStocks={initialStocks}>
          <nav className='hidden sm:block'>
            <NavItems />
          </nav>
          <UserDropdown user={user} />
        </SearchCommandProvider>
      </div>
    </header>
  )
}

export default Header
