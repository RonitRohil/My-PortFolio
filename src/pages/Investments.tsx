import React, { useEffect, useMemo, useState } from "react";
import {
  BrokerType,
  FixedDeposit,
  InvestmentStatus,
  LumpsumEntry,
  MFCategory,
  MutualFund,
  PortfolioData,
  RecurringDeposit,
  Stock,
  StockPortfolio,
} from "../types";
import { Badge, Button, Card, Input, Modal, Select, Table } from "../components/UI";
import { AlertTriangle, Briefcase, Edit2, FileUp, MinusCircle, Plus, PlusCircle, Trash2 } from "lucide-react";
import {
  calculateFDValue,
  calculateMaturityAmount,
  calculateRDInvested,
  calculateRDMaturityAmount,
  calculateRDValue,
  calculateWeightedAverage,
  cn,
  formatCurrency,
  formatDate,
  getCombinedStockHoldings,
  getComputedSipInvested,
  getMutualFundInvestedAmount,
  parseCSV,
} from "../lib/utils";
import { getTickerFromName, isSameStock, normalizeStockName } from "../utils/stockNormalizer";

type InvestmentTab = "mf" | "stocks" | "fd" | "rd";

const tabs: { id: InvestmentTab; label: string }[] = [
  { id: "mf", label: "Mutual Funds" },
  { id: "stocks", label: "Stocks" },
  { id: "fd", label: "Fixed Deposits" },
  { id: "rd", label: "Recurring Deposits" },
];

