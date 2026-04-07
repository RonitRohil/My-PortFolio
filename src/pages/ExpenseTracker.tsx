import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowDownCircle, ArrowLeftRight, Edit2, Plus, Repeat, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select } from "../components/UI";
import MonthNavigator from "../components/MonthNavigator";
import { useMonthNavigator } from "../hooks/useMonthNavigator";
import { groupTransactionsByDate } from "../utils/groupByDate";
import {
  ExpenseCategory,
  ExpenseEntry,
  PaymentMethod,
  PortfolioData,
  RecurringFrequency,
  RecurringRule,
  TransferEntry,
} from "../types";
import {
  deleteExpenseEntry,
  deleteTransferEntry,
  filterByMonth,
  formatCurrency,
  getAllAccounts,
  getExpenseCategories,
  getExpenseMethods,
  getProjectedAccountBalance,
  isCashAccount,
  saveExpenseEntry,
  saveTransferEntry,
} from "../lib/utils";

type ExpenseTab = "entries" | "transfers" | "recurring";

const recurringOptions: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Every Day" },
  { value: "weekdays", label: "Monday through Friday only" },
  { value: "weekends", label: "Saturday and Sunday only" },
  { value: "weekly", label: "Every Week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "every4weeks", label: "Every 4 weeks" },
  { value: "monthly", label: "Every Month" },
  { value: "endofmonth", label: "Last day of each month" },
  { value: "every2months", label: "Every 2 months" },
  { value: "every3months", label: "Every 3 months" },
  { value: "every4months", label: "Every 4 months" },
  { value: "every6months", label: "Every 6 months" },
  { value: "yearly", label: "Every Year" },
];

