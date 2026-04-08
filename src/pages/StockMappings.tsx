import React, { useMemo, useState } from "react";
import { PortfolioData, StockPortfolio } from "../types";
import { Badge, Button, Card, Input, Table } from "../components/UI";
import { formatCurrency, getCombinedStockHoldings } from "../lib/utils";
import { addCustomMapping, getCustomMappings, getStockMappings, normalizeStockName, removeCustomMapping } from "../utils/stockNormalizer";

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

type RawHoldingRow = {
  key: string;
  portfolioId: string;
  portfolioName: string;
  portfolioLabel: string;
  broker: string;
  ownerName: string;
  rawName: string;
  normalizedName: string;
  ticker: string;
  quantity: number;
  invested: number;
  currentValue: number;
};

type StockAliasEntry = {
  portfolio: string;
  rawName: string;
  normalizedName: string;
  ticker: string;
  currentValue: number;
};

type GroupedStockRow = {
  key: string;
  name: string;
  totalQty: number;
  totalInvested: number;
  totalCurrentValue: number;
  portfolioCount: number;
  aliasCount: number;
  tickers: string[];
  portfolios: string[];
  gainLoss: number;
};

type StockAliasGroup = {
  key: string;
  ticker: string;
  primaryLabel: string;
  isMapped: boolean;
  entries: StockAliasEntry[];
  totalCurrentValue: number;
};

