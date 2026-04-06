export type AccountType = 'Savings' | 'Current' | 'Salary';

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: AccountType;
  accountNumber: string; // last 4 digits
  balance: number;
  notes?: string;
}

export type InvestmentStatus = 'Active' | 'Paused' | 'Stopped';
export type MFCategory = 'Equity' | 'Debt' | 'Hybrid' | 'ELSS' | 'Index';

export interface LumpsumEntry {
  id: string;
  date: string;
  amount: number;
}

export interface MutualFund {
  id: string;
  fundName: string;
  amc: string;
  category: MFCategory;
  sipDetails?: {
    monthlyAmount: number;
    startDate: string;
    status: InvestmentStatus;
  };
  lumpsumEntries: LumpsumEntry[];
  currentValue: number;
}

export type BrokerType = 'Groww' | 'Zerodha' | 'Upstox' | 'Other';

export interface Stock {
  id: string;
  companyName: string;
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
}

export interface StockPortfolio {
  id: string;
  name: string;
  ownerName: string;
  broker: BrokerType;
  holdings: Stock[];
}

export interface FixedDeposit {
  id: string;
  bankName: string;
  principal: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
}

export interface RecurringDeposit {
  id: string;
  bankName: string;
  monthlyDeposit: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
}

export type IncomeSource = 'Salary' | 'Freelance' | 'Dividends' | 'Interest' | 'Rental' | 'Other';

export interface IncomeEntry {
  id: string;
  date: string;
  source: IncomeSource;
  amount: number;
  description?: string;
}

export type ExpenseCategory = 'Food' | 'Rent' | 'EMI' | 'Utilities' | 'Entertainment' | 'Medical' | 'Travel' | 'Investment' | 'Other';
export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Net Banking';

export interface ExpenseEntry {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string;
}

export type LoanType = 'Home' | 'Personal' | 'Vehicle' | 'Education' | 'Credit Card' | 'Other';

export interface Loan {
  id: string;
  lenderName: string;
  loanType: LoanType;
  principalAmount: number;
  outstandingBalance: number;
  emiAmount: number;
  interestRate: number;
  emiDate: number; // day of month
  startDate: string;
  endDate: string;
}

export interface PortfolioData {
  bankAccounts: BankAccount[];
  investments: {
    mutualFunds: MutualFund[];
    stockPortfolios: StockPortfolio[];
    fd: FixedDeposit[];
    rd: RecurringDeposit[];
  };
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  loans: Loan[];
  settings: {
    monthlyBudget: number;
  };
}
