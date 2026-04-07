import { BankAccount, PortfolioData } from "../types";

const STORAGE_KEY = "myportfolio_data";

export const CASH_ACCOUNT: BankAccount = {
  id: "acc_cash",
  bankName: "Cash",
  accountType: "Cash",
  accountNumber: "",
  balance: 0,
  notes: "Physical cash on hand",
  isCash: true,
};

const INITIAL_DATA: PortfolioData = {
  bankAccounts: [CASH_ACCOUNT],
  transfers: [],
  investments: {
    mutualFunds: [],
    stockPortfolios: [],
    fd: [],
    rd: [],
  },
  income: [],
  expenses: [],
  loans: [],
  recurringRules: [],
  settings: {
    monthlyBudget: 50000,
    yearView: "calendar",
  },
};

function ensureCashAccount(accounts: BankAccount[] = []) {
  const withoutCash = accounts.filter((account) => account.id !== CASH_ACCOUNT.id);
  const existingCash = accounts.find((account) => account.id === CASH_ACCOUNT.id);
  return [{ ...CASH_ACCOUNT, ...(existingCash || {}) }, ...withoutCash];
}

export const loadData = (): PortfolioData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);

      if (data.investments?.stocks && !data.investments.stockPortfolios) {
        data.investments.stockPortfolios = [
          {
            id: "default-portfolio",
            name: "Default Portfolio",
            ownerName: "Me",
            broker: "Other",
            holdings: data.investments.stocks,
          },
        ];
        delete data.investments.stocks;
      }

      return {
        ...INITIAL_DATA,
        ...data,
        bankAccounts: ensureCashAccount(data.bankAccounts || []),
        transfers: data.transfers || [],
        investments: {
          ...INITIAL_DATA.investments,
          ...data.investments,
          stockPortfolios: data.investments?.stockPortfolios || [],
        },
        income: (data.income || []).map((entry: any) => ({
          ...entry,
          toAccountId: entry.toAccountId ?? null,
          toAccountName: entry.toAccountName ?? null,
        })),
        expenses: (data.expenses || []).map((entry: any) => ({
          ...entry,
          fromAccountId: entry.fromAccountId ?? null,
          fromAccountName: entry.fromAccountName ?? null,
        })),
        recurringRules: (data.recurringRules || []).map((rule: any) => ({
          ...rule,
          fromAccountId: rule.fromAccountId ?? null,
          fromAccountName: rule.fromAccountName ?? null,
        })),
        settings: {
          ...INITIAL_DATA.settings,
          ...data.settings,
        },
      };
    }
  } catch (error) {
    console.error("Failed to load data from localStorage", error);
  }

  return INITIAL_DATA;
};

export const saveData = (data: PortfolioData) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...data,
        bankAccounts: ensureCashAccount(data.bankAccounts),
      }),
    );
  } catch (error) {
    console.error("Failed to save data to localStorage", error);
  }
};

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};

export const getStorageSize = () => {
  const saved = localStorage.getItem(STORAGE_KEY) || "";
  const sizeInBytes = new Blob([saved]).size;
  return `${(sizeInBytes / 1024).toFixed(2)} KB`;
};
