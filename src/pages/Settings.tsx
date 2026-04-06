import React from "react";
import { PortfolioData } from "../types";
import { Card, Button, Input } from "../components/UI";
import { 
  Download, 
  Upload, 
  Trash2, 
  Database, 
  FileJson, 
  FileSpreadsheet,
  AlertTriangle
} from "lucide-react";
import { clearAllData, getStorageSize } from "../lib/storage";
import { calculateSIPInvested } from "../lib/utils";

export default function Settings({ data, updateData }: { data: PortfolioData, updateData: (d: Partial<PortfolioData>) => void }) {
  
  const exportToJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `myportfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (confirm("This will overwrite all current data. Are you sure?")) {
          updateData(importedData);
          alert("Data imported successfully!");
        }
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const exportToCsv = (type: 'investments' | 'expenses') => {
    let csvContent = "";
    if (type === 'investments') {
      csvContent = "Type,Name,AMC/Bank,Invested,Current\n";
      data.investments.mutualFunds.forEach(m => {
        const sipInv = m.sipDetails ? calculateSIPInvested(m.sipDetails.monthlyAmount, m.sipDetails.startDate) : 0;
        const lumpInv = m.lumpsumEntries.reduce((s, l) => s + l.amount, 0);
        csvContent += `MF,${m.fundName},${m.amc},${sipInv + lumpInv},${m.currentValue}\n`;
      });
      data.investments.stockPortfolios.forEach(p => {
        p.holdings.forEach(s => {
          csvContent += `Stock,${s.companyName},${s.ticker},${s.quantity * s.avgBuyPrice},${s.quantity * s.currentPrice}\n`;
        });
      });
      data.investments.fd.forEach(f => csvContent += `FD,${f.bankName},-,${f.principal},${f.principal}\n`);
    } else {
      csvContent = "Date,Category,Method,Amount,Description\n";
      data.expenses.forEach(e => csvContent += `${e.date},${e.category},${e.paymentMethod},${e.amount},${e.description || ""}\n`);
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `myportfolio_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-100">Data Management</h2>
        <p className="text-slate-400">Backup, restore, and manage your local data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card title="Budget Settings" subtitle="Set your monthly spending limit">
          <div className="space-y-4">
            <Input 
              label="Monthly Budget Limit (₹)" 
              type="number" 
              defaultValue={data.settings.monthlyBudget}
              onChange={(e) => updateData({ settings: { ...data.settings, monthlyBudget: Number(e.target.value) } })}
            />
            <p className="text-xs text-slate-500">
              This limit is used in the Expense Tracker to warn you when you're nearing your budget.
            </p>
          </div>
        </Card>

        <Card title="Storage Info" subtitle="Local browser storage usage">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-500/10 rounded-2xl">
              <Database className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Space Used</p>
              <h3 className="text-2xl font-bold text-slate-100">{getStorageSize()}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center text-center p-8 space-y-4">
          <div className="p-4 bg-blue-500/10 rounded-full">
            <FileJson className="w-8 h-8 text-blue-500" />
          </div>
          <h4 className="font-bold">Full Backup</h4>
          <p className="text-xs text-slate-500">Export all your data as a single JSON file.</p>
          <Button onClick={exportToJson} variant="secondary" className="w-full">
            <Download className="w-4 h-4" /> Export JSON
          </Button>
        </Card>

        <Card className="flex flex-col items-center text-center p-8 space-y-4">
          <div className="p-4 bg-emerald-500/10 rounded-full">
            <Upload className="w-8 h-8 text-emerald-500" />
          </div>
          <h4 className="font-bold">Restore Backup</h4>
          <p className="text-xs text-slate-500">Import data from a previously exported JSON file.</p>
          <label className="w-full">
            <div className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold cursor-pointer transition-all">
              <Upload className="w-4 h-4" /> Import JSON
            </div>
            <input type="file" accept=".json" onChange={importFromJson} className="hidden" />
          </label>
        </Card>

        <Card className="flex flex-col items-center text-center p-8 space-y-4">
          <div className="p-4 bg-amber-500/10 rounded-full">
            <FileSpreadsheet className="w-8 h-8 text-amber-500" />
          </div>
          <h4 className="font-bold">CSV Exports</h4>
          <p className="text-xs text-slate-500">Export specific modules as spreadsheet-friendly CSVs.</p>
          <div className="flex flex-col w-full gap-2">
            <Button onClick={() => exportToCsv('investments')} variant="secondary" size="sm">Investments CSV</Button>
            <Button onClick={() => exportToCsv('expenses')} variant="secondary" size="sm">Expenses CSV</Button>
          </div>
        </Card>
      </div>

      <Card className="border-rose-500/20 bg-rose-500/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <h4 className="font-bold text-rose-500">Danger Zone</h4>
              <p className="text-sm text-slate-400">Permanently delete all your portfolio data from this browser.</p>
            </div>
          </div>
          <Button variant="danger" onClick={() => {
            if (confirm("CRITICAL: This will delete ALL your data forever. Are you sure?")) {
              clearAllData();
            }
          }}>
            <Trash2 className="w-5 h-5" /> Clear All Data
          </Button>
        </div>
      </Card>
    </div>
  );
}
