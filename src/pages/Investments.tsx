import React, { useState, useEffect } from "react";
import { PortfolioData, MutualFund, Stock, FixedDeposit, RecurringDeposit, InvestmentStatus, MFCategory, LumpsumEntry, StockPortfolio, BrokerType } from "../types";
import { Card, Button, Input, Select, Table, Modal, Badge } from "../components/UI";
import { Plus, Trash2, Edit2, TrendingUp, Search, Calendar, DollarSign, PlusCircle, MinusCircle, Briefcase, User, Building2, FileUp, AlertTriangle } from "lucide-react";
import { 
  formatCurrency, 
  formatDate, 
  calculateSIPInvested, 
  cn, 
  calculateWeightedAverage, 
  parseCSV,
  calculateRDInvested,
  calculateRDValue,
  calculateFDValue,
  calculateMaturityAmount,
  calculateRDMaturityAmount
} from "../lib/utils";

type InvestmentTab = 'mf' | 'stocks' | 'fd' | 'rd';

export default function Investments({ data, updateData }: { data: PortfolioData, updateData: (d: Partial<PortfolioData>) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<InvestmentTab>('mf');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<StockPortfolio | null>(null);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [lumpsums, setLumpsums] = useState<LumpsumEntry[]>([]);
  const [hasSIP, setHasSIP] = useState(false);

  const tabs: { id: InvestmentTab, label: string }[] = [
    { id: 'mf', label: 'Mutual Funds' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'fd', label: 'Fixed Deposits' },
    { id: 'rd', label: 'Recurring Deposits' },
  ];

  useEffect(() => {
    if (editingItem && activeSubTab === 'mf') {
      setLumpsums(editingItem.lumpsumEntries || []);
      setHasSIP(!!editingItem.sipDetails);
    } else {
      setLumpsums([]);
      setHasSIP(false);
    }
  }, [editingItem, activeSubTab]);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortedData = (items: any[]) => {
    if (!sortConfig) return items;
    const { key, direction } = sortConfig;
    return [...items].sort((a, b) => {
      const valA = a[key] || "";
      const valB = b[key] || "";
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const addLumpsumRow = () => {
    setLumpsums([...lumpsums, { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0 }]);
  };

  const removeLumpsumRow = (id: string) => {
    setLumpsums(lumpsums.filter(l => l.id !== id));
  };

  const updateLumpsumRow = (id: string, field: keyof LumpsumEntry, value: any) => {
    setLumpsums(lumpsums.map(l => l.id === id ? { ...l, [field]: field === 'amount' ? Number(value) : value } : l));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = editingItem?.id || Date.now().toString();

    const updatedInvestments = { ...data.investments };

    if (activeSubTab === 'mf') {
      const item: MutualFund = {
        id,
        fundName: formData.get("fundName") as string,
        amc: formData.get("amc") as string,
        category: formData.get("category") as MFCategory,
        currentValue: Number(formData.get("currentValue")),
        lumpsumEntries: lumpsums,
        sipDetails: hasSIP ? {
          monthlyAmount: Number(formData.get("sipAmount")),
          startDate: formData.get("sipStartDate") as string,
          status: formData.get("sipStatus") as InvestmentStatus,
        } : undefined
      };
      updatedInvestments.mutualFunds = editingItem 
        ? updatedInvestments.mutualFunds.map(i => i.id === id ? item : i)
        : [...updatedInvestments.mutualFunds, item];
    } else if (activeSubTab === 'stocks') {
      if (!activePortfolioId) return;
      
      const portfolio = updatedInvestments.stockPortfolios.find(p => p.id === activePortfolioId);
      if (!portfolio) return;

      const ticker = (formData.get("ticker") as string).toUpperCase();
      const companyName = formData.get("companyName") as string;
      const quantity = Number(formData.get("quantity"));
      const buyPrice = Number(formData.get("avgBuyPrice"));
      const currentPrice = Number(formData.get("currentPrice"));

      const existingStockIndex = portfolio.holdings.findIndex(s => s.ticker === ticker);

      if (existingStockIndex >= 0 && !editingItem) {
        // Merge logic for new stock
        const existing = portfolio.holdings[existingStockIndex];
        const newAvg = calculateWeightedAverage(existing.quantity, existing.avgBuyPrice, quantity, buyPrice);
        const newQty = existing.quantity + quantity;
        
        portfolio.holdings[existingStockIndex] = {
          ...existing,
          quantity: newQty,
          avgBuyPrice: newAvg,
          currentPrice: currentPrice // Update to latest current price
        };
        alert(`Stock already exists. Updated average price to ${formatCurrency(newAvg)} at ${newQty} total shares.`);
      } else {
        const item: Stock = {
          id,
          companyName,
          ticker,
          quantity,
          avgBuyPrice: buyPrice,
          currentPrice,
        };

        if (editingItem) {
          portfolio.holdings = portfolio.holdings.map(s => s.id === id ? item : s);
        } else {
          portfolio.holdings.push(item);
        }
      }

      updatedInvestments.stockPortfolios = updatedInvestments.stockPortfolios.map(p => p.id === activePortfolioId ? portfolio : p);
    } else if (activeSubTab === 'fd') {
      const item: FixedDeposit = {
        id,
        bankName: formData.get("bankName") as string,
        principal: Number(formData.get("principal")),
        interestRate: Number(formData.get("interestRate")),
        startDate: formData.get("startDate") as string,
        maturityDate: formData.get("maturityDate") as string,
      };
      updatedInvestments.fd = editingItem 
        ? updatedInvestments.fd.map(i => i.id === id ? item : i)
        : [...updatedInvestments.fd, item];
    } else if (activeSubTab === 'rd') {
      const item: RecurringDeposit = {
        id,
        bankName: formData.get("bankName") as string,
        monthlyDeposit: Number(formData.get("monthlyDeposit")),
        interestRate: Number(formData.get("interestRate")),
        startDate: formData.get("startDate") as string,
        maturityDate: formData.get("maturityDate") as string,
      };
      updatedInvestments.rd = editingItem 
        ? updatedInvestments.rd.map(i => i.id === id ? item : i)
        : [...updatedInvestments.rd, item];
    }

    updateData({ investments: updatedInvestments });
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handlePortfolioSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = editingPortfolio?.id || Date.now().toString();

    const portfolio: StockPortfolio = {
      id,
      name: formData.get("name") as string,
      ownerName: formData.get("ownerName") as string,
      broker: formData.get("broker") as BrokerType,
      holdings: editingPortfolio?.holdings || []
    };

    const updatedPortfolios = editingPortfolio
      ? data.investments.stockPortfolios.map(p => p.id === id ? portfolio : p)
      : [...data.investments.stockPortfolios, portfolio];

    updateData({ investments: { ...data.investments, stockPortfolios: updatedPortfolios } });
    setIsPortfolioModalOpen(false);
    setEditingPortfolio(null);
    if (!activePortfolioId) setActivePortfolioId(id);
  };

  const deletePortfolio = (id: string) => {
    if (confirm("Are you sure you want to delete this entire portfolio and all its holdings?")) {
      const updatedPortfolios = data.investments.stockPortfolios.filter(p => p.id !== id);
      updateData({ investments: { ...data.investments, stockPortfolios: updatedPortfolios } });
      if (activePortfolioId === id) setActivePortfolioId(updatedPortfolios[0]?.id || null);
    }
  };

  const deleteItem = (id: string) => {
    if (confirm("Are you sure you want to delete this investment?")) {
      const updatedInvestments = { ...data.investments };
      if (activeSubTab === 'mf') updatedInvestments.mutualFunds = updatedInvestments.mutualFunds.filter(i => i.id !== id);
      if (activeSubTab === 'stocks' && activePortfolioId) {
        updatedInvestments.stockPortfolios = updatedInvestments.stockPortfolios.map(p => {
          if (p.id === activePortfolioId) {
            return { ...p, holdings: p.holdings.filter(h => h.id !== id) };
          }
          return p;
        });
      }
      if (activeSubTab === 'fd') updatedInvestments.fd = updatedInvestments.fd.filter(i => i.id !== id);
      if (activeSubTab === 'rd') updatedInvestments.rd = updatedInvestments.rd.filter(i => i.id !== id);
      updateData({ investments: updatedInvestments });
    }
  };

  const handleImport = (portfolioId: string, broker: BrokerType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        const rows = parseCSV(csv);
        if (rows.length === 0) {
          alert("No data found in the CSV file.");
          return;
        }
        
        const portfolio = data.investments.stockPortfolios.find(p => p.id === portfolioId);
        if (!portfolio) return;

        const newHoldings: Stock[] = [];
        let updated = 0;
        let added = 0;
        let removed = 0;

        const existingHoldings = [...portfolio.holdings];

        // Helper to find a column by multiple possible names (case-insensitive)
        const findCol = (row: any, aliases: string[]) => {
          const keys = Object.keys(row);
          const aliasLower = aliases.map(a => a.toLowerCase());
          const key = keys.find(k => aliasLower.includes(k.toLowerCase().trim()));
          return key ? row[key] : undefined;
        };

        rows.forEach(row => {
          let ticker = "";
          let companyName = "";
          let quantity = 0;
          let avgPrice = 0;

          // Helper to parse numeric strings with potential commas or symbols
          const parseNum = (val: any) => {
            if (val === undefined || val === null || val === "") return NaN;
            if (typeof val !== 'string') return Number(val);
            // Remove currency symbols, commas, and other non-numeric chars except . and -
            const clean = val.replace(/[^0-9.-]/g, '').trim();
            return Number(clean);
          };

          let currentPrice = 0;

          if (broker === 'Groww') {
            companyName = findCol(row, ['Stock Name', 'Stock', 'Company', 'Instrument']) || "";
            ticker = companyName.split(' ')[0].toUpperCase(); // Heuristic
            quantity = parseNum(findCol(row, ['Quantity', 'Qty', 'Shares']));
            avgPrice = parseNum(findCol(row, ['Average buy price', 'Average Price', 'Avg Price', 'Avg Cost', 'Buy Price']));
            currentPrice = parseNum(findCol(row, ['Closing price', 'LTP', 'Current Price', 'Market Price', 'Live Price']));
          } else if (broker === 'Zerodha') {
            ticker = findCol(row, ['Instrument', 'Symbol', 'Ticker']) || "";
            companyName = ticker;
            quantity = parseNum(findCol(row, ['Qty.', 'Qty', 'Quantity', 'Shares']));
            avgPrice = parseNum(findCol(row, ['Avg. cost', 'Avg cost', 'Average Price', 'Avg Price', 'Buy Price']));
            currentPrice = parseNum(findCol(row, ['LTP', 'Current Price', 'Market Price', 'Live Price']));
          } else {
            // Generic fallback
            ticker = findCol(row, ['Ticker', 'Symbol', 'Instrument']) || "";
            companyName = findCol(row, ['Stock Name', 'Company', 'Stock']) || ticker;
            quantity = parseNum(findCol(row, ['Quantity', 'Qty', 'Qty.', 'Shares']));
            avgPrice = parseNum(findCol(row, ['Average Price', 'Avg Price', 'Avg Cost', 'Avg. cost', 'Buy Price']));
            currentPrice = parseNum(findCol(row, ['LTP', 'Current Price', 'Market Price', 'Live Price']));
          }

          if (ticker && !isNaN(quantity) && !isNaN(avgPrice) && quantity > 0) {
            const existing = existingHoldings.find(h => h.ticker === ticker);
            if (existing) updated++;
            else added++;

            newHoldings.push({
              id: existing?.id || Math.random().toString(36).substr(2, 9),
              companyName: existing?.companyName || companyName,
              ticker,
              quantity,
              avgBuyPrice: avgPrice,
              currentPrice: !isNaN(currentPrice) && currentPrice > 0 ? currentPrice : (existing?.currentPrice || avgPrice)
            });
          }
        });

        removed = existingHoldings.length - (newHoldings.length - added);

        const updatedPortfolios = data.investments.stockPortfolios.map(p => {
          if (p.id === portfolioId) {
            return { ...p, holdings: newHoldings };
          }
          return p;
        });

        updateData({ investments: { ...data.investments, stockPortfolios: updatedPortfolios } });
        alert(`${updated} stocks updated, ${added} stocks added, ${removed} stocks removed.`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Investments</h2>
          <p className="text-slate-400">Track your wealth across various asset classes.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Investment
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit overflow-x-auto max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); setSortConfig(null); }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
              activeSubTab === tab.id 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {activeSubTab === 'mf' && (
          <Table 
            headers={[
              { label: "Fund Name", key: "fundName" }, 
              { label: "Category", key: "category" }, 
              { label: "Invested" }, 
              { label: "Current", key: "currentValue" }, 
              { label: "P&L" }, 
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {getSortedData(data.investments.mutualFunds).map((mf: MutualFund) => {
              const sipInvested = mf.sipDetails ? calculateSIPInvested(mf.sipDetails.monthlyAmount, mf.sipDetails.startDate) : 0;
              const lumpsumInvested = mf.lumpsumEntries.reduce((sum, l) => sum + l.amount, 0);
              const totalInvested = sipInvested + lumpsumInvested;
              const pnl = mf.currentValue - totalInvested;
              const pnlPerc = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
              
              return (
                <tr key={mf.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-200">{mf.fundName}</div>
                    <div className="text-xs text-slate-500">{mf.amc}</div>
                    {mf.sipDetails && (
                      <div className="mt-1 flex items-center gap-1">
                        <Badge variant={mf.sipDetails.status === 'Active' ? 'success' : 'warning'} className="text-[10px] px-1 py-0">
                          SIP: {formatCurrency(mf.sipDetails.monthlyAmount)}
                        </Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="secondary">{mf.category}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-slate-300 font-semibold">{formatCurrency(totalInvested)}</div>
                    <div className="text-[10px] text-slate-500">
                      {mf.sipDetails && `SIP: ${formatCurrency(sipInvested)}`}
                      {mf.lumpsumEntries.length > 0 && ` + Lump: ${formatCurrency(lumpsumInvested)}`}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-200">{formatCurrency(mf.currentValue)}</td>
                  <td className="px-4 py-4">
                    <div className={cn("font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatCurrency(pnl)}
                    </div>
                    <div className={cn("text-xs", pnl >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {pnlPerc.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingItem(mf); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteItem(mf.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}

        {activeSubTab === 'stocks' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl">
                <button
                  onClick={() => setActivePortfolioId('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activePortfolioId === 'all' 
                      ? "bg-emerald-500 text-white shadow-sm" 
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  All Portfolios
                </button>
                {data.investments.stockPortfolios.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePortfolioId(p.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      activePortfolioId === p.id 
                        ? "bg-slate-700 text-white shadow-sm" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
                <button 
                  onClick={() => { setEditingPortfolio(null); setIsPortfolioModalOpen(true); }}
                  className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                  title="Add Portfolio"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>

              {activePortfolioId && activePortfolioId !== 'all' && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      const p = data.investments.stockPortfolios.find(p => p.id === activePortfolioId);
                      if (p) handleImport(p.id, p.broker);
                    }}
                    className="flex items-center gap-2"
                  >
                    <FileUp className="w-4 h-4" />
                    Import CSV
                  </Button>
                  <button 
                    onClick={() => {
                      const p = data.investments.stockPortfolios.find(p => p.id === activePortfolioId);
                      if (p) { setEditingPortfolio(p); setIsPortfolioModalOpen(true); }
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => activePortfolioId && deletePortfolio(activePortfolioId)}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {activePortfolioId ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    let invested = 0;
                    let current = 0;
                    let broker = "Multiple";
                    let owner = "Multiple";

                    if (activePortfolioId === 'all') {
                      data.investments.stockPortfolios.forEach(p => {
                        invested += p.holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
                        current += p.holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
                      });
                    } else {
                      const p = data.investments.stockPortfolios.find(p => p.id === activePortfolioId);
                      if (!p) return null;
                      invested = p.holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
                      current = p.holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
                      broker = p.broker;
                      owner = p.ownerName;
                    }

                    const pnl = current - invested;
                    const pnlPerc = invested > 0 ? (pnl / invested) * 100 : 0;
                    return (
                      <>
                        <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Broker / Owner</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="info">{broker}</Badge>
                            <span className="text-sm text-slate-300 font-medium">{owner}</span>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Invested Value</p>
                          <p className="text-lg font-bold text-slate-200 mt-1">{formatCurrency(invested)}</p>
                        </div>
                        <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current P&L</p>
                          <div className={cn("text-lg font-bold mt-1", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {formatCurrency(pnl)} ({pnlPerc.toFixed(2)}%)
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <Table 
                  headers={[
                    { label: "Stock", key: "companyName" }, 
                    { label: "Qty", key: "quantity" }, 
                    { label: "Avg Price", key: "avgBuyPrice" }, 
                    { label: "Current", key: "currentPrice" }, 
                    { label: "Value" }, 
                    { label: "P&L" }, 
                    { label: "Actions" }
                  ]}
                  onSort={handleSort}
                  sortConfig={sortConfig || undefined}
                >
                  {(() => {
                    let holdings: Stock[] = [];
                    if (activePortfolioId === 'all') {
                      // Group by ticker
                      const grouped = new Map<string, Stock>();
                      data.investments.stockPortfolios.forEach(p => {
                        p.holdings.forEach(h => {
                          const existing = grouped.get(h.ticker);
                          if (existing) {
                            const totalQty = existing.quantity + h.quantity;
                            const weightedAvg = (existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice) / totalQty;
                            grouped.set(h.ticker, {
                              ...existing,
                              quantity: totalQty,
                              avgBuyPrice: weightedAvg,
                              currentPrice: h.currentPrice // Use latest current price
                            });
                          } else {
                            grouped.set(h.ticker, { ...h });
                          }
                        });
                      });
                      holdings = Array.from(grouped.values());
                    } else {
                      holdings = data.investments.stockPortfolios.find(p => p.id === activePortfolioId)?.holdings || [];
                    }

                    return getSortedData(holdings).map((stock: Stock) => {
                      const invested = stock.quantity * stock.avgBuyPrice;
                      const current = stock.quantity * stock.currentPrice;
                      const pnl = current - invested;
                      const pnlPerc = invested > 0 ? (pnl / invested) * 100 : 0;
                      return (
                        <tr key={stock.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-200">{stock.companyName}</div>
                            <div className="text-xs text-slate-500 font-mono">{stock.ticker}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-300">{stock.quantity}</td>
                          <td className="px-4 py-4 text-slate-400">{formatCurrency(stock.avgBuyPrice)}</td>
                          <td className="px-4 py-4 text-slate-200">{formatCurrency(stock.currentPrice)}</td>
                          <td className="px-4 py-4 font-bold text-slate-100">{formatCurrency(current)}</td>
                          <td className="px-4 py-4">
                            <div className={cn("font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {formatCurrency(pnl)}
                            </div>
                            <div className={cn("text-[10px]", pnl >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {pnlPerc.toFixed(1)}%
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setEditingItem(stock); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => deleteItem(stock.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </Table>
              </>
            ) : (
              <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                <Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-300">No Portfolios Found</h3>
                <p className="text-slate-500 text-sm mb-6">Create a portfolio to start tracking your stock holdings.</p>
                <Button onClick={() => setIsPortfolioModalOpen(true)}>Create Portfolio</Button>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'fd' && (
          <Table 
            headers={[
              { label: "Bank", key: "bankName" }, 
              { label: "Principal", key: "principal" }, 
              { label: "Rate", key: "interestRate" }, 
              { label: "Maturity Date", key: "maturityDate" },
              { label: "Maturity Amt" },
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {getSortedData(data.investments.fd).map((fd: FixedDeposit) => {
              const years = (new Date(fd.maturityDate).getTime() - new Date(fd.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
              const maturityAmt = calculateMaturityAmount(fd.principal, fd.interestRate, years, 4);
              const currentValue = calculateFDValue(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate);
              return (
                <tr key={fd.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-4 font-semibold text-slate-200">{fd.bankName}</td>
                  <td className="px-4 py-4">
                    <div className="text-emerald-500 font-bold">{formatCurrency(fd.principal)}</div>
                    <div className="text-[10px] text-slate-500">Invested</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{fd.interestRate}%</td>
                  <td className="px-4 py-4 text-slate-400">{formatDate(fd.maturityDate)}</td>
                  <td className="px-4 py-4">
                    <div className="text-emerald-400 font-bold">{formatCurrency(currentValue)}</div>
                    <div className="text-[10px] text-slate-500">Maturity: {formatCurrency(maturityAmt)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingItem(fd); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteItem(fd.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}

        {activeSubTab === 'rd' && (
          <Table 
            headers={[
              { label: "Bank", key: "bankName" }, 
              { label: "Monthly", key: "monthlyDeposit" }, 
              { label: "Rate", key: "interestRate" }, 
              { label: "Maturity Date", key: "maturityDate" },
              { label: "Maturity Amt" },
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {getSortedData(data.investments.rd).map((rd: RecurringDeposit) => {
              const years = (new Date(rd.maturityDate).getTime() - new Date(rd.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
              const months = Math.round(years * 12);
              const maturityAmt = calculateRDMaturityAmount(rd.monthlyDeposit, rd.interestRate, months);
              
              const invested = calculateRDInvested(rd.monthlyDeposit, rd.startDate, rd.maturityDate);
              const currentValue = calculateRDValue(rd.monthlyDeposit, rd.interestRate, rd.startDate, rd.maturityDate);
              
              return (
                <tr key={rd.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-4 font-semibold text-slate-200">{rd.bankName}</td>
                  <td className="px-4 py-4">
                    <div className="text-emerald-500 font-bold">{formatCurrency(invested)}</div>
                    <div className="text-[10px] text-slate-500">{formatCurrency(rd.monthlyDeposit)}/mo</div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{rd.interestRate}%</td>
                  <td className="px-4 py-4 text-slate-400">{formatDate(rd.maturityDate)}</td>
                  <td className="px-4 py-4">
                    <div className="text-emerald-400 font-bold">{formatCurrency(currentValue)}</div>
                    <div className="text-[10px] text-slate-500">Maturity: {formatCurrency(maturityAmt)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingItem(rd); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteItem(rd.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
        title={editingItem ? "Edit Investment" : "Add Investment"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeSubTab === 'mf' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Fund Name" name="fundName" required defaultValue={editingItem?.fundName} className="md:col-span-2" />
                <Input label="AMC" name="amc" required defaultValue={editingItem?.amc} />
                <Select label="Category" name="category" defaultValue={editingItem?.category || "Equity"}>
                  <option value="Equity">Equity</option>
                  <option value="Debt">Debt</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="ELSS">ELSS</option>
                  <option value="Index">Index</option>
                </Select>
                <Input label="Current Value" name="currentValue" type="number" required defaultValue={editingItem?.currentValue} className="md:col-span-2" />
              </div>

              {/* SIP Section */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    SIP Details
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setHasSIP(!hasSIP)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-md transition-colors",
                      hasSIP ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    )}
                  >
                    {hasSIP ? "Remove SIP" : "Add SIP"}
                  </button>
                </div>
                
                {hasSIP && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                    <Input label="Monthly Amount" name="sipAmount" type="number" required defaultValue={editingItem?.sipDetails?.monthlyAmount} />
                    <Input label="Start Date" name="sipStartDate" type="date" required defaultValue={editingItem?.sipDetails?.startDate} />
                    <Select label="Status" name="sipStatus" defaultValue={editingItem?.sipDetails?.status || "Active"}>
                      <option value="Active">Active</option>
                      <option value="Paused">Paused</option>
                      <option value="Stopped">Stopped</option>
                    </Select>
                  </div>
                )}
              </div>

              {/* Lumpsum Section */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Lumpsum Investments
                  </div>
                  <button 
                    type="button" 
                    onClick={addLumpsumRow}
                    className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md hover:bg-emerald-500/20 transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    Add Entry
                  </button>
                </div>

                {lumpsums.length > 0 ? (
                  <div className="space-y-3">
                    {lumpsums.map((ls) => (
                      <div key={ls.id} className="flex items-end gap-3 animate-in fade-in slide-in-from-top-1">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-500 mb-1">Date</label>
                          <input 
                            type="date" 
                            value={ls.date} 
                            onChange={(e) => updateLumpsumRow(ls.id, 'date', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-slate-500 mb-1">Amount</label>
                          <input 
                            type="number" 
                            value={ls.amount} 
                            onChange={(e) => updateLumpsumRow(ls.id, 'amount', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeLumpsumRow(ls.id)}
                          className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 italic">
                    No lumpsum entries added yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'stocks' && (
            <div className="space-y-4">
              {!activePortfolioId && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Please create a portfolio first.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Company Name" name="companyName" required defaultValue={editingItem?.companyName} className="md:col-span-2" />
                <Input label="Ticker Symbol" name="ticker" required defaultValue={editingItem?.ticker} placeholder="e.g. RELIANCE" />
                <Input label="Quantity" name="quantity" type="number" required defaultValue={editingItem?.quantity} />
                <Input label="Avg Buy Price" name="avgBuyPrice" type="number" required defaultValue={editingItem?.avgBuyPrice} />
                <Input label="Current Price" name="currentPrice" type="number" required defaultValue={editingItem?.currentPrice} />
              </div>
            </div>
          )}

          {activeSubTab === 'fd' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Bank Name" name="bankName" required defaultValue={editingItem?.bankName} className="md:col-span-2" />
              <Input label="Principal Amount" name="principal" type="number" required defaultValue={editingItem?.principal} />
              <Input label="Interest Rate (%)" name="interestRate" type="number" step="0.01" required defaultValue={editingItem?.interestRate} />
              <Input label="Start Date" name="startDate" type="date" required defaultValue={editingItem?.startDate} />
              <Input label="Maturity Date" name="maturityDate" type="date" required defaultValue={editingItem?.maturityDate} />
            </div>
          )}

          {activeSubTab === 'rd' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Bank Name" name="bankName" required defaultValue={editingItem?.bankName} className="md:col-span-2" />
              <Input label="Monthly Deposit" name="monthlyDeposit" type="number" required defaultValue={editingItem?.monthlyDeposit} />
              <Input label="Interest Rate (%)" name="interestRate" type="number" step="0.01" required defaultValue={editingItem?.interestRate} />
              <Input label="Start Date" name="startDate" type="date" required defaultValue={editingItem?.startDate} />
              <Input label="Maturity Date" name="maturityDate" type="date" required defaultValue={editingItem?.maturityDate} />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {editingItem ? "Update Investment" : "Add Investment"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingItem(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isPortfolioModalOpen}
        onClose={() => { setIsPortfolioModalOpen(false); setEditingPortfolio(null); }}
        title={editingPortfolio ? "Edit Portfolio" : "Create Portfolio"}
      >
        <form onSubmit={handlePortfolioSubmit} className="space-y-6">
          <div className="space-y-4">
            <Input label="Portfolio Name" name="name" required defaultValue={editingPortfolio?.name} placeholder="e.g. My Zerodha" />
            <Input label="Owner Name" name="ownerName" required defaultValue={editingPortfolio?.ownerName} placeholder="e.g. Ronit" />
            <Select label="Broker" name="broker" defaultValue={editingPortfolio?.broker || "Groww"}>
              <option value="Groww">Groww</option>
              <option value="Zerodha">Zerodha</option>
              <option value="Upstox">Upstox</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {editingPortfolio ? "Update Portfolio" : "Create Portfolio"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setIsPortfolioModalOpen(false); setEditingPortfolio(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
