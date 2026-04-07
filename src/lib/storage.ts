import { BankAccount, CategoryDefinition, PortfolioData } from "../types";

const STORAGE_KEY = "myportfolio_data";

const DEFAULT_INCOME_CATEGORIES: CategoryDefinition[] = [
  { id: "income_salary", name: "Salary", parentId: null, type: "income" },
  { id: "income_freelance", name: "Freelance", parentId: null, type: "income" },
  { id: "income_dividends", name: "Dividends", parentId: null, type: "income" },
  { id: "income_interest", name: "Interest", parentId: null, type: "income" },
  { id: "income_rental", name: "Rental", parentId: null, type: "income" },
  { id: "income_other", name: "Other", parentId: null, type: "income" },
];

const DEFAULT_EXPENSE_CATEGORIES: CategoryDefinition[] = [
  { id: "expense_food", name: "Food", parentId: null, type: "expense" },
  { id: "expense_rent", name: "Rent", parentId: null, type: "expense" },
  { id: "expense_emi", name: "EMI", parentId: null, type: "expense" },
  { id: "expense_utilities", name: "Utilities", parentId: null, type: "expense" },
  { id: "expense_entertainment", name: "Entertainment", parentId: null, type: "expense" },
  { id: "expense_medical", name: "Medical", parentId: null, type: "expense" },
  { id: "expense_travel", name: "Travel", parentId: null, type: "expense" },
  { id: "expense_investment", name: "Investment", parentId: null, type: "expense" },
  { id: "expense_beauty", name: "Beauty", parentId: null, type: "expense" },
  { id: "expense_social_life", name: "Social Life", parentId: null, type: "expense" },
  { id: "expense_transport", name: "Transport", parentId: null, type: "expense" },
  { id: "expense_other", name: "Other", parentId: null, type: "expense" },
];

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
    incomeCategories: DEFAULT_INCOME_CATEGORIES,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  },
};

function normalizeCategoryDefinitions(categories: any[] | undefined, fallback: CategoryDefinition[]) {
  if (!Array.isArray(categories) || categories.length === 0) return fallback;
  const seen = new Set<string>();
  const normalized = categories
    .filter(Boolean)
    .map((category) => ({
      id: String(category.id || `${category.type || "category"}_${String(category.name || "").toLowerCase().replace(/\s+/g, "_")}`),
      name: String(category.name || "").trim(),
      parentId: category.parentId ? String(category.parentId) : null,
      parentName: category.parentName ? String(category.parentName) : null,
      type: category.type === "income" ? "income" : "expense",
    }))
    .filter((category) => category.name)
    .filter((category) => {
      const key = `${category.type}:${category.name.toLowerCase()}:${category.parentId || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return normalized.length > 0 ? normalized : fallback;
}

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
          incomeCategories: normalizeCategoryDefinitions(data.settings?.incomeCategories, DEFAULT_INCOME_CATEGORIES),
          expenseCategories: normalizeCategoryDefinitions(data.settings?.expenseCategories, DEFAULT_EXPENSE_CATEGORIES),
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
