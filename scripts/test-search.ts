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
