import React, { useMemo, useState } from "react";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { CategoryDefinition, PortfolioData, ExpenseCategory, IncomeSource, PaymentMethod } from "../types";
import { Badge, Button, Card, Input, Modal, Select, Table } from "../components/UI";
import { AlertTriangle, Database, Download, Edit2, FileJson, FileSpreadsheet, Plus, Settings2, Trash2, Upload } from "lucide-react";
import {
  formatCurrency,
  getAllAccounts,
  getCategoryBreakdown,
  getCategoryDisplayPath,
  mergeImportedCategories,
} from "../lib/utils";
import {
  addCustomMapping,
  getCustomMappings,
  getStockMappings,
  normalizeStockName,
  removeCustomMapping,
} from "../utils/stockNormalizer";

type ImportSummary = {
  incomeCount: number;
  expenseCount: number;
  skippedCount: number;
  investmentSkippedCount: number;
  invalidSkippedCount: number;
  unmatchedSkippedCount: number;
  importedIncomeCategories: number;
  importedExpenseCategories: number;
};

type PendingMyMoneyImport = {
  accounts: string[];
  categoryRows: Record<string, any>;
  transactionRows: Record<string, any>[];
  accountLookup: Record<string, string>;
};

type CategoryEditorState = {
  mode: "create" | "edit";
  type: "income" | "expense";
  category: CategoryDefinition | null;
};

const INVESTMENT_ACCOUNT_NAMES = new Set([
  "Grow Balance",
  "Zerodha Balance",
  "Mutual Funds",
  "Shares",
  "RD",
]);

const accountSourceMap: Record<string, PaymentMethod> = {
  Cash: "Cash",
  Card: "Card",
};

const accountNameMap: Record<string, string> = {
  "KOTAK BANK Account": "Kotak Bank",
  "AU SMALL FINANCE": "AU Small Finance Bank",
};

const incomeCategoryMap: Record<string, IncomeSource> = {
  salary: "Salary",
  job: "Salary",
  income: "Salary",
  interest: "Interest",
  allowance: "Other",
  bonus: "Other",
  "petty cash": "Other",
  shares: "Other",
  "existing balance": "Other",
};

const expenseCategoryKeywords: { match: RegExp; category: ExpenseCategory }[] = [
  { match: /(food|grocery|restaurant)/i, category: "Food" },
  { match: /(rent|house)/i, category: "Rent" },
  { match: /(medical|health|hospital|medicine)/i, category: "Medical" },
  { match: /(travel|transport|petrol|auto|cab)/i, category: "Travel" },
  { match: /(entertainment|movie|ott)/i, category: "Entertainment" },
  { match: /(utility|electric|internet|mobile|recharge)/i, category: "Utilities" },
];