export default function Investments({ data, updateData }: { data: PortfolioData; updateData: (d: Partial<PortfolioData>) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<InvestmentTab>("mf");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<StockPortfolio | null>(null);
  const [activePortfolioId, setActivePortfolioId] = useState("all");
  const [lumpsums, setLumpsums] = useState<LumpsumEntry[]>([]);
  const [hasSIP, setHasSIP] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
    if (editingItem && activeSubTab === "mf") {
      setLumpsums(editingItem.lumpsumEntries || []);
      setHasSIP(Boolean(editingItem.sipDetails));
    } else {
      setLumpsums([]);
      setHasSIP(false);
    }
  }, [editingItem, activeSubTab]);

  useEffect(() => {
    if (activePortfolioId !== "all" && !data.investments.stockPortfolios.some((p) => p.id === activePortfolioId)) {
      setActivePortfolioId(data.investments.stockPortfolios[0]?.id || "all");
    }
  }, [activePortfolioId, data.investments.stockPortfolios]);

  const combinedStocks = useMemo(() => getCombinedStockHoldings(data), [data]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => (prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };

  const sorted = <T extends Record<string, any>>(items: T[]) => {
    if (!sortConfig) return items;
    return [...items].sort((a, b) => {
      const valueA = a[sortConfig.key] || "";
      const valueB = b[sortConfig.key] || "";
      if (valueA < valueB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valueA > valueB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const id = editingItem?.id || Date.now().toString();
    const investments = { ...data.investments };

    if (activeSubTab === "mf") {
      const fund: MutualFund = {
        id,
        fundName: formData.get("fundName") as string,
        amc: formData.get("amc") as string,
        category: formData.get("category") as MFCategory,
        currentValue: Number(formData.get("currentValue")),
        lumpsumEntries: lumpsums.filter((entry) => entry.amount > 0),
        sipDetails: hasSIP
          ? {
              monthlyAmount: Number(formData.get("sipAmount")),
              startDate: formData.get("sipStartDate") as string,
              status: formData.get("sipStatus") as InvestmentStatus,
              stoppedDate: (formData.get("sipStoppedDate") as string) || undefined,
            }
          : undefined,
      };
      investments.mutualFunds = editingItem
        ? investments.mutualFunds.map((item) => (item.id === id ? fund : item))
        : [...investments.mutualFunds, fund];
    }

    if (activeSubTab === "stocks") {
      const portfolio = investments.stockPortfolios.find((item) => item.id === activePortfolioId);
      if (!portfolio) return;
      const companyName = normalizeStockName((formData.get("companyName") as string) || "");
      const ticker = ((formData.get("ticker") as string) || getTickerFromName(companyName)).toUpperCase();
      const quantity = Number(formData.get("quantity"));
      const avgBuyPrice = Number(formData.get("avgBuyPrice"));
      const currentPrice = Number(formData.get("currentPrice"));
      const existingIndex = portfolio.holdings.findIndex((holding) => holding.id !== editingItem?.id && isSameStock(holding.companyName, companyName));

      if (existingIndex >= 0 && !editingItem) {
        const existing = portfolio.holdings[existingIndex];
        portfolio.holdings[existingIndex] = {
          ...existing,
          companyName,
          ticker,
          quantity: existing.quantity + quantity,
          avgBuyPrice: calculateWeightedAverage(existing.quantity, existing.avgBuyPrice, quantity, avgBuyPrice),
          currentPrice,
        };
      } else {
        const stock: Stock = { id, companyName, ticker, quantity, avgBuyPrice, currentPrice };
        portfolio.holdings = editingItem ? portfolio.holdings.map((item) => (item.id === id ? stock : item)) : [...portfolio.holdings, stock];
      }

      investments.stockPortfolios = investments.stockPortfolios.map((item) => (item.id === portfolio.id ? portfolio : item));
    }

    if (activeSubTab === "fd") {
      const fd: FixedDeposit = {
        id,
        bankName: formData.get("bankName") as string,
        principal: Number(formData.get("principal")),
        interestRate: Number(formData.get("interestRate")),
        startDate: formData.get("startDate") as string,
        maturityDate: formData.get("maturityDate") as string,
      };
      investments.fd = editingItem ? investments.fd.map((item) => (item.id === id ? fd : item)) : [...investments.fd, fd];
    }

    if (activeSubTab === "rd") {
      const rd: RecurringDeposit = {
        id,
        bankName: formData.get("bankName") as string,
        monthlyDeposit: Number(formData.get("monthlyDeposit")),
        interestRate: Number(formData.get("interestRate")),
        startDate: formData.get("startDate") as string,
        maturityDate: formData.get("maturityDate") as string,
      };
      investments.rd = editingItem ? investments.rd.map((item) => (item.id === id ? rd : item)) : [...investments.rd, rd];
    }

    updateData({ investments });
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handlePortfolioSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const id = editingPortfolio?.id || `portfolio_${Date.now()}`;
    const portfolio: StockPortfolio = {
      id,
      name: formData.get("name") as string,
      ownerName: formData.get("ownerName") as string,
      broker: formData.get("broker") as BrokerType,
      holdings: editingPortfolio?.holdings || [],
    };
    const stockPortfolios = editingPortfolio
      ? data.investments.stockPortfolios.map((item) => (item.id === id ? portfolio : item))
      : [...data.investments.stockPortfolios, portfolio];
    updateData({ investments: { ...data.investments, stockPortfolios } });
    setActivePortfolioId(id);
    setIsPortfolioModalOpen(false);
    setEditingPortfolio(null);
  };

  const deleteItem = (id: string) => {
    if (!confirm("Are you sure you want to delete this investment?")) return;
    const investments = { ...data.investments };
    if (activeSubTab === "mf") investments.mutualFunds = investments.mutualFunds.filter((item) => item.id !== id);
    if (activeSubTab === "fd") investments.fd = investments.fd.filter((item) => item.id !== id);
    if (activeSubTab === "rd") investments.rd = investments.rd.filter((item) => item.id !== id);
    if (activeSubTab === "stocks" && activePortfolioId !== "all") {
      investments.stockPortfolios = investments.stockPortfolios.map((portfolio) =>
        portfolio.id === activePortfolioId ? { ...portfolio, holdings: portfolio.holdings.filter((item) => item.id !== id) } : portfolio,
      );
    }
    updateData({ investments });
  };

  const deletePortfolio = (id: string) => {
    if (!confirm("Delete this portfolio and all its holdings?")) return;
    const stockPortfolios = data.investments.stockPortfolios.filter((item) => item.id !== id);
    updateData({ investments: { ...data.investments, stockPortfolios } });
    setActivePortfolioId(stockPortfolios[0]?.id || "all");
  };

  const handleImport = (portfolioId: string, broker: BrokerType) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const rows = parseCSV(await file.text());
      const portfolio = data.investments.stockPortfolios.find((item) => item.id === portfolioId);
      if (!portfolio) return;

      const findCol = (row: Record<string, string>, aliases: string[]) => {
        const key = Object.keys(row).find((candidate) => aliases.map((alias) => alias.toLowerCase()).includes(candidate.toLowerCase().trim()));
        return key ? row[key] : undefined;
      };
      const parseNum = (value?: string) => Number((value || "").replace(/[^0-9.-]/g, ""));
      const holdings: Stock[] = [];

      rows.forEach((row) => {
        let ticker = "";
        let companyName = "";
        if (broker === "Groww") {
          companyName = normalizeStockName(findCol(row, ["Stock Name", "Stock", "Company", "Instrument"]) || "");
          ticker = ((findCol(row, ["Ticker", "Symbol"]) || getTickerFromName(companyName)) as string).toUpperCase();
        } else if (broker === "Zerodha") {
          ticker = ((findCol(row, ["Instrument", "Symbol", "Ticker"]) || "") as string).toUpperCase();
          companyName = normalizeStockName(ticker);
        } else {
          companyName = normalizeStockName(findCol(row, ["Stock Name", "Company", "Stock"]) || "");
          ticker = ((findCol(row, ["Ticker", "Symbol", "Instrument"]) || getTickerFromName(companyName)) as string).toUpperCase();
        }
        const quantity = parseNum(findCol(row, ["Quantity", "Qty", "Qty.", "Shares"]));
        const avgBuyPrice = parseNum(findCol(row, ["Average buy price", "Average Price", "Avg Price", "Avg Cost", "Avg. cost"]));
        const currentPrice = parseNum(findCol(row, ["Closing price", "Current Price", "LTP", "Market Price"]));
        if (!companyName || !ticker || quantity <= 0) return;
        const existing = portfolio.holdings.find((item) => isSameStock(item.companyName, companyName));
        holdings.push({
          id: existing?.id || Math.random().toString(36).slice(2, 11),
          companyName,
          ticker,
          quantity,
          avgBuyPrice,
          currentPrice: currentPrice > 0 ? currentPrice : existing?.currentPrice || avgBuyPrice,
        });
      });

      updateData({
        investments: {
          ...data.investments,
          stockPortfolios: data.investments.stockPortfolios.map((item) => (item.id === portfolioId ? { ...item, holdings } : item)),
        },
      });
      alert("CSV import completed with stock-name normalization applied.");
    };
    input.click();
  };

  const portfolioHoldings = data.investments.stockPortfolios.find((item) => item.id === activePortfolioId)?.holdings || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Investments</h2>
          <p className="text-slate-400">Track your wealth across mutual funds, stocks, FDs, and RDs.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Investment
        </Button>
      </div>

      <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSubTab(tab.id);
              setSortConfig(null);
            }}
            className={cn("rounded-xl px-4 py-2 text-sm font-semibold transition", activeSubTab === tab.id ? "bg-emerald-500 text-white" : "text-slate-400")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {activeSubTab === "mf" && (
          <Table
            headers={[
              { label: "Fund Name", key: "fundName" },
              { label: "Category", key: "category" },
              { label: "Invested" },
              { label: "Current", key: "currentValue" },
              { label: "P&L" },
              { label: "Actions" },
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {sorted(data.investments.mutualFunds).map((fund: MutualFund) => {
              const invested = getMutualFundInvestedAmount(fund);
              const pnl = fund.currentValue - invested;
              return (
                <tr key={fund.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-200">{fund.fundName}</div>
                    <div className="text-xs text-slate-500">{fund.amc}</div>
                    {fund.sipDetails && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant={fund.sipDetails.status === "Active" ? "success" : "warning"}>
                          SIP {formatCurrency(fund.sipDetails.monthlyAmount)}
                        </Badge>
                        <span className="text-xs text-slate-500">Total SIP invested: {formatCurrency(getComputedSipInvested(fund.sipDetails))}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="secondary">{fund.category}</Badge>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-300">{formatCurrency(invested)}</td>
                  <td className="px-4 py-4 font-semibold text-slate-100">{formatCurrency(fund.currentValue)}</td>
                  <td className={cn("px-4 py-4 font-semibold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatCurrency(pnl)}</td>
                  <td className="px-4 py-4">
                    <ActionButtons onEdit={() => { setEditingItem(fund); setIsModalOpen(true); }} onDelete={() => deleteItem(fund.id)} />
                  </td>
                </tr>
              );
            })}
          </Table>
        )}

        {activeSubTab === "stocks" && (
          <div className="space-y-6">
            {data.investments.stockPortfolios.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 py-12 text-center">
                <Briefcase className="mx-auto mb-4 h-12 w-12 text-slate-700" />
                <h3 className="text-lg font-bold text-slate-300">No Stock Portfolios Yet</h3>
                <p className="mb-6 text-sm text-slate-500">Create a portfolio first to start tracking holdings.</p>
                <Button onClick={() => setIsPortfolioModalOpen(true)}>Create Portfolio</Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-800/60 p-1">
                    <button onClick={() => setActivePortfolioId("all")} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", activePortfolioId === "all" ? "bg-emerald-500 text-white" : "text-slate-400")}>All Portfolios</button>
                    {data.investments.stockPortfolios.map((portfolio) => (
                      <button key={portfolio.id} onClick={() => setActivePortfolioId(portfolio.id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", activePortfolioId === portfolio.id ? "bg-emerald-500 text-white" : "text-slate-400")}>
                        {portfolio.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={() => setIsPortfolioModalOpen(true)}><Plus className="h-4 w-4" /> Add Portfolio</Button>
                    {activePortfolioId !== "all" && (
                      <>
                        <Button variant="secondary" onClick={() => {
                          const portfolio = data.investments.stockPortfolios.find((item) => item.id === activePortfolioId);
                          if (!portfolio) return;
                          setEditingPortfolio(portfolio);
                          setIsPortfolioModalOpen(true);
                        }}><Edit2 className="h-4 w-4" /> Edit Portfolio</Button>
                        <Button variant="secondary" onClick={() => {
                          const portfolio = data.investments.stockPortfolios.find((item) => item.id === activePortfolioId);
                          if (portfolio) handleImport(portfolio.id, portfolio.broker);
                        }}><FileUp className="h-4 w-4" /> Import CSV</Button>
                        <Button variant="ghost" onClick={() => deletePortfolio(activePortfolioId)}><Trash2 className="h-4 w-4" /> Delete Portfolio</Button>
                      </>
                    )}
                  </div>
                </div>

                {activePortfolioId === "all" ? (
                  <Table headers={[{ label: "Stock" }, { label: "Qty" }, { label: "Avg Price" }, { label: "Current" }, { label: "Value" }, { label: "Portfolios" }]}>
                    {combinedStocks.map((holding) => (
                      <tr key={holding.name} className="hover:bg-slate-800/30">
                        <td className="px-4 py-4"><div className="font-semibold text-slate-200">{holding.name}</div><div className="text-xs text-slate-500">{holding.tickers.join(", ")}</div></td>
                        <td className="px-4 py-4 text-slate-300">{holding.totalQty}</td>
                        <td className="px-4 py-4 text-slate-300">{formatCurrency(holding.weightedAvgPrice)}</td>
                        <td className="px-4 py-4 text-slate-300">{formatCurrency(holding.currentPrice)}</td>
                        <td className="px-4 py-4 font-semibold text-slate-100">{formatCurrency(holding.totalCurrentValue)}</td>
                        <td className="px-4 py-4 text-xs text-slate-400">{holding.portfolios.join(", ")}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Table headers={[{ label: "Stock", key: "companyName" }, { label: "Qty", key: "quantity" }, { label: "Avg Price", key: "avgBuyPrice" }, { label: "Current", key: "currentPrice" }, { label: "Value" }, { label: "Actions" }]} onSort={handleSort} sortConfig={sortConfig || undefined}>
                    {sorted(portfolioHoldings).map((holding: Stock) => (
                      <tr key={holding.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-4"><div className="font-semibold text-slate-200">{normalizeStockName(holding.companyName)}</div><div className="text-xs font-mono text-slate-500">{holding.ticker}</div></td>
                        <td className="px-4 py-4 text-slate-300">{holding.quantity}</td>
                        <td className="px-4 py-4 text-slate-300">{formatCurrency(holding.avgBuyPrice)}</td>
                        <td className="px-4 py-4 text-slate-300">{formatCurrency(holding.currentPrice)}</td>
                        <td className="px-4 py-4 font-semibold text-slate-100">{formatCurrency(holding.quantity * holding.currentPrice)}</td>
                        <td className="px-4 py-4"><ActionButtons onEdit={() => { setEditingItem(holding); setIsModalOpen(true); }} onDelete={() => deleteItem(holding.id)} /></td>
                      </tr>
                    ))}
                  </Table>
                )}
              </>
            )}
          </div>
        )}

        {activeSubTab === "fd" && (
          <Table headers={[{ label: "Bank", key: "bankName" }, { label: "Principal", key: "principal" }, { label: "Rate", key: "interestRate" }, { label: "Maturity Date", key: "maturityDate" }, { label: "Current Value" }, { label: "Actions" }]} onSort={handleSort} sortConfig={sortConfig || undefined}>
            {sorted(data.investments.fd).map((fd: FixedDeposit) => {
              const years = (new Date(fd.maturityDate).getTime() - new Date(fd.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
              return (
                <tr key={fd.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-4 font-semibold text-slate-200">{fd.bankName}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCurrency(fd.principal)}</td>
                  <td className="px-4 py-4 text-slate-300">{fd.interestRate}%</td>
                  <td className="px-4 py-4 text-slate-300">{formatDate(fd.maturityDate)}</td>
                  <td className="px-4 py-4"><div className="font-semibold text-emerald-400">{formatCurrency(calculateFDValue(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate))}</div><div className="text-xs text-slate-500">Maturity: {formatCurrency(calculateMaturityAmount(fd.principal, fd.interestRate, years, 4))}</div></td>
                  <td className="px-4 py-4"><ActionButtons onEdit={() => { setEditingItem(fd); setIsModalOpen(true); }} onDelete={() => deleteItem(fd.id)} /></td>
                </tr>
              );
            })}
          </Table>
        )}

        {activeSubTab === "rd" && (
          <Table headers={[{ label: "Bank", key: "bankName" }, { label: "Monthly", key: "monthlyDeposit" }, { label: "Rate", key: "interestRate" }, { label: "Maturity Date", key: "maturityDate" }, { label: "Current Value" }, { label: "Actions" }]} onSort={handleSort} sortConfig={sortConfig || undefined}>
            {sorted(data.investments.rd).map((rd: RecurringDeposit) => {
              const years = (new Date(rd.maturityDate).getTime() - new Date(rd.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
              const months = Math.round(years * 12);
              return (
                <tr key={rd.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-4 font-semibold text-slate-200">{rd.bankName}</td>
                  <td className="px-4 py-4"><div className="font-semibold text-slate-200">{formatCurrency(calculateRDInvested(rd.monthlyDeposit, rd.startDate, rd.maturityDate))}</div><div className="text-xs text-slate-500">{formatCurrency(rd.monthlyDeposit)}/month</div></td>
                  <td className="px-4 py-4 text-slate-300">{rd.interestRate}%</td>
                  <td className="px-4 py-4 text-slate-300">{formatDate(rd.maturityDate)}</td>
                  <td className="px-4 py-4"><div className="font-semibold text-emerald-400">{formatCurrency(calculateRDValue(rd.monthlyDeposit, rd.interestRate, rd.startDate, rd.maturityDate))}</div><div className="text-xs text-slate-500">Maturity: {formatCurrency(calculateRDMaturityAmount(rd.monthlyDeposit, rd.interestRate, months))}</div></td>
                  <td className="px-4 py-4"><ActionButtons onEdit={() => { setEditingItem(rd); setIsModalOpen(true); }} onDelete={() => deleteItem(rd.id)} /></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Investment" : "Add Investment"} className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeSubTab === "mf" && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="Fund Name" name="fundName" required defaultValue={editingItem?.fundName} className="md:col-span-2" />
                <Input label="AMC" name="amc" required defaultValue={editingItem?.amc} />
                <Select label="Category" name="category" defaultValue={editingItem?.category || "Equity"}>
                  {["Equity", "Debt", "Hybrid", "ELSS", "Index"].map((category) => <option key={category} value={category}>{category}</option>)}
                </Select>
                <Input label="Current Value" name="currentValue" type="number" required defaultValue={editingItem?.currentValue} className="md:col-span-2" />
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between"><div className="font-semibold text-slate-200">SIP Details</div><button type="button" onClick={() => setHasSIP((value) => !value)} className="text-sm text-emerald-400">{hasSIP ? "Remove SIP" : "Add SIP"}</button></div>
                {hasSIP && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Input label="Monthly Amount" name="sipAmount" type="number" required defaultValue={editingItem?.sipDetails?.monthlyAmount} />
                    <Input label="Start Date" name="sipStartDate" type="date" required defaultValue={editingItem?.sipDetails?.startDate} />
                    <Select label="Status" name="sipStatus" defaultValue={editingItem?.sipDetails?.status || "Active"}>
                      {["Active", "Paused", "Stopped"].map((status) => <option key={status} value={status}>{status}</option>)}
                    </Select>
                    <Input label="Stopped Date" name="sipStoppedDate" type="date" defaultValue={editingItem?.sipDetails?.stoppedDate} />
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between"><div className="font-semibold text-slate-200">Lumpsum Entries</div><button type="button" onClick={() => setLumpsums((entries) => [...entries, { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), amount: 0 }])} className="flex items-center gap-1 text-sm text-emerald-400"><PlusCircle className="h-4 w-4" /> Add Entry</button></div>
                {lumpsums.length === 0 && <div className="text-sm text-slate-500">No lumpsum entries added.</div>}
                {lumpsums.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                    <Input type="date" value={entry.date} onChange={(event) => setLumpsums((current) => current.map((item) => (item.id === entry.id ? { ...item, date: event.target.value } : item)))} />
                    <Input type="number" value={entry.amount} onChange={(event) => setLumpsums((current) => current.map((item) => (item.id === entry.id ? { ...item, amount: Number(event.target.value) } : item)))} />
                    <button type="button" onClick={() => setLumpsums((current) => current.filter((item) => item.id !== entry.id))} className="text-slate-500 hover:text-rose-500"><MinusCircle className="h-5 w-5" /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSubTab === "stocks" && (
            <div className="space-y-4">
              {activePortfolioId === "all" && <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"><AlertTriangle className="h-4 w-4" /> Select an individual portfolio before adding or editing holdings.</div>}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="Company Name" name="companyName" required defaultValue={editingItem?.companyName} className="md:col-span-2" />
                <Input label="Ticker" name="ticker" required defaultValue={editingItem?.ticker} placeholder="RELIANCE" />
                <Input label="Quantity" name="quantity" type="number" required defaultValue={editingItem?.quantity} />
                <Input label="Avg Buy Price" name="avgBuyPrice" type="number" required defaultValue={editingItem?.avgBuyPrice} />
                <Input label="Current Price" name="currentPrice" type="number" required defaultValue={editingItem?.currentPrice} />
              </div>
            </div>
          )}

          {activeSubTab === "fd" && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="Bank Name" name="bankName" required defaultValue={editingItem?.bankName} className="md:col-span-2" /><Input label="Principal Amount" name="principal" type="number" required defaultValue={editingItem?.principal} /><Input label="Interest Rate (%)" name="interestRate" type="number" required defaultValue={editingItem?.interestRate} /><Input label="Start Date" name="startDate" type="date" required defaultValue={editingItem?.startDate} /><Input label="Maturity Date" name="maturityDate" type="date" required defaultValue={editingItem?.maturityDate} /></div>}

          {activeSubTab === "rd" && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="Bank Name" name="bankName" required defaultValue={editingItem?.bankName} className="md:col-span-2" /><Input label="Monthly Deposit" name="monthlyDeposit" type="number" required defaultValue={editingItem?.monthlyDeposit} /><Input label="Interest Rate (%)" name="interestRate" type="number" required defaultValue={editingItem?.interestRate} /><Input label="Start Date" name="startDate" type="date" required defaultValue={editingItem?.startDate} /><Input label="Maturity Date" name="maturityDate" type="date" required defaultValue={editingItem?.maturityDate} /></div>}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={activeSubTab === "stocks" && activePortfolioId === "all"}>{editingItem ? "Update Investment" : "Add Investment"}</Button>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPortfolioModalOpen} onClose={() => { setIsPortfolioModalOpen(false); setEditingPortfolio(null); }} title={editingPortfolio ? "Edit Portfolio" : "Create Portfolio"}>
        <form onSubmit={handlePortfolioSubmit} className="space-y-4">
          <Input label="Portfolio Name" name="name" required defaultValue={editingPortfolio?.name} />
          <Input label="Owner Name" name="ownerName" required defaultValue={editingPortfolio?.ownerName} />
          <Select label="Broker" name="broker" defaultValue={editingPortfolio?.broker || "Groww"}>
            {["Groww", "Zerodha", "Upstox", "Other"].map((broker) => <option key={broker} value={broker}>{broker}</option>)}
          </Select>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">{editingPortfolio ? "Update Portfolio" : "Create Portfolio"}</Button>
            <Button type="button" variant="secondary" onClick={() => setIsPortfolioModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onEdit} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="h-4 w-4" /></button>
      <button onClick={onDelete} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
