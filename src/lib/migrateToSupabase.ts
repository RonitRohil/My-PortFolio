import { PortfolioData } from "../types";
import { LEGACY_STORAGE_KEY, MIGRATION_FLAG_KEY, loadLegacyLocalData, persistPortfolioChanges } from "./dataService";
import { normalizePortfolioData } from "./storage";

export async function migrateLocalStorageToSupabase(): Promise<{
  migrated: boolean;
  counts: Record<string, number>;
}> {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return { migrated: false, counts: {} };

  const parsed = normalizePortfolioData(JSON.parse(raw)) as PortfolioData;
  const empty = normalizePortfolioData({});
  const localData = loadLegacyLocalData() || parsed;

  await persistPortfolioChanges(empty, localData, [
    "bankAccounts",
    "income",
    "expenses",
    "transfers",
    "investments",
    "loans",
    "recurringRules",
    "settings",
  ]);

  const counts = {
    bankAccounts: localData.bankAccounts.length,
    income: localData.income.length,
    expenses: localData.expenses.length,
    transfers: localData.transfers.length,
    mutualFunds: localData.investments.mutualFunds.length,
    mfLumpsums: localData.investments.mutualFunds.reduce((sum, fund) => sum + fund.lumpsumEntries.length, 0),
    stockPortfolios: localData.investments.stockPortfolios.length,
    stockHoldings: localData.investments.stockPortfolios.reduce((sum, portfolio) => sum + portfolio.holdings.length, 0),
    fds: localData.investments.fd.length,
    rds: localData.investments.rd.length,
    loans: localData.loans.length,
    recurringRules: localData.recurringRules.length,
  };

  localStorage.setItem(MIGRATION_FLAG_KEY, "true");
  localStorage.removeItem(LEGACY_STORAGE_KEY);

  return { migrated: true, counts };
}