export default function Settings({
  data,
  updateData,
  setActiveTab,
  storageSize,
  clearAllData,
}: {
  data: PortfolioData;
  updateData: (d: Partial<PortfolioData>) => void;
  setActiveTab: (tab: string) => void;
  storageSize: string;
  clearAllData: () => Promise<void>;
}) {
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingMyMoneyImport | null>(null);
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [mappingTicker, setMappingTicker] = useState("");
  const [mappingName, setMappingName] = useState("");
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditorState | null>(null);
  const incomeCategories = data.settings?.incomeCategories || [];
  const expenseCategories = data.settings?.expenseCategories || [];
  const customMappings = useMemo(() => getCustomMappings(), [data]);
  const expenseReport = useMemo(() => getCategoryBreakdown(data.expenses, "category"), [data.expenses]);
  const incomeReport = useMemo(() => getCategoryBreakdown(data.income, "source"), [data.income]);

  const exportToJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `myportfolio_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const importedData = JSON.parse(loadEvent.target?.result as string);
        if (confirm("This will overwrite all current data. Are you sure?")) {
          updateData(normalizeImportedBackup(importedData, data));
          alert("Data imported successfully.");
        }
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const exportToCsv = (type: "investments" | "expenses") => {
    let csvContent = "";
    if (type === "investments") {
      csvContent = "Type,Name,Reference,Invested,Current\n";
      data.investments.mutualFunds.forEach((fund) => {
        csvContent += `MF,"${fund.fundName}","${fund.amc}",${fund.currentValue},${fund.currentValue}\n`;
      });
      data.investments.stockPortfolios.forEach((portfolio) => {
        portfolio.holdings.forEach((holding) => {
          csvContent += `Stock,"${normalizeStockName(holding.companyName)}","${holding.ticker}",${holding.quantity * holding.avgBuyPrice},${holding.quantity * holding.currentPrice}\n`;
        });
      });
      data.investments.fd.forEach((fd) => {
        csvContent += `FD,"${fd.bankName}","FD",${fd.principal},${fd.principal}\n`;
      });
    } else {
      csvContent = "Date,Category,Method,Amount,Description\n";
      data.expenses.forEach((entry) => {
        csvContent += `${entry.date},${entry.category},${entry.paymentMethod},${entry.amount},"${entry.description || ""}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `myportfolio_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleMyMoneyImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const SQL = await initSqlJs({
        locateFile: () => sqlWasmUrl,
      });
      const db = new SQL.Database(new Uint8Array(buffer));

      const accountRows = queryRows(db, "SELECT uid, NIC_NAME FROM ASSETS;");
      const categoryRows = queryRows(db, "SELECT uid, NAME, TYPE, pUid FROM ZCATEGORY WHERE C_IS_DEL = 0;");
      const transactionRows = queryRows(
        db,
        `SELECT uid, assetUid, ctgUid, ZCONTENT, ZDATE, DO_TYPE, ZMONEY, ASSET_NIC, CATEGORY_NAME
         FROM INOUTCOME
         WHERE IS_DEL = 0 AND DO_TYPE IN ('0', '1')
         ORDER BY ZDATE ASC;`,
      );

      const accountLookup = Object.fromEntries(accountRows.map((row) => [row.uid, row.NIC_NAME]));
      const categories = Object.fromEntries(categoryRows.map((row) => [row.uid, row]));
      const myMoneyAccounts: string[] = Array.from(
        new Set(accountRows.map((row) => normalizeAccountName(String(row.NIC_NAME || ""))).filter(Boolean)),
      ) as string[];
      const initialMappings = Object.fromEntries(
        myMoneyAccounts.map((accountName) => [accountName, getDefaultImportMapping(accountName, data)]),
      );
      setAccountMappings(initialMappings);
      setPendingImport({
        accounts: myMoneyAccounts,
        categoryRows: categories,
        transactionRows,
        accountLookup,
      });
    } catch (error) {
      console.error(error);
      alert("Failed to import the myMoney SQLite backup.");
    } finally {
      event.target.value = "";
    }
  };

  const handlePrintExport = () => {
    setActiveTab("dashboard");
    window.setTimeout(() => window.print(), 200);
  };

  const builtInCount = Object.keys(getStockMappings()).length - Object.keys(customMappings).length;

  const runMappedImport = () => {
    if (!pendingImport) return;
    let incomeCount = 0;
    let expenseCount = 0;
    let investmentSkippedCount = 0;
    let invalidSkippedCount = 0;
    let unmatchedSkippedCount = 0;
    const importedCategories = extractImportedCategories(pendingImport.categoryRows);
    const importedIncome: PortfolioData["income"] = [];
    const importedExpenses: PortfolioData["expenses"] = [];

    pendingImport.transactionRows.forEach((row) => {
      const sourceAccountName = normalizeAccountName(pendingImport.accountLookup[row.assetUid] || row.ASSET_NIC || "");
      const mappedAccountId = accountMappings[sourceAccountName] || "";
      if (!mappedAccountId || mappedAccountId === "skip") {
        investmentSkippedCount += 1;
        return;
      }

      const mappedAccount = getAllAccounts(data).find((account) => account.id === mappedAccountId);
      const category = pendingImport.categoryRows[row.ctgUid];
      const categoryType = Number(category?.TYPE ?? NaN);
      const categoryName = String(category?.NAME || row.CATEGORY_NAME || "").trim();
      const description = String(row.ZCONTENT || "").trim();
      const amount = Number(row.ZMONEY);
      const timestamp = Number(row.ZDATE);
      const doType = Number(row.DO_TYPE);

      if (!Number.isFinite(amount) || !Number.isFinite(timestamp)) {
        invalidSkippedCount += 1;
        return;
      }

      const date = new Date(timestamp).toISOString().slice(0, 10);

      const categoryLabel = getImportedCategoryLabel(category, pendingImport.categoryRows) || categoryName || description;

      if (doType === 0 || categoryType === 2) {
        incomeCount += 1;
        importedIncome.push({
          id: `mymoney_${row.uid}`,
          date,
          source: categoryLabel || mapIncomeCategory(categoryName || description),
          amount,
          description: description || sourceAccountName || "Imported from myMoney",
          toAccountId: mappedAccountId,
          toAccountName: mappedAccount?.bankName || sourceAccountName,
        });
        return;
      }

      if (doType === 1 || categoryType === 1) {
        expenseCount += 1;
        importedExpenses.push({
          id: `mymoney_${row.uid}`,
          date,
          category: categoryLabel || mapExpenseCategory(categoryName || description),
          amount,
          fromAccountId: mappedAccountId,
          fromAccountName: mappedAccount?.bankName || sourceAccountName,
          paymentMethod: mapPaymentMethod(sourceAccountName),
          description: description || categoryName || "Imported from myMoney",
        });
        return;
      }

      unmatchedSkippedCount += 1;
    });

    const skippedCount = investmentSkippedCount + invalidSkippedCount + unmatchedSkippedCount;
    updateData({
      income: mergeImportedEntries(data.income, importedIncome),
      expenses: mergeImportedEntries(data.expenses, importedExpenses),
      settings: {
        ...data.settings,
        incomeCategories: mergeImportedCategories(incomeCategories, importedCategories.income),
        expenseCategories: mergeImportedCategories(expenseCategories, importedCategories.expense),
      },
    });
    setPendingImport(null);
    setImportSummary({
      incomeCount,
      expenseCount,
      skippedCount,
      investmentSkippedCount,
      invalidSkippedCount,
      unmatchedSkippedCount,
      importedIncomeCategories: importedCategories.income.length,
      importedExpenseCategories: importedCategories.expense.length,
    });
  };

  const handleSaveCategory = (nextCategory: CategoryDefinition, previousCategory?: CategoryDefinition | null) => {
    updateData(applyCategoryUpsert(data, nextCategory, previousCategory || null));
    setCategoryEditor(null);
  };

  const handleDeleteCategory = (category: CategoryDefinition) => {
    const label = getCategoryDisplayPath(
      category,
      category.type === "income" ? incomeCategories : expenseCategories,
    );
    if (!confirm(`Delete "${label}"? Linked transactions will be moved to Other.`)) return;
    updateData(applyCategoryDelete(data, category));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-100">Data Management</h2>
        <p className="text-slate-400">Import, export, tune app behaviour, and keep local data healthy.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card title="Budget & Reporting" subtitle="Controls for monthly budget and yearly view mode.">
          <div className="space-y-4">
            <Input
              label="Monthly Budget Limit (INR)"
              type="number"
              defaultValue={data.settings.monthlyBudget}
              onChange={(event) =>
                updateData({
                  settings: {
                    ...data.settings,
                    monthlyBudget: Number(event.target.value),
                  },
                })
              }
            />
            <Select
              label="Year View"
              value={data.settings.yearView}
              onChange={(event) =>
                updateData({
                  settings: {
                    ...data.settings,
                    yearView: event.target.value as PortfolioData["settings"]["yearView"],
                  },
                })
              }
            >
              <option value="calendar">Calendar Year (Jan-Dec)</option>
              <option value="financial">Financial Year (Apr-Mar)</option>
            </Select>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-semibold text-slate-200">Income Categories</div>
                <div className="mt-2 text-xs text-slate-400">
                  {incomeCategories.filter((item) => !item.parentId).length} top-level, {incomeCategories.filter((item) => item.parentId).length} subcategories
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-semibold text-slate-200">Expense Categories</div>
                <div className="mt-2 text-xs text-slate-400">
                  {expenseCategories.filter((item) => !item.parentId).length} top-level, {expenseCategories.filter((item) => item.parentId).length} subcategories
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Storage Info" subtitle="Local browser storage usage for this app.">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-emerald-500/10 p-4">
              <Database className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Space Used</p>
              <h3 className="text-2xl font-bold text-slate-100">{storageSize}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <Card className="flex h-full flex-col items-center p-8 text-center">
          <div className="rounded-full bg-blue-500/10 p-4">
            <FileJson className="h-8 w-8 text-blue-500" />
          </div>
          <h4 className="mt-4 font-bold">Full Backup</h4>
          <p className="mt-2 text-xs text-slate-500">Export the full local dataset as JSON.</p>
          <div className="mt-auto w-full pt-6">
            <Button onClick={exportToJson} variant="secondary" className="w-full">
              <Download className="h-4 w-4" /> Export JSON
            </Button>
          </div>
        </Card>

        <Card className="flex h-full flex-col items-center p-8 text-center">
          <div className="rounded-full bg-emerald-500/10 p-4">
            <Upload className="h-8 w-8 text-emerald-500" />
          </div>
          <h4 className="mt-4 font-bold">Restore Backup</h4>
          <p className="mt-2 text-xs text-slate-500">Import a previous JSON export and replace current data.</p>
          <div className="mt-auto w-full pt-6">
            <label className="w-full">
              <div className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-700">
                <Upload className="h-4 w-4" /> Import JSON
              </div>
              <input type="file" accept=".json" onChange={importFromJson} className="hidden" />
            </label>
          </div>
        </Card>

        <Card className="flex h-full flex-col items-center p-8 text-center">
          <div className="rounded-full bg-amber-500/10 p-4">
            <FileSpreadsheet className="h-8 w-8 text-amber-500" />
          </div>
          <h4 className="mt-4 font-bold">CSV Exports</h4>
          <p className="mt-2 text-xs text-slate-500">Export investments or expenses as CSV.</p>
          <div className="mt-auto flex w-full flex-col gap-2 pt-6">
            <Button onClick={() => exportToCsv("investments")} variant="secondary" size="sm" className="w-full">
              Investments CSV
            </Button>
            <Button onClick={() => exportToCsv("expenses")} variant="secondary" size="sm" className="w-full">
              Expenses CSV
            </Button>
          </div>
        </Card>

        <Card className="flex h-full flex-col items-center p-8 text-center">
          <div className="rounded-full bg-fuchsia-500/10 p-4">
            <Settings2 className="h-8 w-8 text-fuchsia-400" />
          </div>
          <h4 className="mt-4 font-bold">PDF / Print</h4>
          <p className="mt-2 text-xs text-slate-500">Open a print-friendly summary for saving as PDF.</p>
          <div className="mt-auto w-full pt-6">
            <Button onClick={handlePrintExport} variant="secondary" className="w-full">
              <Download className="h-4 w-4" /> Export Summary as PDF
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card title="Import" subtitle="Bring transaction history into the app without duplicates." className="min-w-0">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="font-semibold text-slate-100">Import from myMoney App (.sqlite)</h4>
                  <p className="mt-1 text-sm text-slate-400">
                    Reads your Android myMoney SQLite export in-browser and idempotently merges imported entries.
                  </p>
                </div>
                <label className="w-full lg:w-auto">
                  <div className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white lg:w-auto">
                    <Upload className="h-4 w-4" /> Select SQLite File
                  </div>
                  <input type="file" accept=".sqlite,.db" className="hidden" onChange={handleMyMoneyImport} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <h4 className="font-semibold text-slate-100">GitHub Pages Deployment</h4>
              <p className="mt-1 text-sm text-slate-400">
                The repository is configured for GitHub Pages deployment with a Vite base path, workflow, and 404 fallback.
              </p>
              <div className="mt-3 text-xs text-slate-500">
                Update the repo name in `vite.config.ts` and `public/404.html` if the GitHub repository name changes.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Stock Name Mappings" subtitle={`Built-in mappings: ${builtInCount}. Custom mappings sync to localStorage.`} className="min-w-0">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!mappingTicker.trim() || !mappingName.trim()) return;
              addCustomMapping(mappingTicker, mappingName);
              setMappingTicker("");
              setMappingName("");
              updateData({ settings: { ...data.settings } });
            }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
          >
            <Input label="NSE Code" value={mappingTicker} onChange={(event) => setMappingTicker(event.target.value)} placeholder="BAJFINANCE" />
            <Input label="Company Name" value={mappingName} onChange={(event) => setMappingName(event.target.value)} placeholder="Bajaj Finance Limited" />
            <Button type="submit" className="mt-auto w-full xl:w-auto">
              Add Mapping
            </Button>
          </form>
          <div className="mt-6 max-h-[420px] overflow-auto">
            <Table headers={[{ label: "Ticker" }, { label: "Company Name" }, { label: "Type" }, { label: "Actions" }]}>
              {Object.entries(getStockMappings()).map(([ticker, companyName]) => {
                const isCustom = ticker in customMappings;
                return (
                  <tr key={ticker} className="hover:bg-slate-800/30">
                    <td className="px-4 py-4 font-mono text-slate-200">{ticker}</td>
                    <td className="px-4 py-4 text-slate-300">{companyName}</td>
                    <td className="px-4 py-4">
                      <Badge variant={isCustom ? "info" : "secondary"}>{isCustom ? "Custom" : "Built-in"}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      {isCustom ? (
                        <button
                          onClick={() => {
                            removeCustomMapping(ticker);
                            updateData({ settings: { ...data.settings } });
                          }}
                          className="text-sm text-rose-500 transition hover:text-rose-400"
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Protected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Card title="Category-wise Report" subtitle="Current totals grouped by imported or custom category names.">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-200">Expenses</div>
              <div className="space-y-2">
                {expenseReport.slice(0, 10).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
                    <span className="text-slate-300">{name}</span>
                    <span className="font-semibold text-rose-400">{formatCurrency(amount)}</span>
                  </div>
                ))}
                {expenseReport.length === 0 && <div className="text-sm text-slate-500">No expense categories used yet.</div>}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-200">Income</div>
              <div className="space-y-2">
                {incomeReport.slice(0, 10).map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
                    <span className="text-slate-300">{name}</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(amount)}</span>
                  </div>
                ))}
                {incomeReport.length === 0 && <div className="text-sm text-slate-500">No income categories used yet.</div>}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Category Manager" subtitle="Edit imported categories and subcategories directly inside the app.">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryManagerColumn
              title="Expense Tree"
              categories={expenseCategories}
              type="expense"
              onCreate={() => setCategoryEditor({ mode: "create", type: "expense", category: null })}
              onEdit={(category) => setCategoryEditor({ mode: "edit", type: "expense", category })}
              onDelete={handleDeleteCategory}
            />
            <CategoryManagerColumn
              title="Income Tree"
              categories={incomeCategories}
              type="income"
              onCreate={() => setCategoryEditor({ mode: "create", type: "income", category: null })}
              onEdit={(category) => setCategoryEditor({ mode: "edit", type: "income", category })}
              onDelete={handleDeleteCategory}
            />
          </div>
        </Card>
      </div>

      <Card className="border-rose-500/20 bg-rose-500/5">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-rose-500/20 p-3">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
            <div>
              <h4 className="font-bold text-rose-500">Danger Zone</h4>
              <p className="text-sm text-slate-400">Delete all portfolio data stored in this browser.</p>
            </div>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("CRITICAL: This will delete ALL your data forever. Are you sure?")) {
                void clearAllData();
              }
            }}
          >
            <Trash2 className="h-5 w-5" /> Clear All Data
          </Button>
        </div>
      </Card>

      <Modal isOpen={!!importSummary} onClose={() => setImportSummary(null)} title="myMoney Import Summary">
        {importSummary && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              Imported {importSummary.incomeCount} income entries, {importSummary.expenseCount} expense entries.{" "}
              {importSummary.skippedCount} entries were skipped because they were transfers, investment-linked, or unmatched.
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-400 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                Investment accounts skipped: {importSummary.investmentSkippedCount}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                Invalid rows skipped: {importSummary.invalidSkippedCount}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                Unmatched rows skipped: {importSummary.unmatchedSkippedCount}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                Income categories merged: {importSummary.importedIncomeCategories}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                Expense categories merged: {importSummary.importedExpenseCategories}
              </div>
            </div>
            <Button onClick={() => setImportSummary(null)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} title="Map myMoney Accounts">
        {pendingImport && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">Map myMoney accounts to your Portfolio accounts before importing.</div>
            <div className="space-y-3">
              {pendingImport.accounts.map((accountName) => (
                <div key={accountName} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[1fr_1fr] md:items-center">
                  <div className="font-medium text-slate-200">{accountName}</div>
                  <Select value={accountMappings[accountName] || ""} onChange={(event) => setAccountMappings((current) => ({ ...current, [accountName]: event.target.value }))}>
                    <option value="">Select account</option>
                    {getAllAccounts(data).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName}
                      </option>
                    ))}
                    <option value="skip">Skip (Investment)</option>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setPendingImport(null)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" onClick={runMappedImport}>
                Import Now
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <CategoryEditorModal
        editor={categoryEditor}
        data={data}
        onClose={() => setCategoryEditor(null)}
        onSave={handleSaveCategory}
      />
    </div>
  );
}

