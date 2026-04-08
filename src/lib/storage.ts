import { BankAccount, CategoryDefinition, PortfolioData } from "../types";

export const DEFAULT_INCOME_CATEGORIES: CategoryDefinition[] = [
  { id: "income_salary", name: "Salary", parentId: null, type: "income" },
  { id: "income_freelance", name: "Freelance", parentId: null, type: "income" },
  { id: "income_dividends", name: "Dividends", parentId: null, type: "income" },
  { id: "income_interest", name: "Interest", parentId: null, type: "income" },
  { id: "income_rental", name: "Rental", parentId: null, type: "income" },
  { id: "income_other", name: "Other", parentId: null, type: "income" },
];

export const DEFAULT_EXPENSE_CATEGORIES: CategoryDefinition[] = [
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

export const INITIAL_DATA: PortfolioData = {
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

function normalizeCategoryDefinitions(categories: unknown, fallback: CategoryDefinition[]): CategoryDefinition[] {
  if (!Array.isArray(categories) || categories.length === 0) return fallback;
  const seen = new Set<string>();
  const normalized = categories
    .filter(Boolean)
    .map((category: any): CategoryDefinition => ({
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

export function ensureCashAccount(accounts: BankAccount[] = []) {
  const withoutCash = accounts.filter((account) => account.id !== CASH_ACCOUNT.id);
  const existingCash = accounts.find((account) => account.id === CASH_ACCOUNT.id);
  return [{ ...CASH_ACCOUNT, ...(existingCash || {}) }, ...withoutCash];
}

export function normalizePortfolioData(data?: Partial<PortfolioData> | null): PortfolioData {
  const next = data || {};
  const nextInvestments: Partial<PortfolioData["investments"]> & { stocks?: unknown } = next.investments || {};
  const nextSettings: Partial<PortfolioData["settings"]> = next.settings || {};

  if ((nextInvestments as any)?.stocks && !nextInvestments.stockPortfolios) {
    (nextInvestments as any).stockPortfolios = [
      {
        id: "default-portfolio",
        name: "Default Portfolio",
        ownerName: "Me",
        broker: "Other",
        holdings: (nextInvestments as any).stocks,
      },
    ];
    delete (nextInvestments as any).stocks;
  }

  return {
    ...INITIAL_DATA,
    ...next,
    bankAccounts: ensureCashAccount(next.bankAccounts || []),
    transfers: next.transfers || [],
    investments: {
      ...INITIAL_DATA.investments,
      ...nextInvestments,
      mutualFunds: nextInvestments.mutualFunds || [],
      stockPortfolios: nextInvestments.stockPortfolios || [],
      fd: nextInvestments.fd || [],
      rd: nextInvestments.rd || [],
    },
    income: (next.income || []).map((entry) => ({
      ...entry,
      toAccountId: entry.toAccountId ?? null,
      toAccountName: entry.toAccountName ?? null,
    })),
    expenses: (next.expenses || []).map((entry) => ({
      ...entry,
      fromAccountId: entry.fromAccountId ?? null,
      fromAccountName: entry.fromAccountName ?? null,
    })),
    loans: next.loans || [],
    recurringRules: (next.recurringRules || []).map((rule) => ({
      ...rule,
      fromAccountId: rule.fromAccountId ?? null,
      fromAccountName: rule.fromAccountName ?? null,
    })),
    settings: {
      ...INITIAL_DATA.settings,
      ...nextSettings,
      incomeCategories: normalizeCategoryDefinitions(nextSettings.incomeCategories, DEFAULT_INCOME_CATEGORIES),
      expenseCategories: normalizeCategoryDefinitions(nextSettings.expenseCategories, DEFAULT_EXPENSE_CATEGORIES),
    },
  };
}
