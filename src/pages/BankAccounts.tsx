import React, { useState } from "react";
import { PortfolioData, BankAccount, AccountType } from "../types";
import { Card, Button, Input, Select, Table, Modal, Badge } from "../components/UI";
import { Plus, Trash2, Edit2, Building2 } from "lucide-react";
import { formatCurrency } from "../lib/utils";

export default function BankAccounts({ data, updateData }: { data: PortfolioData, updateData: (d: Partial<PortfolioData>) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const totalBalance = data.bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  const sortedAccounts = [...data.bankAccounts].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key as keyof BankAccount];
    const valB = b[key as keyof BankAccount];
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const account: BankAccount = {
      id: editingAccount?.id || Date.now().toString(),
      bankName: formData.get("bankName") as string,
      accountType: formData.get("accountType") as AccountType,
      accountNumber: formData.get("accountNumber") as string,
      balance: Number(formData.get("balance")),
      notes: formData.get("notes") as string,
    };

    if (editingAccount) {
      updateData({
        bankAccounts: data.bankAccounts.map((a) => (a.id === editingAccount.id ? account : a)),
      });
    } else {
      updateData({
        bankAccounts: [...data.bankAccounts, account],
      });
    }
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const deleteAccount = (id: string) => {
    if (confirm("Are you sure you want to delete this bank account?")) {
      updateData({
        bankAccounts: data.bankAccounts.filter((a) => a.id !== id),
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Bank Accounts</h2>
          <p className="text-slate-400">Manage your savings, current, and salary accounts.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Account
        </Button>
      </div>

      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <Building2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-emerald-500/80 font-bold uppercase tracking-wider">Total Liquidity</p>
            <h3 className="text-4xl font-black text-emerald-500">{formatCurrency(totalBalance)}</h3>
          </div>
        </div>
      </Card>

      <Card>
        {data.bankAccounts.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400">No bank accounts added yet.</p>
            <Button variant="secondary" onClick={() => setIsModalOpen(true)}>Add your first account</Button>
          </div>
        ) : (
          <Table 
            headers={[
              { label: "Bank", key: "bankName" }, 
              { label: "Type", key: "accountType" }, 
              { label: "Account No.", key: "accountNumber" }, 
              { label: "Balance", key: "balance" }, 
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {sortedAccounts.map((account) => (
              <tr key={account.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-4 font-semibold text-slate-200">{account.bankName}</td>
                <td className="px-4 py-4">
                  <Badge variant={account.accountType === 'Salary' ? 'success' : 'info'}>
                    {account.accountType}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-slate-400 font-mono">**** {account.accountNumber}</td>
                <td className="px-4 py-4 font-bold text-emerald-500">{formatCurrency(account.balance)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingAccount(account);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteAccount(account.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingAccount(null);
        }} 
        title={editingAccount ? "Edit Account" : "Add Bank Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Bank Name" 
            name="bankName" 
            required 
            defaultValue={editingAccount?.bankName}
            placeholder="e.g. HDFC Bank"
          />
          <Select label="Account Type" name="accountType" defaultValue={editingAccount?.accountType || "Savings"}>
            <option value="Savings">Savings</option>
            <option value="Current">Current</option>
            <option value="Salary">Salary</option>
          </Select>
          <Input 
            label="Account Number (Last 4 digits)" 
            name="accountNumber" 
            required 
            maxLength={4}
            defaultValue={editingAccount?.accountNumber}
            placeholder="1234"
          />
          <Input 
            label="Current Balance" 
            name="balance" 
            type="number" 
            min="0"
            required 
            defaultValue={editingAccount?.balance}
            placeholder="0"
          />
          <Input 
            label="Notes (Optional)" 
            name="notes" 
            defaultValue={editingAccount?.notes}
            placeholder="e.g. Primary savings account"
          />
          <div className="pt-4 flex gap-3">
            <Button type="submit" className="flex-1">
              {editingAccount ? "Update Account" : "Add Account"}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setIsModalOpen(false);
                setEditingAccount(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
