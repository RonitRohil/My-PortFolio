import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Building2, 
  TrendingUp, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CreditCard, 
  Settings,
  Menu,
  X
} from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bank", label: "Bank Accounts", icon: Building2 },
  { id: "investments", label: "Investments", icon: TrendingUp },
  { id: "income", label: "Income", icon: ArrowUpCircle },
  { id: "expenses", label: "Expenses", icon: ArrowDownCircle },
  { id: "loans", label: "Loans & EMI", icon: CreditCard },
  { id: "settings", label: "Data Management", icon: Settings },
];

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 sticky top-0 h-screen">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-emerald-500 flex items-center gap-2">
            <TrendingUp className="w-8 h-8" />
            My Portfolio
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === item.id 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 text-center">© 2026 My Portfolio</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <h1 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          My Portfolio
        </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-40 bg-slate-950 pt-20"
          >
            <nav className="px-6 space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-lg transition-all",
                    activeTab === item.id 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                      : "text-slate-400 bg-slate-900"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="font-semibold">{item.label}</span>
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar (Optional but requested) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800 flex justify-around items-center p-2 z-50">
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
              activeTab === item.id ? "text-emerald-500" : "text-slate-500"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
