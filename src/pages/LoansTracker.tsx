import React, { useState } from "react";
import { PortfolioData, Loan, LoanType } from "../types";
import { Card, Button, Input, Select, Table, Modal, Badge } from "../components/UI";
import { Plus, Trash2, Edit2, CreditCard, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";

export default function LoansTracker({ data, updateData }: { data: PortfolioData, updateData: (d: Partial<PortfolioData>) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const totalOutstanding = data.loans.reduce((sum, l) => sum + l.outstandingBalance, 0);

  const sortedLoans = [...data.loans].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key as keyof Loan];
    const valB = b[key as keyof Loan];
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
    const loan: Loan = {
      id: editingLoan?.id || Date.now().toString(),
      lenderName: formData.get("lenderName") as string,
      loanType: formData.get("loanType") as LoanType,
      principalAmount: Number(formData.get("principalAmount")),
      outstandingBalance: Number(formData.get("outstandingBalance")),
      emiAmount: Number(formData.get("emiAmount")),
      interestRate: Number(formData.get("interestRate")),
      emiDate: Number(formData.get("emiDate")),
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
    };

    if (editingLoan) {
      updateData({ loans: data.loans.map(l => l.id === editingLoan.id ? loan : l) });
    } else {
      updateData({ loans: [...data.loans, loan] });
    }
    setIsModalOpen(false);
    setEditingLoan(null);
  };

  const deleteLoan = (id: string) => {
    if (confirm("Are you sure you want to delete this loan entry?")) {
      updateData({ loans: data.loans.filter(l => l.id !== id) });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Loans & EMI</h2>
          <p className="text-slate-400">Track your liabilities and monthly EMI obligations.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Loan
        </Button>
      </div>

      <Card className="bg-rose-500/5 border-rose-500/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500/20 rounded-xl">
            <CreditCard className="w-8 h-8 text-rose-500" />
          </div>
          <div>
            <p className="text-sm text-rose-500/80 font-bold uppercase tracking-wider">Total Outstanding Debt</p>
            <h3 className="text-4xl font-black text-rose-500">{formatCurrency(totalOutstanding)}</h3>
          </div>
        </div>
      </Card>

      <Card>
        {data.loans.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No active loans recorded.</div>
        ) : (
          <Table 
            headers={[
              { label: "Lender", key: "lenderName" }, 
              { label: "Type", key: "loanType" }, 
              { label: "Outstanding", key: "outstandingBalance" }, 
              { label: "EMI", key: "emiAmount" }, 
              { label: "EMI Date", key: "emiDate" }, 
              { label: "Actions" }
            ]}
            onSort={handleSort}
            sortConfig={sortConfig || undefined}
          >
            {sortedLoans.map((loan) => (
              <tr key={loan.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-4 font-semibold text-slate-200">{loan.lenderName}</td>
                <td className="px-4 py-4"><Badge variant="danger">{loan.loanType}</Badge></td>
                <td className="px-4 py-4 font-bold text-rose-500">{formatCurrency(loan.outstandingBalance)}</td>
                <td className="px-4 py-4 text-slate-300">{formatCurrency(loan.emiAmount)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Day {loan.emiDate}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingLoan(loan); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteLoan(loan.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingLoan(null); }} 
        title={editingLoan ? "Edit Loan" : "Add Loan"}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Lender Name" name="lenderName" required defaultValue={editingLoan?.lenderName} className="md:col-span-2" />
          <Select label="Loan Type" name="loanType" defaultValue={editingLoan?.loanType || "Personal"}>
            <option value="Home">Home</option>
            <option value="Personal">Personal</option>
            <option value="Vehicle">Vehicle</option>
            <option value="Education">Education</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Other">Other</option>
          </Select>
          <Input label="Interest Rate (%)" name="interestRate" type="number" step="0.01" required defaultValue={editingLoan?.interestRate} />
          <Input label="Principal Amount" name="principalAmount" type="number" required defaultValue={editingLoan?.principalAmount} />
          <Input label="Outstanding Balance" name="outstandingBalance" type="number" required defaultValue={editingLoan?.outstandingBalance} />
          <Input label="EMI Amount" name="emiAmount" type="number" required defaultValue={editingLoan?.emiAmount} />
          <Input label="EMI Date (Day of Month)" name="emiDate" type="number" min={1} max={31} required defaultValue={editingLoan?.emiDate} />
          <Input label="Start Date" name="startDate" type="date" required defaultValue={editingLoan?.startDate} />
          <Input label="End Date" name="endDate" type="date" required defaultValue={editingLoan?.endDate} />
          
          <div className="md:col-span-2 pt-4 flex gap-3">
            <Button type="submit" className="flex-1">{editingLoan ? "Update" : "Add"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingLoan(null); }}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
