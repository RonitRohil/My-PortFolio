import React, { useState, useEffect } from "react";
import { PortfolioData, StockPortfolio, Stock } from "../types";
import { Card, Badge, Table } from "../components/UI";
import { formatCurrency, calculateSIPInvested } from "../lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  BarChart3,
  Sparkles,
  CreditCard
} from "lucide-react";
import { cn } from "../lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { analyzePortfolio } from "../services/geminiService";

export default function Dashboard({ data }: { data: PortfolioData }) {
  const [insights, setInsights] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const bankBalance = data.bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  
  const mfInvested = data.investments.mutualFunds.reduce((sum, mf) => {
    const sipInv = mf.sipDetails ? calculateSIPInvested(mf.sipDetails.monthlyAmount, mf.sipDetails.startDate) : 0;
    const lumpInv = mf.lumpsumEntries.reduce((s, l) => s + l.amount, 0);
    return sum + sipInv + lumpInv;
  }, 0);
  
  const stockInvested = data.investments.stockPortfolios.reduce((sum, p) => 
    sum + p.holdings.reduce((s, h) => s + (h.quantity * h.avgBuyPrice), 0), 0
  );
  
  const fdInvested = data.investments.fd.reduce((sum, f) => sum + f.principal, 0);
  const rdInvested = data.investments.rd.reduce((sum, r) => {
    const years = (new Date(r.maturityDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
    const months = Math.round(years * 12);
    return sum + (r.monthlyDeposit * months);
  }, 0);

  const totalInvested = mfInvested + stockInvested + fdInvested + rdInvested;

  const mfCurrent = data.investments.mutualFunds.reduce((sum, m) => sum + m.currentValue, 0);
  
  const stockCurrent = data.investments.stockPortfolios.reduce((sum, p) => 
    sum + p.holdings.reduce((s, h) => s + (h.quantity * h.currentPrice), 0), 0
  );

  const fdCurrent = fdInvested; // Simplified
  const rdCurrent = rdInvested; // Simplified

  const totalCurrent = mfCurrent + stockCurrent + fdCurrent + rdCurrent;
  const totalPnL = totalCurrent - totalInvested;
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const mfPnL = mfCurrent - mfInvested;
  const mfPnLPerc = mfInvested > 0 ? (mfPnL / mfInvested) * 100 : 0;
  const stockPnL = stockCurrent - stockInvested;
  const stockPnLPerc = stockInvested > 0 ? (stockPnL / stockInvested) * 100 : 0;

  const totalLoans = data.loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const netWorth = (bankBalance + totalCurrent) - totalLoans;

  const allocationData = [
    { name: "Mutual Funds", value: mfCurrent },
    { name: "Stocks", value: stockCurrent },
    { name: "FD", value: fdCurrent },
    { name: "RD", value: rdCurrent },
  ].filter(d => d.value > 0);

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

  // Mock chart data for income vs expense
  const chartData = [
    { month: "Nov", income: 85000, expense: 45000 },
    { month: "Dec", income: 90000, expense: 52000 },
    { month: "Jan", income: 88000, expense: 48000 },
    { month: "Feb", income: 92000, expense: 55000 },
    { month: "Mar", income: 95000, expense: 50000 },
    { month: "Apr", income: 100000, expense: 42000 },
  ];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await analyzePortfolio(data);
    setInsights(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Financial Overview</h2>
          <p className="text-slate-400">Welcome back! Here's how your portfolio is performing.</p>
        </div>
        <button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all disabled:opacity-50"
        >
          <Sparkles className={cn("w-5 h-5", isAnalyzing && "animate-spin")} />
          {isAnalyzing ? "Analyzing..." : "AI Insights"}
        </button>
      </div>

      {insights.length > 0 && (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-emerald-500">Gemini Insights</h4>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                {insights.map((insight, i) => <li key={i}>{insight}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-emerald-500">
          <p className="text-sm font-medium text-slate-400">Net Worth</p>
          <h3 className="text-2xl font-bold mt-1">{formatCurrency(netWorth)}</h3>
          <div className="flex items-center gap-1 mt-2 text-emerald-500 text-xs font-bold">
            <TrendingUp className="w-3 h-3" />
            Assets - Liabilities
          </div>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <p className="text-sm font-medium text-slate-400">Total Invested</p>
          <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalInvested)}</h3>
          <p className="text-xs text-slate-500 mt-2">Principal Amount</p>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <p className="text-sm font-medium text-slate-400">Current Value</p>
          <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalCurrent)}</h3>
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs font-bold",
            totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"
          )}>
            {totalPnL >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {formatCurrency(Math.abs(totalPnL))} ({pnlPercentage.toFixed(2)}%)
          </div>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <p className="text-sm font-medium text-slate-400">Total Debt</p>
          <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalLoans)}</h3>
          <p className="text-xs text-slate-500 mt-2">Outstanding Loans</p>
        </Card>
      </div>

      {/* Investment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Mutual Funds Summary" subtitle="Consolidated MF performance">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Invested</p>
                <p className="text-lg font-bold text-slate-200">{formatCurrency(mfInvested)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Current</p>
                <p className="text-lg font-bold text-slate-200">{formatCurrency(mfCurrent)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 font-bold uppercase">Total P&L</p>
              <div className={cn("text-xl font-bold flex items-center gap-2", mfPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {formatCurrency(mfPnL)}
                <span className="text-sm font-medium">({mfPnLPerc.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Stocks Summary" subtitle="Combined performance across portfolios">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Invested</p>
                <p className="text-lg font-bold text-slate-200">{formatCurrency(stockInvested)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Current</p>
                <p className="text-lg font-bold text-slate-200">{formatCurrency(stockCurrent)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 font-bold uppercase">Total P&L</p>
              <div className={cn("text-xl font-bold flex items-center gap-2", stockPnL >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {formatCurrency(stockPnL)}
                <span className="text-sm font-medium">({stockPnLPerc.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Income vs Expense" subtitle="Last 6 months performance">
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Investment Allocation" subtitle="Current value distribution">
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Stock Portfolios Breakdown */}
      {data.investments.stockPortfolios.length > 0 && (
        <Card title="Stock Portfolios Breakdown" subtitle="Performance by portfolio">
          <Table 
            headers={[
              { label: "Portfolio" },
              { label: "Broker" },
              { label: "Invested" },
              { label: "Current" },
              { label: "P&L" }
            ]}
          >
            {data.investments.stockPortfolios.map(p => {
              const invested = p.holdings.reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
              const current = p.holdings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
              const pnl = current - invested;
              const pnlPerc = invested > 0 ? (pnl / invested) * 100 : 0;
              return (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-200">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.ownerName}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="info">{p.broker}</Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-300 font-medium">{formatCurrency(invested)}</td>
                  <td className="px-4 py-4 text-slate-200 font-bold">{formatCurrency(current)}</td>
                  <td className="px-4 py-4">
                    <div className={cn("font-bold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatCurrency(pnl)}
                    </div>
                    <div className={cn("text-[10px]", pnl >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {pnlPerc.toFixed(1)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <Wallet className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Bank Balance</p>
            <p className="text-lg font-bold">{formatCurrency(bankBalance)}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Active SIPs</p>
            <p className="text-lg font-bold">{data.investments.mutualFunds.filter(mf => mf.sipDetails?.status === 'Active').length}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl">
            <BarChart3 className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Open FDs</p>
            <p className="text-lg font-bold">{data.investments.fd.length}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 rounded-xl">
            <CreditCard className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase">Loans Active</p>
            <p className="text-lg font-bold">{data.loans.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
