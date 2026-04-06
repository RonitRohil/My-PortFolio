import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

export const calculateMonthsElapsed = (startDate: string, endDate?: string) => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  
  // If end date is after or on the same day of the month as start date, count the current month
  if (end.getDate() >= start.getDate()) {
    months += 1;
  }
  
  return Math.max(0, months);
};

export const calculateSIPInvested = (monthlyAmount: number, startDate: string) => {
  return calculateMonthsElapsed(startDate) * monthlyAmount;
};

export const calculateMaturityAmount = (principal: number, rate: number, years: number, compoundingFrequency: number = 4) => {
  // A = P(1 + r/n)^(nt)
  const r = rate / 100;
  const n = compoundingFrequency;
  const t = years;
  return principal * Math.pow(1 + r / n, n * t);
};

export const calculateRDInvested = (monthlyDeposit: number, startDate: string, maturityDate: string) => {
  const now = new Date();
  const start = new Date(startDate);
  const maturity = new Date(maturityDate);
  
  // If today is past maturity, total invested is for all months
  const effectiveEnd = now > maturity ? maturityDate : now.toISOString();
  const monthsElapsed = calculateMonthsElapsed(startDate, effectiveEnd);
  
  // Total months in tenure
  const totalMonths = calculateMonthsElapsed(startDate, maturityDate);
  
  return Math.min(monthsElapsed, totalMonths) * monthlyDeposit;
};

export const calculateRDMaturityAmount = (monthlyDeposit: number, rate: number, months: number) => {
  // Indian Bank RD formula (Quarterly Compounding)
  // M = P * ((1+i)^n - 1) / (1 - (1+i)^(-1/3))
  // where i = quarterly interest rate (r/400)
  const i = rate / 400;
  const n = months / 3; // number of quarters
  
  // If months is not a multiple of 3, we approximate
  const maturity = monthlyDeposit * (Math.pow(1 + i, n) - 1) / (1 - Math.pow(1 + i, -1/3));
  return maturity;
};

export const calculateRDValue = (monthlyDeposit: number, rate: number, startDate: string, maturityDate: string) => {
  const invested = calculateRDInvested(monthlyDeposit, startDate, maturityDate);
  const now = new Date();
  const start = new Date(startDate);
  const maturity = new Date(maturityDate);
  
  if (now <= start) return invested;
  
  const effectiveEnd = now > maturity ? maturity : now;
  const monthsElapsed = calculateMonthsElapsed(startDate, effectiveEnd.toISOString());
  
  // Current value is the maturity amount if it were to mature today
  return calculateRDMaturityAmount(monthlyDeposit, rate, monthsElapsed);
};

export const calculateFDValue = (principal: number, rate: number, startDate: string, maturityDate: string) => {
  const now = new Date();
  const start = new Date(startDate);
  const maturity = new Date(maturityDate);
  
  if (now <= start) return principal;
  
  const effectiveEnd = now > maturity ? maturity : now;
  const yearsElapsed = (effectiveEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  // Quarterly compounding
  return calculateMaturityAmount(principal, rate, yearsElapsed, 4);
};

export const calculateWeightedAverage = (existingQty: number, existingAvg: number, newQty: number, newPrice: number) => {
  if (existingQty + newQty === 0) return 0;
  return (existingQty * existingAvg + newQty * newPrice) / (existingQty + newQty);
};

export const parseCSV = (csv: string) => {
  // Remove BOM if present
  const cleanCsv = csv.replace(/^\uFEFF/, '');
  const lines = cleanCsv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = commaCount >= semiCount ? ',' : ';';

  // Helper to split CSV line correctly handling quotes
  const splitLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = splitLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitLine(line);
    const obj: any = {};
    headers.forEach((header, i) => {
      if (header) {
        obj[header] = values[i];
      }
    });
    return obj;
  });
};
