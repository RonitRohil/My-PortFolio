import React, { useMemo, useState } from "react";
import { ArrowUpCircle, Edit2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select } from "../components/UI";
import { IncomeEntry, IncomeSource, PortfolioData } from "../types";
import MonthNavigator from "../components/MonthNavigator";
import { useMonthNavigator } from "../hooks/useMonthNavigator";
import { groupTransactionsByDate } from "../utils/groupByDate";
import {
  deleteIncomeEntry,
  filterByMonth,
  formatCurrency,
  formatDate,
  getAllAccounts,
  getAccountNameById,
  saveIncomeEntry,
} from "../lib/utils";

export default function IncomeTracker({ data, updateData }: { data: PortfolioData; updateData: (d: Partial<PortfolioData>) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | null>(null);
  const [accountFilter, setAccountFilter] = useState("all");
  const [quickAssign, setQuickAssign] = useState<IncomeEntry | null>(null);
  const navigator = useMonthNavigator();
  const accounts = getAllAccounts(data);

  const filteredIncome = useMemo(() => {
    const monthItems = filterByMonth(data.income, navigator.year, navigator.month);
    return accountFilter === "all" ? monthItems : monthItems.filter((entry) => entry.toAccountId === accountFilter);
  }, [accountFilter, data.income, navigator.month, navigator.year]);

  const groupedIncome = groupTransactionsByDate(filteredIncome, "income");
  const totalMonthlyIncome = filteredIncome.reduce((sum, entry) => sum + entry.amount, 0);
  const sourceTotals = Array.from(
    filteredIncome.reduce((map, entry) => {
      map.set(entry.source, (map.get(entry.source) || 0) + entry.amount);
      return map;
    }, new Map<string, number>()),
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const toAccountId = String(formData.get("toAccountId"));
    const entry: IncomeEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date: String(formData.get("date")),
      source: formData.get("source") as IncomeSource,
      amount: Number(formData.get("amount")),
      description: String(formData.get("description") || "") || undefined,
      toAccountId,
      toAccountName: getAccountNameById(data, toAccountId),
    };
    updateData(saveIncomeEntry(data, entry, editingEntry));
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Income Tracker</h2>
          <p className="text-slate-400">Monitor credits by date, source, and receiving account.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="min-w-52">
            <option value="all">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bankName}
              </option>
            ))}
          </Select>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Income
          </Button>
        </div>
      </div>

      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <div className="space-y-4">
          <MonthNavigator label={navigator.label} onPrev={navigator.goToPrev} onNext={navigator.goToNext} isCurrentMonth={navigator.isCurrentMonth} onToday={navigator.goToToday} />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-emerald-500/20 p-3">
                <ArrowUpCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-500/80">Total Received</p>
                <h3 className="text-4xl font-black text-emerald-500">{formatCurrency(totalMonthlyIncome)}</h3>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceTotals.map(([source, amount]) => (
                <span key={source}>
                  <Badge variant="success" className="px-3 py-1 text-xs normal-case tracking-normal">
                    {source} {formatCurrency(amount)}
                  </Badge>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {groupedIncome.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-slate-500">No income entries for this month.</div>
          </Card>
        ) : (
          groupedIncome.map((group) => (
            <div key={group.date}>
            <Card className="overflow-hidden">
              <div className="-m-6">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/70 px-6 py-4">
                  <span className="font-semibold text-slate-200">{group.displayDate}</span>
                  <span className="font-bold text-emerald-400">Income: {formatCurrency(group.dayIncome)}</span>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {group.items.map((entry: IncomeEntry) => (
                    <div key={entry.id} className="flex flex-col justify-between gap-4 px-6 py-4 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="success">{entry.source}</Badge>
                          {!entry.toAccountId && (
                            <button onClick={() => setQuickAssign(entry)}>
                              <Badge variant="warning">Account?</Badge>
                            </button>
                          )}
                        </div>
                        <div className="mt-2 font-semibold text-slate-100">{entry.description || entry.source}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          Received in: {entry.toAccountName || "Account not assigned"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-emerald-400">{formatCurrency(entry.amount)}</div>
                          <div className="text-xs text-slate-500">{formatDate(entry.date)}</div>
                        </div>
                        <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => updateData(deleteIncomeEntry(data, entry))} className="p-2 text-slate-400 hover:text-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingEntry(null); }} title={editingEntry ? "Edit Income" : "Add Income"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Date" name="date" type="date" required defaultValue={editingEntry?.date || new Date().toISOString().slice(0, 10)} />
          <Input label="Amount" name="amount" type="number" required defaultValue={editingEntry?.amount} />
          <Select label="Source" name="source" defaultValue={editingEntry?.source || "Salary"}>
            {["Salary", "Freelance", "Dividends", "Interest", "Rental", "Other"].map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
          <Select label="Received In" name="toAccountId" defaultValue={editingEntry?.toAccountId || accounts[0]?.id}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bankName}
              </option>
            ))}
          </Select>
          <Input label="Description / Note" name="description" defaultValue={editingEntry?.description} />
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">{editingEntry ? "Update" : "Add"}</Button>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <QuickAssignIncomeModal data={data} entry={quickAssign} onClose={() => setQuickAssign(null)} updateData={updateData} />
    </div>
  );
}

function QuickAssignIncomeModal({
  data,
  entry,
  onClose,
  updateData,
}: {
  data: PortfolioData;
  entry: IncomeEntry | null;
  onClose: () => void;
  updateData: (d: Partial<PortfolioData>) => void;
}) {
  const accounts = getAllAccounts(data);
  if (!entry) return null;
  return (
    <Modal isOpen={!!entry} onClose={onClose} title="Assign Account">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          {entry.description || entry.source} • {formatCurrency(entry.amount)}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                updateData(
                  saveIncomeEntry(data, { ...entry, toAccountId: account.id, toAccountName: account.bankName }, entry),
                );
                onClose();
              }}
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left hover:border-emerald-500/40"
            >
              {account.bankName}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
