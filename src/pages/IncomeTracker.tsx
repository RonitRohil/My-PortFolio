import React, { useState } from "react";
import { PortfolioData, IncomeEntry, IncomeSource } from "../types";
import { Card, Button, Input, Select, Table, Modal, Badge } from "../components/UI";
import { Plus, Trash2, Edit2, ArrowUpCircle } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";

export default function IncomeTracker({ data, updateData }: { data: PortfolioData, updateData: (d: Partial<PortfolioData>) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const filteredIncome = data.income.filter(i => i.date.startsWith(filterMonth));
  const totalMonthlyIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);

  const sortedIncome = [...filteredIncome].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key as keyof IncomeEntry] || "";
    const valB = b[key as keyof IncomeEntry] || "";
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
    const entry: IncomeEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date: formData.get("date") as string,
      source: formData.get("source") as IncomeSource,
      amount: Number(formData.get("amount")),
      description: formData.get("description") as string,
    };

    if (editingEntry) {
      updateData({ income: data.income.map(i => i.id === editingEntry.id ? entry : i) });
    } else {
      updateData({ income: [...data.income, entry] });
    }
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const deleteEntry = (id: string) => {
    if (confirm("Are you sure you want to delete this income entry?")) {
      updateData({ income: data.income.filter(i => i.id !== id) });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Income Tracker</h2>
          <p className="text-slate-400">Monitor your cash inflows from all sources.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-40"
          />
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Income
          </Button>
        </div>
      </div>

      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <ArrowUpCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-emerald-500/80 font-bold uppercase tracking-wider">Monthly Income ({filterMonth})</p>
            <h3 className="text-4xl font-black text-emerald-500">{formatCurrency(totalMonthlyIncome)}</h3>
          </div>
        </div>
      </Card>

      <Card>
        {filteredIncome.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No income entries for this month.</div>
        ) : (
          <Table 
            headers={[
              { label: "Date", key: "date" }, 
              { label: "Source", key: "source" }, 
              { label: "Description", key: "description" }, 
              { label: "Amount", key: "amount" }, 
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {sortedIncome.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-4 text-slate-400">{formatDate(entry.date)}</td>
                <td className="px-4 py-4">
                  <Badge variant="success">{entry.source}</Badge>
                </td>
                <td className="px-4 py-4 text-slate-300">{entry.description || "-"}</td>
                <td className="px-4 py-4 font-bold text-emerald-500">{formatCurrency(entry.amount)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500 transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteEntry(entry.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
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
        title={editingEntry ? "Edit Income" : "Add Income"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Date" name="date" type="date" required defaultValue={editingEntry?.date || new Date().toISOString().split('T')[0]} />
          <Select label="Source" name="source" defaultValue={editingEntry?.source || "Salary"}>
            <option value="Salary">Salary</option>
            <option value="Freelance">Freelance</option>
            <option value="Dividends">Dividends</option>
            <option value="Interest">Interest</option>
            <option value="Rental">Rental</option>
            <option value="Other">Other</option>
          </Select>
          <Input label="Amount" name="amount" type="number" min="0" required defaultValue={editingEntry?.amount} placeholder="0" />
          <Input label="Description" name="description" defaultValue={editingEntry?.description} placeholder="e.g. Monthly salary" />
          <div className="pt-4 flex gap-3">
            <Button type="submit" className="flex-1">{editingEntry ? "Update" : "Add"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingEntry(null); }}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
