import { PortfolioData } from "../types";

const STORAGE_KEY = "myportfolio_data";

const INITIAL_DATA: any = {
  bankAccounts: [],
  investments: {
    mutualFunds: [],
    stockPortfolios: [],
    fd: [],
    rd: [],
  },
  income: [],
  expenses: [],
  loans: [],
  settings: {
    monthlyBudget: 50000,
  },
};

export const loadData = (): PortfolioData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // Migration for stockPortfolios
      if (data.investments && data.investments.stocks && !data.investments.stockPortfolios) {
        data.investments.stockPortfolios = [{
          id: 'default-portfolio',
          name: 'Default Portfolio',
          ownerName: 'Me',
          broker: 'Other',
          holdings: data.investments.stocks
        }];
        delete data.investments.stocks;
      }
      // Ensure stockPortfolios exists
      if (data.investments && !data.investments.stockPortfolios) {
        data.investments.stockPortfolios = [];
      }
      return data;
    }
  } catch (e) {
    console.error("Failed to load data from localStorage", e);
  }
  return INITIAL_DATA;
};

export const saveData = (data: PortfolioData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data to localStorage", e);
  }
};

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};

export const getStorageSize = () => {
  const saved = localStorage.getItem(STORAGE_KEY) || "";
  const sizeInBytes = new Blob([saved]).size;
  return (sizeInBytes / 1024).toFixed(2) + " KB";
};
