import React from "react";
import { cn } from "../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Card({ children, className, title, subtitle, action }: CardProps) {
  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl", className)}>
      {(title || subtitle || action) && (
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export function Button({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', size?: 'sm' | 'md' | 'lg' }) {
  const variants = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger: "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ label, error, className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-slate-400 ml-1">{label}</label>}
      <input 
        type={type}
        step={type === 'number' ? 'any' : undefined}
        className={cn(
          "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600",
          error && "border-rose-500 focus:ring-rose-500/50 focus:border-rose-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-500 ml-1">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-slate-400 ml-1">{label}</label>}
      <select 
        className={cn(
          "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none",
          error && "border-rose-500 focus:ring-rose-500/50 focus:border-rose-500",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-rose-500 ml-1">{error}</p>}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children, className }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, className?: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn("bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden", className)}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export function Badge({ children, variant = 'info', className }: { children: React.ReactNode, variant?: 'success' | 'warning' | 'danger' | 'info' | 'secondary', className?: string }) {
  const variants = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    info: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    secondary: "bg-slate-800 text-slate-400 border-slate-700",
  };

  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-full", variants[variant], className)}>
      {children}
    </span>
  );
}

export function Table({ headers, children, onSort, sortConfig }: { 
  headers: { label: string, key?: string }[], 
  children: React.ReactNode,
  onSort?: (key: string) => void,
  sortConfig?: { key: string, direction: 'asc' | 'desc' }
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800">
            {headers.map((header, i) => (
              <th 
                key={i} 
                className={cn(
                  "px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider",
                  header.key && "cursor-pointer hover:text-emerald-500 transition-colors"
                )}
                onClick={() => header.key && onSort?.(header.key)}
              >
                <div className="flex items-center gap-1">
                  {header.label}
                  {sortConfig && header.key && sortConfig.key === header.key && (
                    <span className="text-emerald-500">
                      {sortConfig.direction === 'asc' ? '^' : 'v'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {children}
        </tbody>
      </table>
    </div>
  );
}

import { X } from "lucide-react";
import { motion } from "motion/react";