export default function ExpenseTracker({ data, updateData }: { data: PortfolioData; updateData: (d: Partial<PortfolioData>) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<ExpenseTab>("entries");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<TransferEntry | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [accountFilter, setAccountFilter] = useState("all");
  const [quickAssign, setQuickAssign] = useState<ExpenseEntry | null>(null);
  const navigator = useMonthNavigator();
  const accounts = getAllAccounts(data);

  const filteredExpenses = useMemo(() => {
    const monthItems = filterByMonth(data.expenses, navigator.year, navigator.month);
    return accountFilter === "all" ? monthItems : monthItems.filter((entry) => entry.fromAccountId === accountFilter);
  }, [accountFilter, data.expenses, navigator.month, navigator.year]);

  const filteredTransfers = useMemo(() => {
    const monthItems = filterByMonth(data.transfers, navigator.year, navigator.month);
    return accountFilter === "all"
      ? monthItems
      : monthItems.filter((entry) => entry.fromAccountId === accountFilter || entry.toAccountId === accountFilter);
  }, [accountFilter, data.transfers, navigator.month, navigator.year]);

  const groupedExpenses = groupTransactionsByDate(filteredExpenses, "expense");
  const totalMonthlyExpense = filteredExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const budget = data.settings.monthlyBudget;
  const categoryTotals = Array.from(filteredExpenses.reduce((map, entry) => {
    map.set(entry.category, (map.get(entry.category) || 0) + entry.amount);
    return map;
  }, new Map<string, number>()));
  const monthlyTransfersAmount = filteredTransfers.reduce((sum, entry) => sum + entry.amount, 0);

  const saveExpense = (entry: ExpenseEntry) => {
    if (entry.fromAccountId) {
      const projected = getProjectedAccountBalance(accounts, entry.fromAccountId, -entry.amount + (editingEntry?.fromAccountId === entry.fromAccountId ? editingEntry.amount : 0));
      if (projected < 0 && !confirm(`This expense will make your ${entry.fromAccountName} balance negative. Continue?`)) return;
    }
    updateData(saveExpenseEntry(data, entry, editingEntry));
    setIsExpenseModalOpen(false);
    setEditingEntry(null);
  };

  const saveTransfer = (entry: TransferEntry) => {
    const fromProjected = getProjectedAccountBalance(accounts, entry.fromAccountId, -(entry.amount + entry.fees) + (editingTransfer?.fromAccountId === entry.fromAccountId ? editingTransfer.amount + editingTransfer.fees : 0));
    if (fromProjected < 0 && !confirm(`This transfer will make your ${entry.fromAccountName} balance negative. Continue?`)) return;
    updateData(saveTransferEntry(data, entry, editingTransfer));
    setIsTransferModalOpen(false);
    setEditingTransfer(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Expense Tracker</h2>
          <p className="text-slate-400">Track debits, transfers, and recurring outflows by account.</p>
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
          <Button
            onClick={() => {
              if (activeSubTab === "entries") setIsExpenseModalOpen(true);
              if (activeSubTab === "transfers") setIsTransferModalOpen(true);
              if (activeSubTab === "recurring") setIsRuleModalOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            {activeSubTab === "entries" ? "Add Expense" : activeSubTab === "transfers" ? "Add Transfer" : "Add Recurring Rule"}
          </Button>
        </div>
      </div>

      <Card className="border-rose-500/20 bg-rose-500/5">
        <div className="space-y-4">
          <MonthNavigator label={navigator.label} onPrev={navigator.goToPrev} onNext={navigator.goToNext} isCurrentMonth={navigator.isCurrentMonth} onToday={navigator.goToToday} />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-rose-500/20 p-3">
                <ArrowDownCircle className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-rose-500/80">Total Spent</p>
                <h3 className="text-4xl font-black text-rose-500">{formatCurrency(totalMonthlyExpense)}</h3>
                <p className="text-sm text-slate-400">
                  Budget: {formatCurrency(budget)} ({budget > 0 ? Math.round((totalMonthlyExpense / budget) * 100) : 0}% used)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryTotals.map(([category, amount]) => (
                <span key={category}>
                  <Badge variant="warning" className="px-3 py-1 text-xs normal-case tracking-normal">
                    {category} {formatCurrency(amount)}
                  </Badge>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {[
          { id: "entries", label: "Entries" },
          { id: "transfers", label: "Transfers" },
          { id: "recurring", label: "Recurring" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id as ExpenseTab)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeSubTab === tab.id ? "bg-emerald-500 text-white" : "text-slate-400"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "entries" && (
        <div className="space-y-4">
          {groupedExpenses.length === 0 ? (
            <Card><div className="py-12 text-center text-slate-500">No expenses recorded for this month.</div></Card>
          ) : groupedExpenses.map((group) => (
            <div key={group.date}>
            <Card className="overflow-hidden">
              <div className="-m-6">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/70 px-6 py-4">
                  <span className="font-semibold text-slate-200">{group.displayDate}</span>
                  <span className="font-bold text-rose-400">Expense: {formatCurrency(group.dayExpense)}</span>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {group.items.map((entry: ExpenseEntry) => (
                    <div key={entry.id} className="flex flex-col justify-between gap-4 px-6 py-4 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="info">{entry.category}</Badge>
                          {entry.isAutoGenerated && <Badge variant="warning">Auto</Badge>}
                          {!entry.fromAccountId && (
                            <button onClick={() => setQuickAssign(entry)}>
                              <Badge variant="warning">Account?</Badge>
                            </button>
                          )}
                        </div>
                        <div className="mt-2 font-semibold text-slate-100">{entry.description || entry.category}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {entry.fromAccountName || "Account not assigned"}{entry.fromAccountName ? ` · ${entry.paymentMethod}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-rose-400">{formatCurrency(entry.amount)}</div>
                          <div className="text-xs text-slate-500">{entry.paymentMethod}</div>
                        </div>
                        {!entry.isAutoGenerated && (
                          <>
                            <button onClick={() => { setEditingEntry(entry); setIsExpenseModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => updateData(deleteExpenseEntry(data, entry))} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === "transfers" && (
        <div className="space-y-4">
          <Card className="border-slate-700 bg-slate-900">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-slate-800 p-3">
                <ArrowLeftRight className="h-8 w-8 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Transfers This Month</p>
                <h3 className="text-4xl font-black text-slate-100">{filteredTransfers.length}</h3>
                <p className="text-sm text-slate-400">{formatCurrency(monthlyTransfersAmount)} moved between accounts</p>
              </div>
            </div>
          </Card>
          {filteredTransfers.length === 0 ? (
            <Card><div className="py-12 text-center text-slate-500">No transfers recorded for this month.</div></Card>
          ) : (
            groupTransactionsByDate(filteredTransfers, "mixed").map((group) => (
              <div key={group.date}>
              <Card className="overflow-hidden">
                <div className="-m-6">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/70 px-6 py-4">
                    <span className="font-semibold text-slate-200">{group.displayDate}</span>
                    <span className="font-bold text-slate-300">Moved: {formatCurrency(group.items.reduce((sum, item) => sum + item.amount, 0))}</span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {group.items.map((entry: TransferEntry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Transfer</Badge>
                            <span className="text-sm text-slate-300">{entry.fromAccountName} → {entry.toAccountName}</span>
                          </div>
                          <div className="mt-2 font-semibold text-slate-100">{entry.description || "Transfer"}</div>
                          <div className="text-sm text-slate-400">Fees: {formatCurrency(entry.fees)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-slate-100">{formatCurrency(entry.amount)}</div>
                            <div className="text-xs text-slate-500">⇄ Transfer</div>
                          </div>
                          <button onClick={() => { setEditingTransfer(entry); setIsTransferModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => updateData(deleteTransferEntry(data, entry))} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
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
      )}

      {activeSubTab === "recurring" && (
        <Card title="Recurring Rules" subtitle="Expanded myMoney-style repeat schedules with account debits.">
          <div className="space-y-3">
            {data.recurringRules.map((rule) => (
              <div key={rule.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center">
                <div>
                  <div className="font-semibold text-slate-100">{rule.name}</div>
                  <div className="text-sm text-slate-400">{rule.frequency} • {rule.fromAccountName || "Account?"} • {formatCurrency(rule.amount)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rule.isActive ? "success" : "warning"}>{rule.isActive ? "Active" : "Paused"}</Badge>
                  <button onClick={() => { setEditingRule(rule); setIsRuleModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => updateData({ recurringRules: data.recurringRules.filter((item) => item.id !== rule.id) })} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {data.recurringRules.length === 0 && <div className="py-8 text-center text-slate-500">No recurring rules yet.</div>}
          </div>
        </Card>
      )}

      <ExpenseFormModal data={data} entry={editingEntry} isOpen={isExpenseModalOpen} onClose={() => { setIsExpenseModalOpen(false); setEditingEntry(null); }} onSave={saveExpense} />
      <TransferFormModal data={data} entry={editingTransfer} isOpen={isTransferModalOpen} onClose={() => { setIsTransferModalOpen(false); setEditingTransfer(null); }} onSave={saveTransfer} />
      <RecurringRuleModal data={data} rule={editingRule} isOpen={isRuleModalOpen} onClose={() => { setIsRuleModalOpen(false); setEditingRule(null); }} updateData={updateData} />
      <QuickAssignExpenseModal data={data} entry={quickAssign} onClose={() => setQuickAssign(null)} updateData={updateData} />
    </div>
  );
}

function ExpenseFormModal({ data, entry, isOpen, onClose, onSave }: { data: PortfolioData; entry: ExpenseEntry | null; isOpen: boolean; onClose: () => void; onSave: (entry: ExpenseEntry) => void }) {
  const accounts = getAllAccounts(data);
  const [selectedAccountId, setSelectedAccountId] = useState(entry?.fromAccountId || accounts[0]?.id || "acc_cash");
  const isCash = isCashAccount(selectedAccountId);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entry ? "Edit Expense" : "Add Expense"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const fromAccountId = selectedAccountId;
          onSave({
            id: entry?.id || Date.now().toString(),
            date: String(formData.get("date")),
            category: formData.get("category") as ExpenseCategory,
            amount: Number(formData.get("amount")),
            fromAccountId,
            fromAccountName: accounts.find((account) => account.id === fromAccountId)?.bankName || null,
            paymentMethod: (isCash ? "Cash" : formData.get("paymentMethod")) as PaymentMethod,
            description: String(formData.get("description") || "") || undefined,
            isAutoGenerated: entry?.isAutoGenerated,
            recurringRuleId: entry?.recurringRuleId,
          });
        }}
        className="space-y-4"
      >
        <Input label="Date" name="date" type="date" required defaultValue={entry?.date || new Date().toISOString().slice(0, 10)} />
        <Input label="Amount" name="amount" type="number" required defaultValue={entry?.amount} />
        <Select label="Category" name="category" defaultValue={entry?.category || "Food"}>
          {getExpenseCategories().map((category) => <option key={category} value={category}>{category}</option>)}
        </Select>
        <Select label="Paid From" name="fromAccountId" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
        </Select>
        {!isCash && (
          <Select label="Payment Method" name="paymentMethod" defaultValue={entry?.paymentMethod || "UPI"}>
            {getExpenseMethods().filter((method) => method !== "Cash").map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
        )}
        <Input label="Description / Note" name="description" defaultValue={entry?.description} />
        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1">{entry ? "Update" : "Add"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function TransferFormModal({ data, entry, isOpen, onClose, onSave }: { data: PortfolioData; entry: TransferEntry | null; isOpen: boolean; onClose: () => void; onSave: (entry: TransferEntry) => void }) {
  const accounts = getAllAccounts(data);
  const [fromAccountId, setFromAccountId] = useState(entry?.fromAccountId || accounts[0]?.id || "acc_cash");
  const [toAccountId, setToAccountId] = useState(entry?.toAccountId || accounts[1]?.id || accounts[0]?.id || "acc_cash");
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entry ? "Edit Transfer" : "Add Transfer"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (fromAccountId === toAccountId) {
            alert("From Account and To Account cannot be the same.");
            return;
          }
          const formData = new FormData(event.currentTarget);
          onSave({
            id: entry?.id || `txfr_${Date.now()}`,
            date: String(formData.get("date")),
            amount: Number(formData.get("amount")),
            fromAccountId,
            fromAccountName: accounts.find((account) => account.id === fromAccountId)?.bankName || "",
            toAccountId,
            toAccountName: accounts.find((account) => account.id === toAccountId)?.bankName || "",
            description: String(formData.get("description") || "") || undefined,
            fees: Number(formData.get("fees") || 0),
          });
        }}
        className="space-y-4"
      >
        <Input label="Date" name="date" type="date" required defaultValue={entry?.date || new Date().toISOString().slice(0, 10)} />
        <Input label="Amount" name="amount" type="number" required defaultValue={entry?.amount} />
        <Select label="From Account" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}</Select>
        <Select label="To Account" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}</Select>
        <Input label="Transfer Fees" name="fees" type="number" defaultValue={entry?.fees || 0} />
        <Input label="Description / Note" name="description" defaultValue={entry?.description} />
        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1">{entry ? "Update Transfer" : "Add Transfer"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function RecurringRuleModal({ data, rule, isOpen, onClose, updateData }: { data: PortfolioData; rule: RecurringRule | null; isOpen: boolean; onClose: () => void; updateData: (d: Partial<PortfolioData>) => void }) {
  const accounts = getAllAccounts(data);
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency || "monthly");
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={rule ? "Edit Recurring Rule" : "Add Recurring Rule"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const fromAccountId = String(formData.get("fromAccountId"));
          const nextRule: RecurringRule = {
            id: rule?.id || `rec_${Date.now()}`,
            name: String(formData.get("name")),
            amount: Number(formData.get("amount")),
            category: formData.get("category") as ExpenseCategory,
            paymentMethod: formData.get("paymentMethod") as PaymentMethod,
            fromAccountId,
            fromAccountName: accounts.find((account) => account.id === fromAccountId)?.bankName || null,
            description: String(formData.get("description") || "") || undefined,
            frequency,
            dayOfMonth: formData.get("dayOfMonth") ? Number(formData.get("dayOfMonth")) : undefined,
            dayOfWeek: formData.get("dayOfWeek") ? Number(formData.get("dayOfWeek")) : undefined,
            monthOfYear: formData.get("monthOfYear") ? Number(formData.get("monthOfYear")) : undefined,
            startDate: String(formData.get("startDate")),
            endDate: String(formData.get("endDate") || "") || null,
            isActive: formData.get("isActive") === "on",
            lastProcessedMonth: rule?.lastProcessedMonth || String(formData.get("startDate")).slice(0, 7),
          };
          updateData({ recurringRules: rule ? data.recurringRules.map((item) => item.id === rule.id ? nextRule : item) : [...data.recurringRules, nextRule] });
          onClose();
        }}
        className="space-y-4"
      >
        <Input label="Rule Name" name="name" required defaultValue={rule?.name} />
        <Input label="Amount" name="amount" type="number" required defaultValue={rule?.amount} />
        <Select label="Category" name="category" defaultValue={rule?.category || "Entertainment"}>{getExpenseCategories().map((category) => <option key={category} value={category}>{category}</option>)}</Select>
        <Select label="Paid From" name="fromAccountId" defaultValue={rule?.fromAccountId || accounts[0]?.id}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}</Select>
        <Select label="Payment Method" name="paymentMethod" defaultValue={rule?.paymentMethod || "Card"}>{getExpenseMethods().map((method) => <option key={method} value={method}>{method}</option>)}</Select>
        <Input label="Description" name="description" defaultValue={rule?.description} />
        <Select label="Frequency" name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringFrequency)}>
          {recurringOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Input label="Start Date" name="startDate" type="date" required defaultValue={rule?.startDate || new Date().toISOString().slice(0, 10)} />
        {["weekly", "biweekly", "every4weeks"].includes(frequency) && <Select label="Day Of Week" name="dayOfWeek" defaultValue={String(rule?.dayOfWeek ?? 1)}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label, index) => <option key={label} value={index}>{label}</option>)}</Select>}
        {["monthly", "every2months", "every3months", "every4months", "every6months", "yearly"].includes(frequency) && <Input label="Day Of Month" name="dayOfMonth" type="number" min="1" max="31" defaultValue={rule?.dayOfMonth || 1} />}
        {frequency === "yearly" && <Select label="Month Of Year" name="monthOfYear" defaultValue={String(rule?.monthOfYear || 1)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}</option>)}</Select>}
        <Input label="End Date" name="endDate" type="date" defaultValue={rule?.endDate || ""} />
        <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          <input type="checkbox" name="isActive" defaultChecked={rule?.isActive ?? true} />
          Active
        </label>
        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1"><Repeat className="h-4 w-4" /> {rule ? "Update Rule" : "Create Rule"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function QuickAssignExpenseModal({ data, entry, onClose, updateData }: { data: PortfolioData; entry: ExpenseEntry | null; onClose: () => void; updateData: (d: Partial<PortfolioData>) => void }) {
  const accounts = getAllAccounts(data);
  if (!entry) return null;
  return (
    <Modal isOpen={!!entry} onClose={onClose} title="Assign Account">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          {entry.description || entry.category} • {formatCurrency(entry.amount)}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                updateData(saveExpenseEntry(data, { ...entry, fromAccountId: account.id, fromAccountName: account.bankName, paymentMethod: account.isCash ? "Cash" : entry.paymentMethod || "UPI" }, entry));
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
