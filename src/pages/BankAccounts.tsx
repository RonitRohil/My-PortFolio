import React, { useMemo, useState } from "react";
import { Building2, Edit2, Eye, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select } from "../components/UI";
import { AccountType, BankAccount, PortfolioData } from "../types";
import { formatCurrency, getAllAccounts, getRecentAccountTransactions, getAccountMonthlyStats, monthKey } from "../lib/utils";

export default function BankAccounts({ data, updateData }: { data: PortfolioData; updateData: (d: Partial<PortfolioData>) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const accounts = useMemo(() => getAllAccounts(data), [data]);
  const current = new Date();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const account: BankAccount = {
      id: editingAccount?.id || `acc_${Date.now()}`,
      bankName: String(formData.get("bankName")),
      accountType: formData.get("accountType") as AccountType,
      accountNumber: String(formData.get("accountNumber") || ""),
      balance: Number(formData.get("balance")),
      notes: String(formData.get("notes") || "") || undefined,
      isCash: editingAccount?.isCash,
    };
    updateData({
      bankAccounts: editingAccount
        ? accounts.map((item) => (item.id === editingAccount.id ? account : item))
        : [...accounts, account],
    });
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Bank Accounts</h2>
          <p className="text-slate-400">Every transaction now links back to the account it touched.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Account
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {accounts.map((account) => {
          const stats = getAccountMonthlyStats(data, account.id, current.getFullYear(), current.getMonth());
          const recentTransactions = getRecentAccountTransactions(data, account.id);
          return (
            <div key={account.id}>
            <Card className="min-w-0">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-100">{account.bankName}</h3>
                      <Badge variant={account.isCash ? "warning" : account.balance >= 0 ? "success" : "danger"}>{account.accountType}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{account.accountNumber ? `**** ${account.accountNumber}` : "No account number"}</div>
                  </div>
                  {!account.isCash && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingAccount(account); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => updateData({ bankAccounts: accounts.filter((item) => item.id !== account.id) })} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <div className={`text-4xl font-black ${account.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(account.balance)}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs uppercase tracking-wider text-slate-500">This Month In</div>
                    <div className="mt-2 font-bold text-emerald-400">{formatCurrency(stats.incomeTotal)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs uppercase tracking-wider text-slate-500">This Month Out</div>
                    <div className="mt-2 font-bold text-rose-400">{formatCurrency(stats.expenseTotal)}</div>
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-300">Last 5 Transactions</div>
                    <div className="text-xs text-slate-500">{monthKey(new Date())}</div>
                  </div>
                  <div className="space-y-2">
                    {recentTransactions.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">No transactions yet.</div>}
                    {recentTransactions.map((transaction) => (
                      <div key={`${transaction.kind}-${transaction.id}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                        <div>
                          <div className="font-medium text-slate-200">{transaction.description || ("source" in transaction ? transaction.source : "category" in transaction ? transaction.category : "Transfer")}</div>
                          <div className="text-xs text-slate-500">{transaction.date}</div>
                        </div>
                        <div className={`font-bold ${transaction.kind === "income" ? "text-emerald-400" : transaction.kind === "expense" ? "text-rose-400" : "text-slate-200"}`}>
                          {transaction.kind === "income" ? "+" : transaction.kind === "expense" ? "-" : "⇄"} {formatCurrency(transaction.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="inline-flex items-center gap-2 text-sm text-emerald-400">
                  <Eye className="h-4 w-4" />
                  View All
                </button>
              </div>
            </Card>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAccount(null); }} title={editingAccount ? "Edit Account" : "Add Account"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Account Name" name="bankName" required defaultValue={editingAccount?.bankName} />
          <Select label="Account Type" name="accountType" defaultValue={editingAccount?.accountType || "Savings"}>
            {["Savings", "Current", "Salary"].map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
          <Input label="Account Number (Last 4 digits)" name="accountNumber" maxLength={4} defaultValue={editingAccount?.accountNumber} />
          <Input label="Current Balance" name="balance" type="number" required defaultValue={editingAccount?.balance} />
          <Input label="Notes" name="notes" defaultValue={editingAccount?.notes} />
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">{editingAccount ? "Update Account" : "Add Account"}</Button>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