function queryRows(db: any, sql: string) {
  const result = db.exec(sql);
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row: any[]) =>
    columns.reduce((acc: Record<string, any>, column: string, index: number) => {
      acc[column] = row[index];
      return acc;
    }, {}),
  );
}

function CategoryManagerColumn({
  title,
  categories,
  type,
  onCreate,
  onEdit,
  onDelete,
}: {
  title: string;
  categories: CategoryDefinition[];
  type: "income" | "expense";
  onCreate: () => void;
  onEdit: (category: CategoryDefinition) => void;
  onDelete: (category: CategoryDefinition) => void;
}) {
  const orderedCategories = [...categories].sort((a, b) => {
    if ((a.parentId ? 1 : 0) !== (b.parentId ? 1 : 0)) return (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0);
    return getCategoryDisplayPath(a, categories).localeCompare(getCategoryDisplayPath(b, categories));
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="max-h-96 space-y-2 overflow-auto pr-1">
        {orderedCategories.map((category) => (
          <div key={category.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-slate-200">{getCategoryDisplayPath(category, categories)}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={type === "expense" ? "warning" : "success"}>{type}</Badge>
                <Badge variant={category.parentId ? "info" : "secondary"}>{category.parentId ? "Subcategory" : "Top Level"}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onEdit(category)} className="p-2 text-slate-400 hover:text-emerald-500">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(category)} className="p-2 text-slate-400 hover:text-rose-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {orderedCategories.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-500">No categories yet.</div>}
      </div>
    </div>
  );
}

function CategoryEditorModal({
  editor,
  data,
  onClose,
  onSave,
}: {
  editor: CategoryEditorState | null;
  data: PortfolioData;
  onClose: () => void;
  onSave: (nextCategory: CategoryDefinition, previousCategory?: CategoryDefinition | null) => void;
}) {
  if (!editor) return null;
  const categories = editor.type === "income" ? (data.settings?.incomeCategories || []) : (data.settings?.expenseCategories || []);
  const topLevelCategories = categories.filter((category) => !category.parentId && category.id !== editor.category?.id);

  return (
    <Modal isOpen={!!editor} onClose={onClose} title={editor.mode === "edit" ? "Edit Category" : "Add Category"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const parentId = String(formData.get("parentId") || "") || null;
          const parentCategory = parentId ? categories.find((category) => category.id === parentId) : null;
          onSave(
            {
              id: editor.category?.id || `cat_${editor.type}_${Date.now()}`,
              name: String(formData.get("name") || "").trim(),
              parentId,
              parentName: parentCategory?.name || null,
              type: editor.type,
            },
            editor.category,
          );
        }}
        className="space-y-4"
      >
        <Input label="Category Name" name="name" required defaultValue={editor.category?.name || ""} />
        <Select label="Parent Category" name="parentId" defaultValue={editor.category?.parentId || ""}>
          <option value="">None (Top Level)</option>
          {topLevelCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
          Top-level categories appear directly in reports and forms. Subcategories are stored with their parent path, like `Food / Dining`.
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1">{editor.mode === "edit" ? "Update Category" : "Create Category"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function mergeImportedEntries<T extends { id: string }>(existing: T[], imported: T[]) {
  const untouched = existing.filter((entry) => !entry.id.startsWith("mymoney_"));
  const existingImported = new Map(existing.filter((entry) => entry.id.startsWith("mymoney_")).map((entry) => [entry.id, entry]));
  imported.forEach((entry) => existingImported.set(entry.id, entry));
  return [...untouched, ...Array.from(existingImported.values())];
}

function normalizeAccountName(name = "") {
  return accountNameMap[name] || name;
}

function shouldSkipInvestmentAccount(name = "") {
  return INVESTMENT_ACCOUNT_NAMES.has(name);
}

function mapPaymentMethod(accountName = ""): PaymentMethod {
  return accountSourceMap[accountName] || "UPI";
}

function mapIncomeCategory(name = ""): IncomeSource {
  const lower = name.toLowerCase();
  const matched = Object.entries(incomeCategoryMap).find(([keyword]) => lower.includes(keyword));
  return matched?.[1] || "Other";
}

function mapExpenseCategory(name = ""): ExpenseCategory {
  const match = expenseCategoryKeywords.find((item) => item.match.test(name));
  return match?.category || "Other";
}

function getDefaultImportMapping(accountName: string, data: PortfolioData) {
  if (shouldSkipInvestmentAccount(accountName)) return "skip";
  const matched = getAllAccounts(data).find((account) => account.bankName.toLowerCase() === accountName.toLowerCase());
  return matched?.id || "";
}

function getImportedCategoryLabel(category: Record<string, any> | undefined, categoryRows: Record<string, any>) {
  if (!category) return "";
  const name = String(category.NAME || "").trim();
  if (!name) return "";
  if (!category.pUid) return name;
  const parent = categoryRows[String(category.pUid)];
  const parentName = String(parent?.NAME || "").trim();
  return parentName ? `${parentName} / ${name}` : name;
}

function extractImportedCategories(categoryRows: Record<string, any>): { income: CategoryDefinition[]; expense: CategoryDefinition[] } {
  const rows = Object.values(categoryRows || {}) as Array<Record<string, any>>;
  const byId = new Map(rows.map((row) => [String(row.uid), row]));
  const income: CategoryDefinition[] = [];
  const expense: CategoryDefinition[] = [];

  rows.forEach((row) => {
    const type = Number(row.TYPE) === 2 ? "income" : Number(row.TYPE) === 1 ? "expense" : null;
    if (!type) return;
    const id = `mymoney_${row.uid}`;
    const name = String(row.NAME || "").trim();
    if (!name) return;
    const parent = row.pUid ? byId.get(String(row.pUid)) : null;
    const category: CategoryDefinition = {
      id,
      name,
      parentId: parent ? `mymoney_${parent.uid}` : null,
      parentName: parent ? String(parent.NAME || "").trim() || null : null,
      type,
    };
    if (type === "income") income.push(category);
    else expense.push(category);
  });

  return { income, expense };
}

function normalizeImportedBackup(importedData: any, currentData: PortfolioData) {
  return {
    ...importedData,
    transfers: importedData.transfers || [],
    recurringRules: importedData.recurringRules || [],
    settings: {
      ...currentData.settings,
      ...(importedData.settings || {}),
      incomeCategories: importedData.settings?.incomeCategories || currentData.settings.incomeCategories || [],
      expenseCategories: importedData.settings?.expenseCategories || currentData.settings.expenseCategories || [],
    },
  };
}

function applyCategoryUpsert(data: PortfolioData, nextCategory: CategoryDefinition, previousCategory: CategoryDefinition | null) {
  const key = nextCategory.type === "income" ? "incomeCategories" : "expenseCategories";
  const existingCategories = data.settings[key];
  const nextCategories = previousCategory
    ? existingCategories.map((category) => (category.id === previousCategory.id ? nextCategory : category)).map((category) =>
        category.parentId === nextCategory.id ? { ...category, parentName: nextCategory.name } : category,
      )
    : [...existingCategories, nextCategory];

  if (!previousCategory) {
    return {
      settings: {
        ...data.settings,
        [key]: nextCategories,
      },
    };
  }

  const previousDisplayMap = buildCategoryDisplayMap(existingCategories);
  const nextDisplayMap = buildCategoryDisplayMap(nextCategories);
  const impactedIds = new Set<string>([previousCategory.id, ...getDescendantCategoryIds(existingCategories, previousCategory.id)]);
  const remapEntries = new Map<string, string>();

  impactedIds.forEach((id) => {
    const previousCategoryDef = existingCategories.find((category) => category.id === id);
    const nextCategoryDef = nextCategories.find((category) => category.id === id);
    if (!previousCategoryDef || !nextCategoryDef) return;
    const previousLabel = previousDisplayMap.get(id) || previousCategoryDef.name;
    const nextLabel = nextDisplayMap.get(id) || nextCategoryDef.name;
    remapEntries.set(previousLabel, nextLabel);
    remapEntries.set(previousCategoryDef.name, nextLabel);
  });

  return {
    income: nextCategory.type === "income" ? data.income.map((entry) => ({ ...entry, source: remapEntries.get(entry.source) || entry.source })) : data.income,
    expenses: nextCategory.type === "expense" ? data.expenses.map((entry) => ({ ...entry, category: remapEntries.get(entry.category) || entry.category })) : data.expenses,
    recurringRules: nextCategory.type === "expense" ? data.recurringRules.map((rule) => ({ ...rule, category: remapEntries.get(rule.category) || rule.category })) : data.recurringRules,
    settings: {
      ...data.settings,
      [key]: nextCategories,
    },
  };
}

function applyCategoryDelete(data: PortfolioData, categoryToDelete: CategoryDefinition) {
  const key = categoryToDelete.type === "income" ? "incomeCategories" : "expenseCategories";
  const existingCategories = data.settings[key];
  const removedIds = new Set<string>([categoryToDelete.id, ...getDescendantCategoryIds(existingCategories, categoryToDelete.id)]);
  const previousDisplayMap = buildCategoryDisplayMap(existingCategories);
  const nextCategories = existingCategories.filter((category) => !removedIds.has(category.id));
  const fallbackLabel = getFallbackCategoryLabel(nextCategories, categoryToDelete.type);
  const removedLabels = new Set<string>();

  removedIds.forEach((id) => {
    const category = existingCategories.find((item) => item.id === id);
    if (!category) return;
    removedLabels.add(previousDisplayMap.get(id) || category.name);
    removedLabels.add(category.name);
  });

  return {
    income: categoryToDelete.type === "income"
      ? data.income.map((entry) => ({ ...entry, source: removedLabels.has(entry.source) ? fallbackLabel : entry.source }))
      : data.income,
    expenses: categoryToDelete.type === "expense"
      ? data.expenses.map((entry) => ({ ...entry, category: removedLabels.has(entry.category) ? fallbackLabel : entry.category }))
      : data.expenses,
    recurringRules: categoryToDelete.type === "expense"
      ? data.recurringRules.map((rule) => ({ ...rule, category: removedLabels.has(rule.category) ? fallbackLabel : rule.category }))
      : data.recurringRules,
    settings: {
      ...data.settings,
      [key]: nextCategories,
    },
  };
}

function buildCategoryDisplayMap(categories: CategoryDefinition[]) {
  return new Map(categories.map((category) => [category.id, getCategoryDisplayPath(category, categories)]));
}

function getDescendantCategoryIds(categories: CategoryDefinition[], categoryId: string): string[] {
  const descendants: string[] = [];
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    categories
      .filter((category) => category.parentId === current)
      .forEach((child) => {
        descendants.push(child.id);
        queue.push(child.id);
      });
  }
  return descendants;
}

function getFallbackCategoryLabel(categories: CategoryDefinition[], type: "income" | "expense") {
  const other = categories.find((category) => !category.parentId && category.name.toLowerCase() === "other" && category.type === type);
  return other ? getCategoryDisplayPath(other, categories) : "Other";
}
