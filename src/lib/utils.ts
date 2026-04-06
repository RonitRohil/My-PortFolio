import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

export const calculateSIPInvested = (monthlyAmount: number, startDate: string) => {
  const start = new Date(startDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
  return Math.max(0, months) * monthlyAmount;
};

export const calculateMaturityAmount = (principal: number, rate: number, years: number, compoundingFrequency: number = 4) => {
  // A = P(1 + r/n)^(nt)
  const r = rate / 100;
  const n = compoundingFrequency;
  const t = years;
  return principal * Math.pow(1 + r / n, n * t);
};

export const calculateWeightedAverage = (existingQty: number, existingAvg: number, newQty: number, newPrice: number) => {
  if (existingQty + newQty === 0) return 0;
  return (existingQty * existingAvg + newQty * newPrice) / (existingQty + newQty);
};

export const parseCSV = (csv: string) => {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: any = {};
    headers.forEach((header, i) => {
      obj[header] = values[i];
    });
    return obj;
  });
};