export default function StockMappings({
  data,
  updateData,
}: {
  data: PortfolioData;
  updateData: (d: Partial<PortfolioData>) => void;
}) {
  const [mappingTicker, setMappingTicker] = useState("");
  const [mappingName, setMappingName] = useState("");
  const [sourceSort, setSourceSort] = useState<SortConfig>({ key: "portfolioName", direction: "asc" });
  const [groupSort, setGroupSort] = useState<SortConfig>({ key: "totalCurrentValue", direction: "desc" });
  const [mappingSort, setMappingSort] = useState<SortConfig>({ key: "ticker", direction: "asc" });
  const [portfolioFilter, setPortfolioFilter] = useState("all");
  const customMappings = useMemo(() => getCustomMappings(), [data]);
  const stockMappingView = useMemo(() => buildStockMappingView(data, customMappings), [data, customMappings]);
  const builtInCount = Object.keys(getStockMappings()).length - Object.keys(customMappings).length;

  const toggleSort = (current: SortConfig, key: string): SortConfig =>
    current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" };

  const filteredSourceRows = useMemo(
    () => stockMappingView.rawHoldings.filter((row) => portfolioFilter === "all" || row.portfolioId === portfolioFilter),
    [portfolioFilter, stockMappingView.rawHoldings],
  );
  const sortedSourceRows = sortItems(filteredSourceRows, sourceSort);
  const sortedGroups = sortItems(stockMappingView.groupedStocks, groupSort);
  const sortedMappings = sortItems(
    Object.entries(getStockMappings()).map(([ticker, companyName]) => ({
      ticker,
      companyName,
      type: ticker in customMappings ? "Custom" : "Built-in",
    })),
    mappingSort,
  );

  const draftMatches = useMemo(() => {
    const ticker = mappingTicker.trim().toUpperCase();
    const normalizedDraft = normalizeStockName(mappingName || ticker);
    return stockMappingView.rawHoldings.filter((holding) => {
      const tickerMatch = ticker ? holding.ticker === ticker : false;
      const nameMatch = normalizedDraft ? holding.normalizedName === normalizedDraft : false;
      return tickerMatch || nameMatch;
    });
  }, [mappingName, mappingTicker, stockMappingView.rawHoldings]);

  const draftCurrentValue = draftMatches.reduce((sum, row) => sum + row.currentValue, 0);
  const draftInvested = draftMatches.reduce((sum, row) => sum + row.invested, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-100">Stock Mapping Manager</h2>
        <p className="text-slate-400">Compare all portfolio source lists, group matching stocks together, and validate totals before you add new mappings.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Portfolios" value={String(stockMappingView.summary.portfolios)} helper="Live stock portfolios being compared" />
        <SummaryCard label="Raw Holdings" value={String(stockMappingView.summary.rawHoldings)} helper="Unmerged rows across all portfolios" />
        <SummaryCard label="Grouped Stocks" value={String(stockMappingView.summary.groupedStocks)} helper="After normalization and grouping" />
        <SummaryCard label="Total Invested" value={formatCurrency(stockMappingView.summary.totalInvested)} helper="Cost basis across grouped stocks" />
        <SummaryCard label="Current Value" value={formatCurrency(stockMappingView.summary.totalCurrentValue)} helper={`${formatCurrency(stockMappingView.summary.totalGainLoss)} overall gain or loss`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card title="Create Mapping" subtitle={`Built-in mappings: ${builtInCount}. Custom mappings help merge Groww, Zerodha, and other aliases into one grouped stock report.`}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!mappingTicker.trim() || !mappingName.trim()) return;
              addCustomMapping(mappingTicker, mappingName);
              setMappingTicker("");
              setMappingName("");
              updateData({ settings: { ...data.settings } });
            }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
          >
            <Input label="NSE Code" value={mappingTicker} onChange={(event) => setMappingTicker(event.target.value)} placeholder="BAJFINANCE" />
            <Input label="Company Name" value={mappingName} onChange={(event) => setMappingName(event.target.value)} placeholder="Bajaj Finance Limited" />
            <Button type="submit" className="mt-auto w-full xl:w-auto">
              Add Mapping
            </Button>
          </form>
        </Card>

        <Card title="Draft Check" subtitle="Use this while adding a mapping to confirm how much data will be grouped together.">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Matches" value={String(draftMatches.length)} />
              <MiniStat label="Portfolios" value={String(new Set(draftMatches.map((row) => row.portfolioId)).size)} />
              <MiniStat label="Invested" value={formatCurrency(draftInvested)} />
              <MiniStat label="Current" value={formatCurrency(draftCurrentValue)} />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
              {draftMatches.length === 0
                ? "Start typing a ticker or company name to see matching holdings from all portfolios."
                : `${draftMatches.map((row) => row.portfolioName).filter((value, index, arr) => arr.indexOf(value) === index).join(", ")} will be checked against this mapping draft.`}
            </div>
            <div className="max-h-48 space-y-2 overflow-auto pr-1">
              {draftMatches.slice(0, 8).map((row) => (
                <div key={row.key} className="rounded-xl border border-slate-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-200">{row.rawName}</div>
                      <div className="text-xs text-slate-500">{row.portfolioLabel}</div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>{formatCurrency(row.currentValue)}</div>
                      <div>Qty {row.quantity}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Portfolio Source Lists" subtitle="Review raw names from each portfolio before or while adding holdings and mappings.">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={portfolioFilter === "all"} onClick={() => setPortfolioFilter("all")}>
              All Portfolios
            </FilterChip>
            {stockMappingView.portfolios.map((portfolio) => (
              <div key={portfolio.id}>
                <FilterChip active={portfolioFilter === portfolio.id} onClick={() => setPortfolioFilter(portfolio.id)}>
                  {portfolio.name}
                </FilterChip>
              </div>
            ))}
          </div>
          <Badge variant="info">{filteredSourceRows.length} rows</Badge>
        </div>
        <Table
          headers={[
            { label: "Portfolio", key: "portfolioName" },
            { label: "Raw Stock Name", key: "rawName" },
            { label: "Ticker", key: "ticker" },
            { label: "Grouped Name", key: "normalizedName" },
            { label: "Qty", key: "quantity" },
            { label: "Invested", key: "invested" },
            { label: "Current", key: "currentValue" },
          ]}
          onSort={(key) => setSourceSort((current) => toggleSort(current, key))}
          sortConfig={sourceSort || undefined}
        >
          {sortedSourceRows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-800/30">
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-200">{row.portfolioName}</div>
                <div className="text-xs text-slate-500">{row.ownerName} / {row.broker}</div>
              </td>
              <td className="px-4 py-4 text-slate-300">{row.rawName}</td>
              <td className="px-4 py-4">{row.ticker ? <Badge variant="secondary">{row.ticker}</Badge> : <span className="text-xs text-slate-600">No ticker</span>}</td>
              <td className="px-4 py-4 text-slate-300">{row.normalizedName}</td>
              <td className="px-4 py-4 text-slate-300">{row.quantity}</td>
              <td className="px-4 py-4 text-slate-300">{formatCurrency(row.invested)}</td>
              <td className="px-4 py-4 font-semibold text-slate-100">{formatCurrency(row.currentValue)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Grouped Stock Report" subtitle="Identical stocks from Portfolio 1, Portfolio 2, and every other portfolio are merged here into one clean report.">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">Sort by stock name, quantity, invested amount, current value, portfolios involved, or alias count.</div>
          <Badge variant="info">{stockMappingView.summary.groupedStocks} grouped stocks</Badge>
        </div>
        <Table
          headers={[
            { label: "Stock", key: "name" },
            { label: "Qty", key: "totalQty" },
            { label: "Invested", key: "totalInvested" },
            { label: "Current", key: "totalCurrentValue" },
            { label: "P&L", key: "gainLoss" },
            { label: "Portfolios", key: "portfolioCount" },
            { label: "Aliases", key: "aliasCount" },
          ]}
          onSort={(key) => setGroupSort((current) => toggleSort(current, key))}
          sortConfig={groupSort || undefined}
        >
          {sortedGroups.map((group) => (
            <tr key={group.key} className="hover:bg-slate-800/30">
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-200">{group.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {group.tickers.map((ticker) => (
                    <span key={`${group.key}-${ticker}`}>
                      <Badge variant="secondary">{ticker}</Badge>
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4 text-slate-300">{group.totalQty}</td>
              <td className="px-4 py-4 text-slate-300">{formatCurrency(group.totalInvested)}</td>
              <td className="px-4 py-4 font-semibold text-slate-100">{formatCurrency(group.totalCurrentValue)}</td>
              <td className={`px-4 py-4 font-semibold ${group.gainLoss >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(group.gainLoss)}</td>
              <td className="px-4 py-4">
                <div className="text-slate-300">{group.portfolioCount}</div>
                <div className="text-xs text-slate-500">{group.portfolios.join(", ")}</div>
              </td>
              <td className="px-4 py-4 text-slate-300">{group.aliasCount}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Alias Review" subtitle="These are the stocks where multiple raw names or multiple portfolio entries point to the same grouped stock.">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">Use these groups to draft mappings and validate cross-portfolio duplicates.</div>
          <Badge variant="info">{stockMappingView.aliasGroups.length} review groups</Badge>
        </div>
        <div className="space-y-4">
          {stockMappingView.aliasGroups.length === 0 && (
            <div className="rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-500">
              No duplicate-looking stock aliases found across portfolios.
            </div>
          )}
          {stockMappingView.aliasGroups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-slate-800 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-100">{group.primaryLabel}</div>
                {group.ticker && <Badge variant="secondary">{group.ticker}</Badge>}
                <Badge variant={group.isMapped ? "success" : "warning"}>{group.isMapped ? "Mapped" : "Needs review"}</Badge>
                <span className="text-xs text-slate-500">{formatCurrency(group.totalCurrentValue)} current</span>
              </div>
              <div className="mt-3 space-y-2">
                {group.entries.map((entry) => (
                  <div key={`${group.key}-${entry.portfolio}-${entry.rawName}`} className="flex flex-col gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200">{entry.rawName}</div>
                      <div className="text-xs text-slate-500">{entry.portfolio}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {entry.ticker && <Badge variant="secondary">{entry.ticker}</Badge>}
                      <span>{entry.normalizedName}</span>
                      <span>{formatCurrency(entry.currentValue)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!group.isMapped && group.ticker && (
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      setMappingTicker(group.ticker || "");
                      setMappingName(group.primaryLabel);
                    }}
                  >
                    Use As Mapping Draft
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="All Mappings" subtitle="Built-in mappings are protected. Custom mappings can be removed anytime.">
        <div className="max-h-[520px] overflow-auto">
          <Table
            headers={[{ label: "Ticker", key: "ticker" }, { label: "Company Name", key: "companyName" }, { label: "Type", key: "type" }, { label: "Actions" }]}
            onSort={(key) => setMappingSort((current) => toggleSort(current, key))}
            sortConfig={mappingSort || undefined}
          >
            {sortedMappings.map(({ ticker, companyName, type }) => {
              const isCustom = type === "Custom";
              return (
                <tr key={ticker} className="hover:bg-slate-800/30">
                  <td className="px-4 py-4 font-mono text-slate-200">{ticker}</td>
                  <td className="px-4 py-4 text-slate-300">{companyName}</td>
                  <td className="px-4 py-4">
                    <Badge variant={isCustom ? "info" : "secondary"}>{type}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    {isCustom ? (
                      <button
                        onClick={() => {
                          removeCustomMapping(ticker);
                          updateData({ settings: { ...data.settings } });
                        }}
                        className="text-sm text-rose-500 transition hover:text-rose-400"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Protected</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-100">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{helper}</div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function buildStockMappingView(data: PortfolioData, customMappings: Record<string, string>) {
  const aliasGroups = new Map<string, StockAliasGroup>();

  const portfolios = data.investments.stockPortfolios.map((portfolio: StockPortfolio) => {
    const holdings = portfolio.holdings.map((holding) => ({
      ...holding,
      rawName: holding.companyName.trim(),
      normalizedName: normalizeStockName(holding.companyName),
      invested: holding.quantity * holding.avgBuyPrice,
      currentValue: holding.quantity * holding.currentPrice,
    }));

    return {
      id: portfolio.id,
      name: portfolio.name,
      ownerName: portfolio.ownerName,
      broker: portfolio.broker,
      holdingsCount: holdings.length,
      totalInvested: holdings.reduce((sum, holding) => sum + holding.invested, 0),
      totalCurrentValue: holdings.reduce((sum, holding) => sum + holding.currentValue, 0),
      holdings,
    };
  });

  const rawHoldings: RawHoldingRow[] = portfolios.flatMap((portfolio) =>
    portfolio.holdings.map((holding) => ({
      key: `${portfolio.id}-${holding.id}`,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      portfolioLabel: `${portfolio.name} / ${portfolio.broker}`,
      broker: portfolio.broker,
      ownerName: portfolio.ownerName,
      rawName: holding.rawName,
      normalizedName: holding.normalizedName,
      ticker: holding.ticker?.trim().toUpperCase() || "",
      quantity: holding.quantity,
      invested: holding.invested,
      currentValue: holding.currentValue,
    })),
  );

  rawHoldings.forEach((holding) => {
    const key = holding.ticker || holding.normalizedName.toLowerCase();
    const existing = aliasGroups.get(key);
    const entry: StockAliasEntry = {
      portfolio: holding.portfolioLabel,
      rawName: holding.rawName,
      normalizedName: holding.normalizedName,
      ticker: holding.ticker,
      currentValue: holding.currentValue,
    };

    if (existing) {
      existing.entries.push(entry);
      existing.totalCurrentValue += holding.currentValue;
      return;
    }

    aliasGroups.set(key, {
      key,
      ticker: holding.ticker,
      primaryLabel: normalizeStockName(holding.ticker || holding.rawName),
      isMapped: Boolean(holding.ticker) && (holding.ticker in customMappings || holding.ticker in getStockMappings()),
      entries: [entry],
      totalCurrentValue: holding.currentValue,
    });
  });

  const groupedStocks = getCombinedStockHoldings(data).map((group) => {
    const relatedRawHoldings = rawHoldings.filter((holding) => holding.normalizedName === group.name);
    const uniqueRawNames = new Set(relatedRawHoldings.map((holding) => holding.rawName.toLowerCase()));

    return {
      key: `${group.name}::${group.tickers.join("|")}`,
      name: group.name,
      totalQty: group.totalQty,
      totalInvested: group.totalInvested,
      totalCurrentValue: group.totalCurrentValue,
      portfolioCount: group.portfolios.length,
      aliasCount: uniqueRawNames.size || 1,
      tickers: group.tickers.filter(Boolean),
      portfolios: group.portfolios,
      gainLoss: group.totalCurrentValue - group.totalInvested,
    };
  });

  const reviewGroups = Array.from(aliasGroups.values())
    .map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => a.portfolio.localeCompare(b.portfolio) || a.rawName.localeCompare(b.rawName)),
    }))
    .filter((group) => {
      const uniqueRawNames = new Set(group.entries.map((entry) => entry.rawName.toLowerCase()));
      const uniquePortfolios = new Set(group.entries.map((entry) => entry.portfolio));
      return uniqueRawNames.size > 1 || uniquePortfolios.size > 1;
    })
    .sort((a, b) => b.totalCurrentValue - a.totalCurrentValue);

  return {
    portfolios,
    rawHoldings,
    groupedStocks,
    aliasGroups: reviewGroups,
    summary: {
      portfolios: portfolios.length,
      rawHoldings: rawHoldings.length,
      groupedStocks: groupedStocks.length,
      totalInvested: groupedStocks.reduce((sum, row) => sum + row.totalInvested, 0),
      totalCurrentValue: groupedStocks.reduce((sum, row) => sum + row.totalCurrentValue, 0),
      totalGainLoss: groupedStocks.reduce((sum, row) => sum + row.gainLoss, 0),
    },
  };
}

function sortItems<T extends Record<string, any>>(items: T[], sortConfig: SortConfig) {
  if (!sortConfig) return items;
  return [...items].sort((a, b) => {
    const valueA = a[sortConfig.key] ?? "";
    const valueB = b[sortConfig.key] ?? "";

    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortConfig.direction === "asc" ? valueA - valueB : valueB - valueA;
    }

    return sortConfig.direction === "asc"
      ? String(valueA).localeCompare(String(valueB))
      : String(valueB).localeCompare(String(valueA));
  });
}
