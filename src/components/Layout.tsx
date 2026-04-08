import React, { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CreditCard,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PortfolioData } from "../types";
import { cn, searchPortfolio } from "../lib/utils";
import { SyncStatus } from "./SyncStatus";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: PortfolioData;
  lastSync: Date | null;
  syncing: boolean;
  onSignOut: () => Promise<void>;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bank", label: "Bank Accounts", icon: Building2 },
  { id: "investments", label: "Investments", icon: TrendingUp },
  { id: "transactions", label: "Transactions", icon: ArrowDownCircle },
  { id: "loans", label: "Loans & EMI", icon: CreditCard },
  { id: "settings", label: "Data Management", icon: Settings },
];

const resultIcons = {
  expense: Wallet,
  income: ArrowUpCircle,
  investment: TrendingUp,
};

export default function Layout({ children, activeTab, setActiveTab, data, lastSync, syncing, onSignOut }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const results = useMemo(() => searchPortfolio(data, searchQuery), [data, searchQuery]);
  const logoSrc = `${import.meta.env.BASE_URL}favicon.svg`;

  const searchBox = (
    <div className="relative w-full max-w-xl">
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search transactions, income, and investments..."
        className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition focus:border-emerald-500"
      />
      {searchQuery.trim().length >= 3 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
          {results.length > 0 ? (
            results.map((result) => {
              const Icon = resultIcons[result.kind];
              return (
                <button
                  key={result.id}
                  onClick={() => {
                    setActiveTab(result.tab);
                    setSearchQuery("");
                  }}
                  className="flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3 text-left transition hover:bg-slate-800/70"
                >
                  <span className="rounded-xl bg-slate-800 p-2 text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-100">{result.label}</span>
                    <span className="block truncate text-xs text-slate-400">{result.sublabel}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-sm text-slate-400">No matches found.</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 md:flex">
      <aside className="hidden h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 print:hidden md:flex">
        <div className="p-6">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-emerald-500">
            <img src={logoSrc} alt="My Portfolio logo" className="h-9 w-9 rounded-xl bg-slate-900 p-1.5 shadow-lg shadow-emerald-500/20" />
            <span>My Portfolio</span>
          </h1>
        </div>
        <nav className="flex-1 space-y-2 px-4 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200",
                activeTab === item.id
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4 text-center text-xs text-slate-500">
          (c) 2026 My Portfolio
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur print:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-4 md:hidden">
            <h1 className="flex items-center gap-2 text-xl font-bold text-emerald-500">
              <img src={logoSrc} alt="My Portfolio logo" className="h-7 w-7 rounded-lg bg-slate-900 p-1 shadow-lg shadow-emerald-500/20" />
              <span>My Portfolio</span>
            </h1>
            <button onClick={() => setIsMobileMenuOpen((value) => !value)} className="p-2 text-slate-400 hover:text-white">
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
          <div className="hidden px-6 py-4 md:block">
            <div className="flex items-center justify-between gap-4">
              {searchBox}
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <SyncStatus lastSync={lastSync} />
                  {syncing && <div className="mt-1 text-[11px] text-slate-500">Syncing changes...</div>}
                </div>
                <button
                  onClick={() => void onSignOut()}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-500/40 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-2 px-4 pb-4 md:hidden">
            {searchBox}
            <div className="flex items-center justify-between">
              <div>
                <SyncStatus lastSync={lastSync} />
                {syncing && <div className="mt-1 text-[11px] text-slate-500">Syncing...</div>}
              </div>
              <button
                onClick={() => void onSignOut()}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-500/40 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 z-30 bg-slate-950 pt-32 md:hidden"
            >
              <nav className="space-y-4 px-6">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl px-6 py-4 text-lg transition-all",
                      activeTab === item.id ? "bg-emerald-500 text-white" : "bg-slate-900 text-slate-400",
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="font-semibold">{item.label}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8 lg:p-10">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-800 bg-slate-900/85 p-2 backdrop-blur-lg print:hidden md:hidden">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg p-2 transition-colors",
                activeTab === item.id ? "text-emerald-500" : "text-slate-500",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label.split(" ")[0]}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
