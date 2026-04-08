import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Edit2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select } from "../components/UI";
import MonthNavigator from "../components/MonthNavigator";
import { useMonthNavigator } from "../hooks/useMonthNavigator";
import { groupTransactionsByDate } from "../utils/groupByDate";
import {
  ExpenseCategory,
  ExpenseEntry,
  IncomeEntry,
  IncomeSource,
  PaymentMethod,
  PortfolioData,
  TransferEntry,
} from "../types";
import {
  deleteExpenseEntry,
  deleteIncomeEntry,
  deleteTransferEntry,
  filterByMonth,
  formatCurrency,
  getAllAccounts,
  getExpenseCategories,
  getExpenseMethods,
  getIncomeSources,
  getProjectedAccountBalance,
  isCashAccount,
  saveExpenseEntry,
  saveIncomeEntry,
  saveTransferEntry,
} from "../lib/utils";

type TxType = "income" | "expense" | "transfer";

type UnifiedTx = {
  id: string;
  date: string;
  amount: number;
  type: TxType;
  description: string;
  categoryLine: string;
  accountLine: string;
  raw: IncomeEntry | ExpenseEntry | TransferEntry;
};

function formatMobileGroupDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  const shortDate = value.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const shortWeekday = value.toLocaleDateString("en-IN", { weekday: "short" });
  return `${shortDate} · ${shortWeekday}`;
}

