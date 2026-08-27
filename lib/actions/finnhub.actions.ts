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
