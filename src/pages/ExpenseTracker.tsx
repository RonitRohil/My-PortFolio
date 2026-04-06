import React, { useState } from "react";
import { PortfolioData, ExpenseEntry, ExpenseCategory, PaymentMethod } from "../types";
import { Card, Button, Input, Select, Table, Modal, Badge } from "../components/UI";
import { Plus, Trash2, Edit2, ArrowDownCircle, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";

export default function ExpenseTracker({ data, updateData }: { data: PortfolioData, updateData: (d: Partial<PortfolioData>) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const filteredExpenses = data.expenses.filter(e => e.date.startsWith(filterMonth));
  const totalMonthlyExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key as keyof ExpenseEntry] || "";
    const valB = b[key as keyof ExpenseEntry] || "";
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

  const budget = data.settings.monthlyBudget;
  const isOverBudget = totalMonthlyExpense > budget;
  const nearingBudget = totalMonthlyExpense > budget * 0.8;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const entry: ExpenseEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date: formData.get("date") as string,
      category: formData.get("category") as ExpenseCategory,
      amount: Number(formData.get("amount")),
      paymentMethod: formData.get("paymentMethod") as PaymentMethod,
      description: formData.get("description") as string,
    };

    if (editingEntry) {
      updateData({ expenses: data.expenses.map(ex => ex.id === editingEntry.id ? entry : ex) });
    } else {
      updateData({ expenses: [...data.expenses, entry] });
    }
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const deleteEntry = (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      updateData({ expenses: data.expenses.filter(e => e.id !== id) });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Expense Tracker</h2>
          <p className="text-slate-400">Keep track of your spending habits.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-rose-500/5 border-rose-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 rounded-xl">
              <ArrowDownCircle className="w-8 h-8 text-rose-500" />
            </div>
            <div>
              <p className="text-sm text-rose-500/80 font-bold uppercase tracking-wider">Monthly Expense</p>
              <h3 className="text-4xl font-black text-rose-500">{formatCurrency(totalMonthlyExpense)}</h3>
            </div>
          </div>
        </Card>

        <Card className={cn(
          "border-l-4 transition-all",
          isOverBudget ? "border-l-rose-500 bg-rose-500/5" : nearingBudget ? "border-l-amber-500 bg-amber-500/5" : "border-l-emerald-500 bg-emerald-500/5"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">Budget Limit</p>
              <h3 className="text-2xl font-bold">{formatCurrency(budget)}</h3>
            </div>
            {isOverBudget && (
              <div className="flex items-center gap-2 text-rose-500 animate-pulse">
                <AlertCircle className="w-6 h-6" />
                <span className="font-bold">Over Budget!</span>
              </div>
            )}
          </div>
          <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                isOverBudget ? "bg-rose-500" : nearingBudget ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min((totalMonthlyExpense / budget) * 100, 100)}%` }}
            />
          </div>
        </Card>
      </div>

      <Card>
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No expenses recorded for this month.</div>
        ) : (
          <Table 
            headers={[
              { label: "Date", key: "date" }, 
              { label: "Category", key: "category" }, 
              { label: "Method", key: "paymentMethod" }, 
              { label: "Description", key: "description" }, 
              { label: "Amount", key: "amount" }, 
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {sortedExpenses.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-4 text-slate-400">{formatDate(entry.date)}</td>
                <td className="px-4 py-4"><Badge variant="info">{entry.category}</Badge></td>
                <td className="px-4 py-4 text-xs text-slate-500 uppercase font-bold">{entry.paymentMethod}</td>
                <td className="px-4 py-4 text-slate-300">{entry.description || "-"}</td>
                <td className="px-4 py-4 font-bold text-rose-500">{formatCurrency(entry.amount)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteEntry(entry.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingEntry(null); }} 
        title={editingEntry ? "Edit Expense" : "Add Expense"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Date" name="date" type="date" required defaultValue={editingEntry?.date || new Date().toISOString().split('T')[0]} />
          <Select label="Category" name="category" defaultValue={editingEntry?.category || "Food"}>
            <option value="Food">Food</option>
            <option value="Rent">Rent</option>
            <option value="EMI">EMI</option>
            <option value="Utilities">Utilities</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Medical">Medical</option>
            <option value="Travel">Travel</option>
            <option value="Investment">Investment</option>
            <option value="Other">Other</option>
          </Select>
          <Select label="Payment Method" name="paymentMethod" defaultValue={editingEntry?.paymentMethod || "UPI"}>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Net Banking">Net Banking</option>
          </Select>
          <Input label="Amount" name="amount" type="number" min="0" required defaultValue={editingEntry?.amount} placeholder="0" />
          <Input label="Description" name="description" defaultValue={editingEntry?.description} placeholder="e.g. Dinner at restaurant" />
          <div className="pt-4 flex gap-3">
            <Button type="submit" className="flex-1">{editingEntry ? "Update" : "Add"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingEntry(null); }}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { cn } from "../lib/utils";