export default function Transactions({ data, updateData }: { data: PortfolioData; updateData: (d: Partial<PortfolioData>) => void }) {
  const navigator = useMonthNavigator();
  const accounts = getAllAccounts(data);
  const [activeTypes, setActiveTypes] = useState<Set<TxType>>(new Set());
  const [activeAccounts, setActiveAccounts] = useState<Set<string>>(new Set());
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<TxType>("expense");
  const [editingTx, setEditingTx] = useState<UnifiedTx | null>(null);
  const [quickAssignIncome, setQuickAssignIncome] = useState<IncomeEntry | null>(null);
  const [quickAssignExpense, setQuickAssignExpense] = useState<ExpenseEntry | null>(null);

  const monthIncome = filterByMonth(data.income, navigator.year, navigator.month);
  const monthExpenses = filterByMonth(data.expenses, navigator.year, navigator.month);
  const monthTransfers = filterByMonth(data.transfers, navigator.year, navigator.month);

  useEffect(() => {
    if (sessionStorage.getItem("transactions_filter_mode") === "unassigned") {
      setShowOnlyUnassigned(true);
      sessionStorage.removeItem("transactions_filter_mode");
    }
  }, []);

  const unified = useMemo<UnifiedTx[]>(() => {
    const income = monthIncome.map((entry) => ({
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      type: "income" as const,
      description: entry.description || entry.source,
      categoryLine: entry.source,
      accountLine: `Received in ${entry.toAccountName || "Account?"}`,
      raw: entry,
    }));
    const expenses = monthExpenses.map((entry) => ({
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      type: "expense" as const,
      description: entry.description || entry.category,
      categoryLine: entry.category,
      accountLine: `${entry.fromAccountName || "Account?"}${entry.fromAccountName ? ` | ${entry.paymentMethod}` : ""}`,
      raw: entry,
    }));
    const transfers = monthTransfers.map((entry) => ({
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      type: "transfer" as const,
      description: entry.description || "Transfer",
      categoryLine: "Transfer",
      accountLine: `${entry.fromAccountName} -> ${entry.toAccountName}`,
      raw: entry,
    }));
    return [...income, ...expenses, ...transfers].sort((a, b) => b.date.localeCompare(a.date));
  }, [monthExpenses, monthIncome, monthTransfers]);

  const filtered = unified.filter((tx) => {
    if (showOnlyUnassigned) {
      if (tx.type === "income" && (tx.raw as IncomeEntry).toAccountId) return false;
      if (tx.type === "expense" && (tx.raw as ExpenseEntry).fromAccountId) return false;
      if (tx.type === "transfer") return false;
    }
    if (activeTypes.size > 0 && !activeTypes.has(tx.type)) return false;
    if (activeAccounts.size > 0) {
      if (tx.type === "income") {
        const entry = tx.raw as IncomeEntry;
        if (!entry.toAccountId || !activeAccounts.has(entry.toAccountId)) return false;
      }
      if (tx.type === "expense") {
        const entry = tx.raw as ExpenseEntry;
        if (!entry.fromAccountId || !activeAccounts.has(entry.fromAccountId)) return false;
      }
      if (tx.type === "transfer") {
        const entry = tx.raw as TransferEntry;
        if (!activeAccounts.has(entry.fromAccountId) && !activeAccounts.has(entry.toAccountId)) return false;
      }
    }
    return true;
  });

  const grouped = groupTransactionsByDate(filtered, "mixed");

  const toggleType = (type: TxType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleAccount = (accountId: string) => {
    setActiveAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const resetFilters = () => {
    setActiveTypes(new Set());
    setActiveAccounts(new Set());
    setShowOnlyUnassigned(false);
  };

  const openEdit = (tx: UnifiedTx) => {
    setFormType(tx.type);
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  const saveIncome = (entry: IncomeEntry) => updateData(saveIncomeEntry(data, entry, editingTx?.raw as IncomeEntry | undefined));
  const saveExpense = (entry: ExpenseEntry) => updateData(saveExpenseEntry(data, entry, editingTx?.raw as ExpenseEntry | undefined));
  const saveTransfer = (entry: TransferEntry) => updateData(saveTransferEntry(data, entry, editingTx?.raw as TransferEntry | undefined));

  const deleteTx = (tx: UnifiedTx) => {
    if (tx.type === "income") updateData(deleteIncomeEntry(data, tx.raw as IncomeEntry));
    if (tx.type === "expense") updateData(deleteExpenseEntry(data, tx.raw as ExpenseEntry));
    if (tx.type === "transfer") updateData(deleteTransferEntry(data, tx.raw as TransferEntry));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Transactions</h2>
          <p className="text-slate-400">Income, expense, and transfers in one feed.</p>
        </div>
        <Button onClick={() => { setEditingTx(null); setFormType("expense"); setIsModalOpen(true); }} className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Transaction
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <div className="space-y-4">
          <MonthNavigator label={navigator.label} onPrev={navigator.goToPrev} onNext={navigator.goToNext} isCurrentMonth={navigator.isCurrentMonth} onToday={navigator.goToToday} />
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
            <Pill active={activeTypes.size === 0 && activeAccounts.size === 0} onClick={resetFilters}>
              All
            </Pill>
            <Pill active={showOnlyUnassigned} onClick={() => setShowOnlyUnassigned((value) => !value)}>
              Needs Account
            </Pill>
            <Pill active={activeTypes.has("income")} onClick={() => toggleType("income")}>Income</Pill>
            <Pill active={activeTypes.has("expense")} onClick={() => toggleType("expense")}>Expense</Pill>
            <Pill active={activeTypes.has("transfer")} onClick={() => toggleType("transfer")}>Transfer</Pill>
            {accounts.map((account) => (
              <React.Fragment key={account.id}>
                <Pill active={activeAccounts.has(account.id)} onClick={() => toggleAccount(account.id)}>
                  {account.bankName}
                </Pill>
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card><div className="py-12 text-center text-slate-500">No transactions for this month.</div></Card>
      ) : (
        grouped.map((group) => {
          const dayIncome = group.items.filter((item) => (item as UnifiedTx).type === "income").reduce((sum, item) => sum + (item as UnifiedTx).amount, 0);
          const dayExpense = group.items.filter((item) => (item as UnifiedTx).type === "expense").reduce((sum, item) => sum + (item as UnifiedTx).amount, 0);
          return (
            <div key={group.date}>
              <Card className="overflow-hidden">
                <div className="-m-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-800/70 px-6 py-4">
                    <span className="font-semibold text-slate-200 transaction-date-header">
                      <span className="transaction-date-header-desktop">{group.displayDate}</span>
                      <span className="transaction-date-header-mobile">{formatMobileGroupDate(group.date)}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      {dayIncome > 0 && <span className="font-bold text-emerald-400">Income: {formatCurrency(dayIncome)}</span>}
                      {dayExpense > 0 && <span className="font-bold text-rose-400">Expense: {formatCurrency(dayExpense)}</span>}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {group.items.map((item) => {
                      const tx = item as UnifiedTx;
                      const isAutoGenerated = tx.type === "expense" && (tx.raw as ExpenseEntry).isAutoGenerated;
                      const hasMissingAccount =
                        (tx.type === "income" && !(tx.raw as IncomeEntry).toAccountId) ||
                        (tx.type === "expense" && !(tx.raw as ExpenseEntry).fromAccountId);
                      return (
                        <div key={`${tx.type}-${tx.id}`} className="transaction-row flex flex-col justify-between gap-4 px-6 py-4 md:flex-row md:items-start">
                          <div className="transaction-main flex items-start gap-3 min-w-0">
                            <div className="transaction-icon rounded-xl bg-slate-800 p-2 text-slate-300 shrink-0">
                              {tx.type === "income" && <ArrowUpCircle className="h-5 w-5" />}
                              {tx.type === "expense" && <ArrowDownCircle className="h-5 w-5" />}
                              {tx.type === "transfer" && <ArrowLeftRight className="h-5 w-5" />}
                            </div>
                            <div className="transaction-copy min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="transaction-description font-semibold text-slate-100">{tx.description}</span>
                                {isAutoGenerated && (
                                  <span title="This entry is auto-generated from your SIP/RD schedule">
                                    <Badge variant="warning">Auto</Badge>
                                  </span>
                                )}
                                {hasMissingAccount && (
                                  <button
                                    onClick={() => {
                                      if (tx.type === "income") setQuickAssignIncome(tx.raw as IncomeEntry);
                                      if (tx.type === "expense") setQuickAssignExpense(tx.raw as ExpenseEntry);
                                    }}
                                  >
                                    <Badge variant="warning">Account?</Badge>
                                  </button>
                                )}
                              </div>
                              <div className="text-sm text-slate-400">{tx.categoryLine}</div>
                              <div className="text-xs text-slate-500">{tx.accountLine}</div>
                            </div>
                          </div>
                          <div className="transaction-meta flex items-center gap-3">
                            <div className={`transaction-amount-wrap text-right ${tx.type === "income" ? "text-emerald-400" : tx.type === "expense" ? "text-rose-400" : "text-slate-200"}`}>
                              <div className="font-bold">
                                {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""} {formatCurrency(tx.amount)}
                              </div>
                              <div className="transaction-account-mobile text-xs font-medium text-slate-500">{tx.accountLine}</div>
                            </div>
                            <div className="transaction-actions flex items-center gap-3">
                              {!isAutoGenerated && (
                                <>
                                  <button onClick={() => openEdit(tx)} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="h-4 w-4" /></button>
                                  <button onClick={() => deleteTx(tx)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                                </>
                              )}
                              {isAutoGenerated && (
                                <span className="text-xs text-slate-500" title="This entry is auto-generated from your SIP/RD schedule">
                                  Auto
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          );
        })
      )}

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTx(null); }}
        formType={formType}
        setFormType={setFormType}
        data={data}
        editingTx={editingTx}
        onSaveIncome={saveIncome}
        onSaveExpense={saveExpense}
        onSaveTransfer={saveTransfer}
      />
      <QuickAssignIncomeModal data={data} entry={quickAssignIncome} onClose={() => setQuickAssignIncome(null)} updateData={updateData} />
      <QuickAssignExpenseModal data={data} entry={quickAssignExpense} onClose={() => setQuickAssignExpense(null)} updateData={updateData} />
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"}`}>
      {children}
    </button>
  );
}

function TransactionModal({
  isOpen,
  onClose,
  formType,
  setFormType,
  data,
  editingTx,
  onSaveIncome,
  onSaveExpense,
  onSaveTransfer,
}: {
  isOpen: boolean;
  onClose: () => void;
  formType: TxType;
  setFormType: (type: TxType) => void;
  data: PortfolioData;
  editingTx: UnifiedTx | null;
  onSaveIncome: (entry: IncomeEntry) => void;
  onSaveExpense: (entry: ExpenseEntry) => void;
  onSaveTransfer: (entry: TransferEntry) => void;
}) {
  const accounts = getAllAccounts(data);
  const defaultAccount = accounts[0]?.id || "acc_cash";
  const isEditing = Boolean(editingTx);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Transaction" : "Add Transaction"} mobileSheet className="transaction-form-modal">
      <div className="transaction-form-shell space-y-4">
        <div className="flex gap-2">
          {(["income", "expense", "transfer"] as TxType[]).map((type) => (
            <button key={type} onClick={() => setFormType(type)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${formType === type ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-300"}`}>
              {type[0].toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {formType === "income" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const toAccountId = String(formData.get("toAccountId"));
              onSaveIncome({
                id: (editingTx?.raw as IncomeEntry | undefined)?.id || Date.now().toString(),
                date: String(formData.get("date")),
                source: formData.get("source") as IncomeSource,
                amount: Number(formData.get("amount")),
                description: String(formData.get("description") || "") || undefined,
                toAccountId,
                toAccountName: accounts.find((account) => account.id === toAccountId)?.bankName || null,
              });
              onClose();
            }}
            className="space-y-4"
          >
            <Input label="Amount" name="amount" type="number" required defaultValue={(editingTx?.raw as IncomeEntry | undefined)?.amount} />
            <div className="transaction-form-grid-2">
              <Input label="Date" name="date" type="date" required defaultValue={(editingTx?.raw as IncomeEntry | undefined)?.date || new Date().toISOString().slice(0, 10)} />
              <Select label="Source" name="source" defaultValue={(editingTx?.raw as IncomeEntry | undefined)?.source || "Salary"}>
                {getIncomeSources(data).map((source) => <option key={source} value={source}>{source}</option>)}
              </Select>
            </div>
            <Select label="Received In" name="toAccountId" defaultValue={(editingTx?.raw as IncomeEntry | undefined)?.toAccountId || defaultAccount}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
            </Select>
            <Input label="Description / Note" name="description" defaultValue={(editingTx?.raw as IncomeEntry | undefined)?.description} />
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">{isEditing ? "Update" : "Add"}</Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}

        {formType === "expense" && (
          <ExpenseForm data={data} editing={editingTx?.raw as ExpenseEntry | undefined} onSave={onSaveExpense} onClose={onClose} />
        )}

        {formType === "transfer" && (
          <TransferForm data={data} editing={editingTx?.raw as TransferEntry | undefined} onSave={onSaveTransfer} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}

function ExpenseForm({
  data,
  editing,
  onSave,
  onClose,
}: {
  data: PortfolioData;
  editing?: ExpenseEntry;
  onSave: (entry: ExpenseEntry) => void;
  onClose: () => void;
}) {
  const accounts = getAllAccounts(data);
  const [fromAccountId, setFromAccountId] = useState(editing?.fromAccountId || accounts[0]?.id || "acc_cash");
  const cash = isCashAccount(fromAccountId);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const amount = Number(formData.get("amount"));
        const projected = getProjectedAccountBalance(accounts, fromAccountId, -amount + (editing?.fromAccountId === fromAccountId ? editing.amount : 0));
        if (projected < 0 && !confirm(`This expense will make your ${accounts.find((account) => account.id === fromAccountId)?.bankName} balance negative. Continue?`)) return;
        onSave({
          id: editing?.id || Date.now().toString(),
          date: String(formData.get("date")),
          category: formData.get("category") as ExpenseCategory,
          amount,
          fromAccountId,
          fromAccountName: accounts.find((account) => account.id === fromAccountId)?.bankName || null,
          paymentMethod: (cash ? "Cash" : formData.get("paymentMethod")) as PaymentMethod,
          description: String(formData.get("description") || "") || undefined,
          isAutoGenerated: editing?.isAutoGenerated,
          recurringRuleId: editing?.recurringRuleId,
        });
        onClose();
      }}
      className="space-y-4"
    >
      <Input label="Amount" name="amount" type="number" required defaultValue={editing?.amount} />
      <div className="transaction-form-grid-2">
        <Input label="Date" name="date" type="date" required defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} />
        <Select label="Category" name="category" defaultValue={editing?.category || "Food"}>
          {getExpenseCategories(data).map((category) => <option key={category} value={category}>{category}</option>)}
        </Select>
      </div>
      <Select label="Paid From" name="fromAccountId" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
      </Select>
      {!cash && (
        <Select label="Payment Method" name="paymentMethod" defaultValue={editing?.paymentMethod || "UPI"}>
          {getExpenseMethods().filter((method) => method !== "Cash").map((method) => <option key={method} value={method}>{method}</option>)}
        </Select>
      )}
      <Input label="Description / Note" name="description" defaultValue={editing?.description} />
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">{editing ? "Update" : "Add"}</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function TransferForm({
  data,
  editing,
  onSave,
  onClose,
}: {
  data: PortfolioData;
  editing?: TransferEntry;
  onSave: (entry: TransferEntry) => void;
  onClose: () => void;
}) {
  const accounts = getAllAccounts(data);
  const [fromAccountId, setFromAccountId] = useState(editing?.fromAccountId || accounts[0]?.id || "acc_cash");
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId || accounts[1]?.id || accounts[0]?.id || "acc_cash");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (fromAccountId === toAccountId) {
          alert("From Account and To Account cannot be the same.");
          return;
        }
        const formData = new FormData(event.currentTarget);
        const amount = Number(formData.get("amount"));
        const fees = Number(formData.get("fees") || 0);
        const projected = getProjectedAccountBalance(accounts, fromAccountId, -(amount + fees) + (editing?.fromAccountId === fromAccountId ? editing.amount + editing.fees : 0));
        if (projected < 0 && !confirm(`This transfer will make your ${accounts.find((account) => account.id === fromAccountId)?.bankName} balance negative. Continue?`)) return;
        onSave({
          id: editing?.id || `txfr_${Date.now()}`,
          date: String(formData.get("date")),
          amount,
          fromAccountId,
          fromAccountName: accounts.find((account) => account.id === fromAccountId)?.bankName || "",
          toAccountId,
          toAccountName: accounts.find((account) => account.id === toAccountId)?.bankName || "",
          description: String(formData.get("description") || "") || undefined,
          fees,
        });
        onClose();
      }}
      className="space-y-4"
    >
      <Input label="Amount" name="amount" type="number" required defaultValue={editing?.amount} />
      <div className="transaction-form-grid-2">
        <Input label="Date" name="date" type="date" required defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} />
        <Select label="From Account" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
        </Select>
      </div>
      <Select label="To Account" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
      </Select>
      <Input label="Transfer Fees" name="fees" type="number" defaultValue={editing?.fees || 0} />
      <Input label="Description / Note" name="description" defaultValue={editing?.description} />
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">{editing ? "Update" : "Add"}</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
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
          {entry.description || entry.source} - {formatCurrency(entry.amount)}
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

function QuickAssignExpenseModal({
  data,
  entry,
  onClose,
  updateData,
}: {
  data: PortfolioData;
  entry: ExpenseEntry | null;
  onClose: () => void;
  updateData: (d: Partial<PortfolioData>) => void;
}) {
  const accounts = getAllAccounts(data);
  if (!entry) return null;
  return (
    <Modal isOpen={!!entry} onClose={onClose} title="Assign Account">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          {entry.description || entry.category} - {formatCurrency(entry.amount)}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                updateData(
                  saveExpenseEntry(
                    data,
                    {
                      ...entry,
                      fromAccountId: account.id,
                      fromAccountName: account.bankName,
                      paymentMethod: account.isCash ? "Cash" : entry.paymentMethod || "UPI",
                    },
                    entry,
                  ),
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
