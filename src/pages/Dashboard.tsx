import React, { useEffect, useState } from "react";
import { PortfolioData } from "../types";
import { Badge, Button, Card, Table } from "../components/UI";
import {
  calculateFDValue,
  calculateRDInvested,
  calculateRDValue,
  cn,
  formatCurrency,
  getCombinedStockHoldings,
  getComputedSipInvested,
  getMonthlyCashflowSeries,
  getNeedsAttention,
  getNetWorthTrend,
  getPrintSummary,
  getYearLabel,
  getMutualFundInvestedAmount,
  countUnlinkedTransactions,
  filterByMonth,
  getUnlinkedEntries,
} from "../lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { analyzePortfolio } from "../services/geminiService";

export default function Dashboard({ data, setActiveTab }: { data: PortfolioData; setActiveTab: (tab: string) => void }) {
  const [insights, setInsights] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const bankBalance = data.bankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const mfInvested = data.investments.mutualFunds.reduce((sum, fund) => sum + getMutualFundInvestedAmount(fund), 0);
  const mfCurrent = data.investments.mutualFunds.reduce((sum, fund) => sum + fund.currentValue, 0);
  const stockHoldings = getCombinedStockHoldings(data);
  const stockInvested = stockHoldings.reduce((sum, item) => sum + item.totalInvested, 0);
  const stockCurrent = stockHoldings.reduce((sum, item) => sum + item.totalCurrentValue, 0);
  const fdInvested = data.investments.fd.reduce((sum, fd) => sum + fd.principal, 0);
  const fdCurrent = data.investments.fd.reduce(
    (sum, fd) => sum + calculateFDValue(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate),
    0,
  );
  const rdInvested = data.investments.rd.reduce(
    (sum, rd) => sum + calculateRDInvested(rd.monthlyDeposit, rd.startDate, rd.maturityDate),
    0,
  );
  const rdCurrent = data.investments.rd.reduce(
    (sum, rd) => sum + calculateRDValue(rd.monthlyDeposit, rd.interestRate, rd.startDate, rd.maturityDate),
    0,
  );
  const totalInvested = mfInvested + stockInvested + fdInvested + rdInvested;
  const totalCurrent = mfCurrent + stockCurrent + fdCurrent + rdCurrent;
  const totalLoans = data.loans.reduce((sum, loan) => sum + loan.outstandingBalance, 0);
  const netWorth = bankBalance + totalCurrent - totalLoans;
  const totalPnL = totalCurrent - totalInvested;
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const cashflowData = getMonthlyCashflowSeries(data, 6, data.settings.yearView);
  const netWorthTrend = getNetWorthTrend(data, 12);
  const attentionItems = getNeedsAttention(data);
  const summary = getPrintSummary(data);
  const periodLabel = getYearLabel(data.settings.yearView);
  const now = new Date();
  const monthIncome = filterByMonth(data.income, now.getFullYear(), now.getMonth()).reduce((sum, entry) => sum + entry.amount, 0);
  const monthExpense = filterByMonth(data.expenses, now.getFullYear(), now.getMonth()).reduce((sum, entry) => sum + entry.amount, 0);
  const monthTransfers = filterByMonth(data.transfers, now.getFullYear(), now.getMonth());
  const unlinkedCount = countUnlinkedTransactions(data);
  const unlinkedEntries = getUnlinkedEntries(data);
  const unlinkedTransactionCount = unlinkedEntries.income.length + unlinkedEntries.expenses.length;

  const allocationData = [
    { name: "Mutual Funds", value: mfCurrent },
    { name: "Stocks", value: stockCurrent },
    { name: "FD", value: fdCurrent },
    { name: "RD", value: rdCurrent },
  ].filter((item) => item.value > 0);

  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await analyzePortfolio(data);
    setInsights(result);
    setIsAnalyzing(false);
  };

  const handleAssignNow = () => {
    sessionStorage.setItem("transactions_filter_mode", "unassigned");
    setActiveTab("transactions");
  };

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Financial Overview</h2>
          <p className="text-slate-400">Tracking summary for {periodLabel}.</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-emerald-500 transition disabled:opacity-50"
        >
          <Sparkles className={cn("h-5 w-5", isAnalyzing && "animate-spin")} />
          {isAnalyzing ? "Analyzing..." : "AI Insights"}
        </button>
      </div>

      {insights.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5 print:hidden">
          <div className="space-y-2">
            <h4 className="font-bold text-emerald-400">Portfolio Insights</h4>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
              {insights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {unlinkedCount > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5 print:hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm text-slate-200">
              <div>{unlinkedCount} items need account assignment.</div>
              <div className="text-xs text-slate-400">
                Income: {unlinkedEntries.income.length}, Expenses: {unlinkedEntries.expenses.length}, Recurring rules: {unlinkedEntries.recurringRules.length}
              </div>
            </div>
            <Button variant="secondary" onClick={handleAssignNow}>
              Assign Now{unlinkedTransactionCount !== unlinkedCount ? ` (${unlinkedTransactionCount} transactions)` : ""}
            </Button>
          </div>
        </Card>
      )}

      <section className="print-summary-only space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Net Worth"
            value={formatCurrency(netWorth)}
            accent="emerald"
            helper="Assets - Liabilities"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard label="Total Invested" value={formatCurrency(totalInvested)} accent="blue" helper="Principal amount" />
          <StatCard
            label="Current Value"
            value={formatCurrency(totalCurrent)}
            accent="amber"
            helper={`${formatCurrency(Math.abs(totalPnL))} (${pnlPercentage.toFixed(2)}%)`}
            icon={totalPnL >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          />
          <StatCard label="Total Debt" value={formatCurrency(totalLoans)} accent="rose" helper="Outstanding loans" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
            <p className="text-sm font-medium text-slate-400">Income</p>
            <h3 className="mt-1 text-2xl font-bold text-emerald-400">{formatCurrency(monthIncome)}</h3>
          </Card>
          <Card className="border-l-4 border-l-rose-500 bg-rose-500/5">
            <p className="text-sm font-medium text-slate-400">Expenses</p>
            <h3 className="mt-1 text-2xl font-bold text-rose-400">{formatCurrency(monthExpense)}</h3>
          </Card>
          <Card className={`border-l-4 ${monthIncome - monthExpense >= 0 ? "border-l-emerald-500 bg-emerald-500/5" : "border-l-rose-500 bg-rose-500/5"}`}>
            <p className="text-sm font-medium text-slate-400">Net</p>
            <h3 className={`mt-1 text-2xl font-bold ${monthIncome - monthExpense >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(monthIncome - monthExpense)}</h3>
          </Card>
        </div>

        <Card title="Transfer Summary" subtitle="Internal money movement this month.">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-slate-300">{monthTransfers.length} transfers this month</div>
            <div className="font-bold text-slate-100">{formatCurrency(monthTransfers.reduce((sum, entry) => sum + entry.amount, 0))} moved between accounts</div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr] print:grid-cols-1">
          <Card title="Needs Attention" subtitle="Quick signals that deserve a look this week.">
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Badge variant="success">Healthy</Badge>
                No urgent issues detected.
              </div>
            ) : (
              <div className="space-y-3">
                {attentionItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 h-4 w-4",
                        item.severity === "danger"
                          ? "text-rose-500"
                          : item.severity === "warning"
                            ? "text-amber-500"
                            : "text-sky-500",
                      )}
                    />
                    <span className="text-sm text-slate-300">{item.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Quick Summary" subtitle="At-a-glance portfolio activity.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SummaryChip icon={<Wallet className="h-5 w-5 text-emerald-500" />} label="Bank Balance" value={formatCurrency(bankBalance)} />
              <SummaryChip
                icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
                label="Active SIPs"
                value={String(data.investments.mutualFunds.filter((mf) => mf.sipDetails?.status === "Active").length)}
              />
              <SummaryChip icon={<BarChart3 className="h-5 w-5 text-amber-500" />} label="Open FDs" value={String(data.investments.fd.length)} />
              <SummaryChip icon={<CreditCard className="h-5 w-5 text-rose-500" />} label="Loans Active" value={String(data.loans.length)} />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 print:grid-cols-1">
          <Card title="Income vs Expense" subtitle={`Recent monthly cashflow (${periodLabel}).`} className="min-w-0">
            <div className="mt-4 h-[300px] min-w-0 w-full min-h-[300px]">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                  <BarChart data={cashflowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${Math.round(value / 1000)}k`}
                  />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card title="Net Worth Trend" subtitle="Derived trailing 12-month view." className="min-w-0">
            <div className="mt-4 h-[300px] min-w-0 w-full min-h-[300px]">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                  <AreaChart data={netWorthTrend}>
                  <defs>
                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="netWorth" stroke="#10b981" fill="url(#netWorthGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.9fr_1.1fr] print:grid-cols-1">
          <Card title="Investment Allocation" subtitle="Current value distribution." className="min-w-0">
            <div className="mt-4 h-[320px] min-w-0 w-full min-h-[320px]">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                  <PieChart>
                  <Pie data={allocationData} dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4}>
                    {allocationData.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card title="Combined Stock View" subtitle="Normalized across Groww, Zerodha, and other portfolios.">
            {stockHoldings.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No stock holdings recorded yet.</div>
            ) : (
              <Table
                headers={[
                  { label: "Stock" },
                  { label: "Qty" },
                  { label: "Invested" },
                  { label: "Current" },
                  { label: "P&L" },
                  { label: "Portfolios" },
                ]}
              >
                {stockHoldings.map((holding) => {
                  const pnl = holding.totalCurrentValue - holding.totalInvested;
                  return (
                    <tr key={holding.name} className="hover:bg-slate-800/30">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-200">{holding.name}</div>
                        <div className="text-xs text-slate-500">{holding.tickers.join(", ")}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{holding.totalQty}</td>
                      <td className="px-4 py-4 text-slate-300">{formatCurrency(holding.totalInvested)}</td>
                      <td className="px-4 py-4 font-semibold text-slate-100">{formatCurrency(holding.totalCurrentValue)}</td>
                      <td className={cn("px-4 py-4 font-semibold", pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {formatCurrency(pnl)}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">{holding.portfolios.join(", ")}</td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>

        <Card title="Print Summary" subtitle="This section is optimized for PDF/print export.">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {summary.threeMonthCashflow.map((month) => (
                <div key={month.key} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm font-semibold text-slate-200">{month.month}</div>
                  <div className="mt-3 space-y-1 text-sm text-slate-400">
                    <div>Income: {formatCurrency(month.income)}</div>
                    <div>Expense: {formatCurrency(month.expense)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Current Value</th>
                    <th className="px-4 py-3">Portfolios</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.combinedStocks.slice(0, 10).map((holding) => (
                    <tr key={holding.name} className="border-b border-slate-800/50">
                      <td className="px-4 py-3 text-slate-200">{holding.name}</td>
                      <td className="px-4 py-3 text-slate-300">{formatCurrency(holding.totalCurrentValue)}</td>
                      <td className="px-4 py-3 text-slate-400">{holding.portfolios.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  accent,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  accent: "emerald" | "blue" | "amber" | "rose";
  icon?: React.ReactNode;
}) {
  const accentClass = {
    emerald: "border-l-emerald-500 bg-emerald-500/5",
    blue: "border-l-blue-500 bg-blue-500/5",
    amber: "border-l-amber-500 bg-amber-500/5",
    rose: "border-l-rose-500 bg-rose-500/5",
  }[accent];

  return (
    <Card className={cn("border-l-4", accentClass)}>
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <h3 className="mt-1 text-2xl font-bold text-slate-100">{value}</h3>
      <div className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-400">
        {icon}
        {helper}
      </div>
    </Card>
  );
}

function SummaryChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="shrink-0 rounded-xl bg-slate-900 p-3">{icon}</div>
      <div className="min-w-0">
        <p className="break-words text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate text-lg font-bold text-slate-100 sm:text-xl">{value}</p>
      </div>
    </div>
  );
}
