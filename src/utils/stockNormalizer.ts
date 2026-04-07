const BUILTIN_MAPPINGS: Record<string, string> = {
  BAJFINANCE: "Bajaj Finance Limited",
  HEROMOTOCO: "Hero MotoCorp Ltd.",
  CDSL: "Central Depository Services (India) Limited",
  GOLDIETF: "Goldie ETF",
  CNINFOTECH: "CN Info Technologies Ltd.",
  HDFCBANK: "HDFC Bank Limited",
  INFY: "Infosys Limited",
  TCS: "Tata Consultancy Services Limited",
  RELIANCE: "Reliance Industries Limited",
  WIPRO: "Wipro Limited",
  SBIN: "State Bank of India",
  ICICIBANK: "ICICI Bank Limited",
  AXISBANK: "Axis Bank Limited",
  KOTAKBANK: "Kotak Mahindra Bank Limited",
  LT: "Larsen & Toubro Limited",
  BHARTIARTL: "Bharti Airtel Limited",
  ASIANPAINT: "Asian Paints Limited",
  TITAN: "Titan Company Limited",
  NESTLEIND: "Nestle India Limited",
  MARUTI: "Maruti Suzuki India Limited",
};

const CUSTOM_MAPPING_KEY = "stock_name_mappings";

const buildNameToTicker = (mappings: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(mappings).map(([ticker, name]) => [name.toLowerCase(), ticker]),
  );

export function getCustomMappings(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_MAPPING_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getStockMappings(): Record<string, string> {
  return { ...BUILTIN_MAPPINGS, ...getCustomMappings() };
}

export function normalizeStockName(input: string): string {
  const cleanInput = input.trim();
  const mappings = getStockMappings();
  return mappings[cleanInput.toUpperCase()] || cleanInput;
}

export function getTickerFromName(name: string): string {
  const mappings = getStockMappings();
  const nameToTicker = buildNameToTicker(mappings);
  return nameToTicker[name.toLowerCase()] || name.toUpperCase().replace(/\s+/g, "");
}

export function isSameStock(nameA: string, nameB: string): boolean {
  return normalizeStockName(nameA).toLowerCase() === normalizeStockName(nameB).toLowerCase();
}

export function addCustomMapping(ticker: string, companyName: string): void {
  const custom = getCustomMappings();
  custom[ticker.trim().toUpperCase()] = companyName.trim();
  localStorage.setItem(CUSTOM_MAPPING_KEY, JSON.stringify(custom));
}

export function removeCustomMapping(ticker: string): void {
  const custom = getCustomMappings();
  delete custom[ticker.trim().toUpperCase()];
  localStorage.setItem(CUSTOM_MAPPING_KEY, JSON.stringify(custom));
}
