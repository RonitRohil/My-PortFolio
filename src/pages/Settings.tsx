import React, { useMemo, useState } from "react";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { PortfolioData, ExpenseCategory, IncomeSource, PaymentMethod } from "../types";
import { Badge, Button, Card, Input, Modal, Select, Table } from "../components/UI";
import { AlertTriangle, Database, Download, FileJson, FileSpreadsheet, Settings2, Trash2, Upload } from "lucide-react";
import { clearAllData, getStorageSize } from "../lib/storage";
import { formatCurrency, formatDate, getAllAccounts, getExpenseCategories } from "../lib/utils";
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
};

type PendingMyMoneyImport = {
  accounts: string[];
  categoryRows: Record<string, any>;
  transactionRows: Record<string, any>[];
  accountLookup: Record<string, string>;
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
}: {
  data: PortfolioData;
  updateData: (d: Partial<PortfolioData>) => void;
  setActiveTab: (tab: string) => void;
}) {
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingMyMoneyImport | null>(null);
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [mappingTicker, setMappingTicker] = useState("");
  const [mappingName, setMappingName] = useState("");
  const customMappings = useMemo(() => getCustomMappings(), [data]);

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
          updateData(importedData);
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

      if (doType === 0 || categoryType === 2) {
        incomeCount += 1;
        importedIncome.push({
          id: `mymoney_${row.uid}`,
          date,
          source: mapIncomeCategory(categoryName || description),
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
          category: mapExpenseCategory(categoryName || description),
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
    });
    setPendingImport(null);
    setImportSummary({ incomeCount, expenseCount, skippedCount, investmentSkippedCount, invalidSkippedCount, unmatchedSkippedCount });
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
              label="Monthly Budget Limit (₹)"
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
          </div>
        </Card>

        <Card title="Storage Info" subtitle="Local browser storage usage for this app.">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-emerald-500/10 p-4">
              <Database className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Space Used</p>
              <h3 className="text-2xl font-bold text-slate-100">{getStorageSize()}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        <Card className="flex flex-col items-center space-y-4 p-8 text-center">
          <div className="rounded-full bg-blue-500/10 p-4">
            <FileJson className="h-8 w-8 text-blue-500" />
          </div>
          <h4 className="font-bold">Full Backup</h4>
          <p className="text-xs text-slate-500">Export the full local dataset as JSON.</p>
          <Button onClick={exportToJson} variant="secondary" className="w-full">
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        </Card>

        <Card className="flex flex-col items-center space-y-4 p-8 text-center">
          <div className="rounded-full bg-emerald-500/10 p-4">
            <Upload className="h-8 w-8 text-emerald-500" />
          </div>
          <h4 className="font-bold">Restore Backup</h4>
          <p className="text-xs text-slate-500">Import a previous JSON export and replace current data.</p>
          <label className="w-full">
            <div className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-700">
              <Upload className="h-4 w-4" /> Import JSON
            </div>
            <input type="file" accept=".json" onChange={importFromJson} className="hidden" />
          </label>
        </Card>

        <Card className="flex flex-col items-center space-y-4 p-8 text-center">
          <div className="rounded-full bg-amber-500/10 p-4">
            <FileSpreadsheet className="h-8 w-8 text-amber-500" />
          </div>
          <h4 className="font-bold">CSV Exports</h4>
          <p className="text-xs text-slate-500">Export investments or expenses as CSV.</p>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={() => exportToCsv("investments")} variant="secondary" size="sm">
              Investments CSV
            </Button>
            <Button onClick={() => exportToCsv("expenses")} variant="secondary" size="sm">
              Expenses CSV
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col items-center space-y-4 p-8 text-center">
          <div className="rounded-full bg-fuchsia-500/10 p-4">
            <Settings2 className="h-8 w-8 text-fuchsia-400" />
          </div>
          <h4 className="font-bold">PDF / Print</h4>
          <p className="text-xs text-slate-500">Open a print-friendly summary for saving as PDF.</p>
          <Button onClick={handlePrintExport} variant="secondary" className="w-full">
            <Download className="h-4 w-4" /> Export Summary as PDF
          </Button>
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
                clearAllData();
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
