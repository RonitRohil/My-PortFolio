import React, { useState } from "react";
import { PortfolioData, ExpenseCategory, PaymentMethod, IncomeSource } from "../types";
import {
  getAllAccounts,
  getExpenseCategories,
  getExpenseMethods,
  getIncomeSources,
  saveExpenseEntry,
  saveIncomeEntry,
  saveTransferEntry,
  formatCurrency,
} from "../lib/utils";
import Icon from "./Icon";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: PortfolioData;
  updateData: (d: Partial<PortfolioData>) => void;
  lastSync: Date | null;
  syncing: boolean;
  onSignOut: () => Promise<void>;
}

const PRIMARY_TABS = [
  { id: "dashboard", label: "Home", icon: "home" },
  { id: "transactions", label: "Activity", icon: "swap" },
  { id: "investments", label: "Invest", icon: "coins" },
  { id: "loans", label: "Loans", icon: "credit-card" },
  { id: "more", label: "More", icon: "menu" },
] as const;

const DESKTOP_TABS = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "transactions", label: "Transactions", icon: "swap" },
  { id: "bank", label: "Bank Accounts", icon: "bank" },
  { id: "investments", label: "Investments", icon: "coins" },
  { id: "loans", label: "Loans & EMIs", icon: "credit-card" },
  { id: "stock-mappings", label: "Stock Mappings", icon: "sliders" },
  { id: "settings", label: "Settings", icon: "gear" },
] as const;

const MORE_ITEMS = [
  { id: "bank", icon: "bank", label: "Bank Accounts" },
  { id: "stock-mappings", icon: "sliders", label: "Stock Mappings" },
  { id: "settings", icon: "gear", label: "Settings" },
] as const;

function Segmented({ options, value, onChange }: {
  options: { id: string; label: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex rounded-full p-1" style={{ background: "var(--bg-3)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="relative z-[1] inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition"
            style={active ? {
              color: "var(--bg)",
              background: "var(--accent)",
              boxShadow: "0 4px 18px -6px color-mix(in oklch, var(--accent) 60%, transparent)",
            } : { color: "var(--ink-3)" }}
          >
            {opt.icon && <Icon name={opt.icon as any} size={14} strokeWidth={2} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({ value, onChange, sign }: { value: string; onChange: (v: string) => void; sign: string }) {
  const color = sign === "income" ? "var(--pos)" : sign === "transfer" ? "var(--info)" : "var(--neg)";
  return (
    <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--bg-3)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--ink-4)" }}>Amount</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[40px] font-semibold leading-none" style={{ color }}>Rs</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0"
          className="flex-1 bg-transparent font-display text-[40px] font-semibold leading-none outline-none"
          style={{ color }}
        />
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ink-4)" }}>{label}</div>
      {children}
    </div>
  );
}

function NativeSelect({ value, onChange, children }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[14px] px-3.5 py-[11px] text-[14px] outline-none appearance-none"
      style={{ background: "var(--bg-3)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--line)" }}
    >
      {children}
    </select>
  );
}

function DesktopSidebar({
  tab,
  go,
  openAdd,
  syncing,
  onSignOut,
}: {
  tab: string;
  go: (id: string) => void;
  openAdd: () => void;
  syncing: boolean;
  onSignOut: () => Promise<void>;
}) {
  return (
    <aside className="hidden lg:flex w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-[color:var(--bg-2)]/60">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div
          className="grid h-9 w-9 place-items-center rounded-[10px]"
          style={{
            background: "color-mix(in oklch, var(--accent) 18%, transparent)",
            boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--accent) 40%, transparent)",
          }}
        >
          <div className="h-3.5 w-3.5 rounded-sm rotate-45" style={{ background: "var(--accent)" }} />
        </div>
        <div>
          <div className="font-display text-[14.5px] font-semibold leading-tight">Expense Manager</div>
          <div className="text-[10.5px] text-[color:var(--ink-4)]">Personal finance</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={openAdd}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold text-[color:var(--bg)] active:scale-[0.98]"
          style={{
            background: "var(--accent)",
            boxShadow: "0 6px 18px -8px color-mix(in oklch, var(--accent) 60%, transparent)",
          }}
        >
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New transaction
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto no-scrollbar">
        {DESKTOP_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`group flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left transition ${
                active ? "bg-[color:var(--accent)]/12 text-[color:var(--ink)]" : "text-[color:var(--ink-3)] hover:bg-white/[0.04] hover:text-[color:var(--ink)]"
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-[8px] ${active ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)]" : "text-[color:var(--ink-3)]"}`}>
                <Icon name={item.icon as any} size={15} />
              </span>
              <span className="flex-1 text-[13px] font-semibold">{item.label}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />}
            </button>
          );
        })}
      </nav>

      <div className="m-3 rounded-[14px] bg-[color:var(--bg-3)] p-3 hairline">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-8 w-8 place-items-center rounded-full font-display text-[11px] font-semibold"
            style={{ background: "color-mix(in oklch, var(--accent) 18%, transparent)", color: "var(--accent)" }}
          >
            RS
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold truncate">Ronit S.</div>
            <div className="flex items-center gap-1 text-[10.5px] text-[color:var(--ink-4)]">
              <span className={`h-1.5 w-1.5 rounded-full bg-[color:var(--pos)] ${syncing ? "" : "sync-dot"}`} />
              {syncing ? "Syncing..." : "Synced"}
            </div>
          </div>
          <button className="text-[color:var(--ink-4)] hover:text-[color:var(--ink)]" onClick={() => void onSignOut()}>
            <Icon name="log-out" size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function DesktopTopbar({ syncing, lastSync }: { syncing: boolean; lastSync: Date | null }) {
  const lastSyncLabel = lastSync
    ? lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="hidden lg:flex sticky top-0 z-20 items-center gap-4 border-b border-white/[0.06] bg-[color:var(--bg)]/85 backdrop-blur px-8 py-4">
      <div className="relative flex-1 max-w-xl">
        <div className="flex items-center gap-2 rounded-[12px] bg-[color:var(--bg-2)] px-3.5 py-2.5 hairline">
          <Icon name="search" size={16} className="text-[color:var(--ink-4)]" />
          <input
            placeholder="Search transactions, accounts, investments..."
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[color:var(--ink-4)]"
          />
          <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono-num text-[10px] text-[color:var(--ink-4)]">Ctrl K</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--bg-2)] hairline px-3 py-1.5 text-[11px] font-semibold text-[color:var(--ink-3)]">
          <span className={`h-1.5 w-1.5 rounded-full bg-[color:var(--pos)] ${syncing ? "" : "sync-dot"}`} />
          {syncing ? "Syncing..." : `Synced${lastSyncLabel ? ` · ${lastSyncLabel}` : ""}`}
        </span>
        <button className="grid h-9 w-9 place-items-center rounded-[10px] bg-[color:var(--bg-2)] hairline text-[color:var(--ink-3)] hover:text-[color:var(--ink)]">
          <Icon name="info" size={15} />
        </button>
      </div>
    </div>
  );
}

function Header({ syncing }: { syncing: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 pt-3 pb-2 bg-gradient-to-b from-[color:var(--bg)] via-[color:var(--bg)]/95 to-transparent">
      <div className="flex items-center gap-2">
        <div
          className="grid h-8 w-8 place-items-center rounded-[9px]"
          style={{
            background: "color-mix(in oklch, var(--accent) 18%, transparent)",
            boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--accent) 40%, transparent)",
          }}
        >
          <div className="h-3 w-3 rounded-sm rotate-45" style={{ background: "var(--accent)" }} />
        </div>
        <div className="font-display text-[13.5px] font-semibold tracking-tight">Expense Manager</div>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 rounded-full bg-[color:var(--bg-2)] hairline px-2.5 py-1">
        <span className={`h-1.5 w-1.5 rounded-full bg-[color:var(--pos)] ${syncing ? "" : "sync-dot"}`} />
        <span className="text-[10.5px] font-semibold text-[color:var(--ink-3)]">{syncing ? "Syncing..." : "Synced"}</span>
      </div>
    </header>
  );
}

function BottomNav({ active, onChange, onAdd }: { active: string; onChange: (id: string) => void; onAdd: () => void }) {
  const primaryIds = ["dashboard", "transactions", "investments", "loans"];
  const navActive = primaryIds.includes(active) ? active : "more";

  return (
    <div className="sticky bottom-0 z-30 pb-[max(10px,env(safe-area-inset-bottom))] bg-gradient-to-t from-[color:var(--bg)] via-[color:var(--bg)] to-transparent pt-3">
      <div className="relative mx-3 flex items-center rounded-[22px] bg-[color:var(--bg-2)] hairline-2 px-1.5 py-1.5 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.8)]">
        {PRIMARY_TABS.slice(0, 2).map((tab) => (
          <NavBtn key={tab.id} tab={tab} active={navActive === tab.id} onClick={() => onChange(tab.id)} />
        ))}
        <button
          onClick={onAdd}
          className="relative -mt-8 mx-1 grid h-14 w-14 place-items-center rounded-full text-[color:var(--bg)] transition active:scale-95"
          style={{
            background: "var(--accent)",
            boxShadow: "0 12px 28px -8px color-mix(in oklch, var(--accent) 60%, transparent), 0 0 0 6px var(--bg-2)",
          }}
        >
          <Icon name="plus" size={22} strokeWidth={2.4} />
        </button>
        {PRIMARY_TABS.slice(2, 4).map((tab) => (
          <NavBtn key={tab.id} tab={tab} active={navActive === tab.id} onClick={() => onChange(tab.id)} />
        ))}
        <NavBtn tab={PRIMARY_TABS[4]} active={navActive === "more"} onClick={() => onChange("more")} />
      </div>
    </div>
  );
}

function NavBtn({ tab, active, onClick }: { tab: (typeof PRIMARY_TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-[18px] py-2 transition ${
        active ? "text-[color:var(--accent)]" : "text-[color:var(--ink-4)] hover:text-[color:var(--ink-2)]"
      }`}
    >
      {active && <span className="absolute inset-x-4 -top-[2px] h-[3px] rounded-b-full bg-[color:var(--accent)]" />}
      <Icon name={tab.icon as any} size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="text-[9.5px] font-semibold tracking-wide">{tab.label}</span>
    </button>
  );
}

function AddTxSheet({ open, onClose, data, updateData }: {
  open: boolean;
  onClose: () => void;
  data: PortfolioData;
  updateData: (d: Partial<PortfolioData>) => void;
}) {
  const [kind, setKind] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [source, setSource] = useState<IncomeSource>("Salary");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const accounts = getAllAccounts(data);
  const categories = getExpenseCategories();
  const methods = getExpenseMethods();
  const sources = getIncomeSources();

  if (!open) return null;

  const handleSave = () => {
    if (!amount || Number.isNaN(parseFloat(amount))) return;

    const amt = parseFloat(amount);
    const fromAcc = accounts.find((account) => account.id === accountId) || accounts[0];
    const toAcc = accounts.find((account) => account.id === toAccountId) || accounts[1];

    if (kind === "expense") {
      updateData(saveExpenseEntry(data, {
        id: crypto.randomUUID(),
        date,
        amount: amt,
        category: (category || categories[0]) as ExpenseCategory,
        paymentMethod: method,
        fromAccountId: fromAcc?.id,
        fromAccountName: fromAcc?.bankName,
        description: note,
        isRecurring: false,
      } as any));
    } else if (kind === "income") {
      updateData(saveIncomeEntry(data, {
        id: crypto.randomUUID(),
        date,
        amount: amt,
        source,
        toAccountId: fromAcc?.id || null,
        toAccountName: fromAcc?.bankName || null,
        description: note,
      }));
    } else if (fromAcc && toAcc) {
      updateData(saveTransferEntry(data, {
        id: crypto.randomUUID(),
        date,
        amount: amt,
        fromAccountId: fromAcc.id,
        fromAccountName: fromAcc.bankName,
        toAccountId: toAcc.id,
        toAccountName: toAcc.bankName,
        description: note,
        fees: 0,
      }));
    }

    setAmount("");
    setNote("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 fade-in bg-black/60" onClick={onClose} />
      <div
        className="sheet-in relative w-full max-w-[520px] overflow-hidden rounded-t-[26px]"
        style={{ background: "var(--bg-2)", boxShadow: "inset 0 0 0 1px var(--line-2)", maxHeight: "90dvh" }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>
        <div className="flex items-start justify-between px-5 pt-1 pb-3">
          <div>
            <div className="font-display text-[18px] font-semibold">New transaction</div>
            <div className="mt-0.5 text-[12.5px] text-[color:var(--ink-3)]">Log an entry in seconds</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 transition hover:bg-white/5" style={{ color: "var(--ink-3)" }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4 no-scrollbar space-y-4" style={{ maxHeight: "70dvh" }}>
          <Segmented
            value={kind}
            onChange={(value) => setKind(value as typeof kind)}
            options={[
              { id: "expense", label: "Expense", icon: "arrow-up-right" },
              { id: "income", label: "Income", icon: "arrow-down-right" },
              { id: "transfer", label: "Transfer", icon: "swap" },
            ]}
          />

          <AmountInput value={amount} onChange={setAmount} sign={kind} />

          {kind === "expense" && (
            <FieldRow label="Category">
              <NativeSelect value={category || categories[0]} onChange={setCategory}>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </NativeSelect>
            </FieldRow>
          )}

          {kind === "income" && (
            <FieldRow label="Source">
              <NativeSelect value={source} onChange={(value) => setSource(value as IncomeSource)}>
                {sources.map((item) => <option key={item} value={item}>{item}</option>)}
              </NativeSelect>
            </FieldRow>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <FieldRow label={kind === "transfer" ? "From" : "Account"}>
              <NativeSelect value={accountId || accounts[0]?.id || ""} onChange={setAccountId}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
              </NativeSelect>
            </FieldRow>
            {kind === "transfer" ? (
              <FieldRow label="To">
                <NativeSelect value={toAccountId || accounts[1]?.id || accounts[0]?.id || ""} onChange={setToAccountId}>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}</option>)}
                </NativeSelect>
              </FieldRow>
            ) : (
              <FieldRow label="Method">
                <NativeSelect value={method} onChange={(value) => setMethod(value as PaymentMethod)}>
                  {methods.map((item) => <option key={item} value={item}>{item}</option>)}
                </NativeSelect>
              </FieldRow>
            )}
          </div>

          <FieldRow label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[14px] px-3.5 py-[11px] text-[14px] outline-none"
              style={{ background: "var(--bg-3)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--line)" }}
            />
          </FieldRow>

          <FieldRow label="Note">
            <input
              type="text"
              placeholder="Optional description"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-[14px] px-3.5 py-[11px] text-[14px] outline-none placeholder:opacity-40"
              style={{ background: "var(--bg-3)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--line)" }}
            />
          </FieldRow>
        </div>
        <div className="flex gap-2 border-t px-5 py-3" style={{ borderColor: "rgba(255,255,255,0.06)", background: "var(--bg-2)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-[12px] text-[13.5px] font-semibold transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--line)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!amount}
            className="flex-1 h-10 rounded-[12px] text-[13.5px] font-semibold transition disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            Save {amount ? `Rs${amount}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoreSheet({ open, onClose, go }: { open: boolean; onClose: () => void; go: (id: string) => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 fade-in bg-black/60" onClick={onClose} />
      <div className="sheet-in relative w-full max-w-[420px] overflow-hidden rounded-t-[26px]" style={{ background: "var(--bg-2)", boxShadow: "inset 0 0 0 1px var(--line-2)" }}>
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>
        <div className="flex items-start justify-between px-5 pt-1 pb-3">
          <div>
            <div className="font-display text-[18px] font-semibold">More</div>
            <div className="mt-0.5 text-[12.5px] text-[color:var(--ink-3)]">Secondary sections</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/5" style={{ color: "var(--ink-3)" }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-5 pb-6 space-y-1.5">
          {MORE_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onClose();
                go(item.id);
              }}
              className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left transition hover:bg-white/[0.04]"
              style={{ background: "var(--bg-3)", boxShadow: "inset 0 0 0 1px var(--line)" }}
            >
              <div className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "rgba(255,255,255,0.04)", color: "var(--ink-2)" }}>
                <Icon name={item.icon as any} size={16} />
              </div>
              <div className="flex-1 text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{item.label}</div>
              <Icon name="chev-right" size={16} className="text-[color:var(--ink-4)]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout({
  children,
  activeTab,
  setActiveTab,
  data,
  updateData,
  lastSync,
  syncing,
  onSignOut,
}: LayoutProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (id: string) => {
    if (id === "more") {
      setMoreOpen(true);
      return;
    }

    setActiveTab(id);
    setMoreOpen(false);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[color:var(--bg)]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px]">
        <DesktopSidebar tab={activeTab} go={go} openAdd={() => setAddOpen(true)} syncing={syncing} onSignOut={onSignOut} />
        <div className="phone-shell flex min-w-0 flex-1 flex-col mx-auto lg:mx-0">
          <div className="mobile-only">
            <Header syncing={syncing} />
          </div>

          <DesktopTopbar syncing={syncing} lastSync={lastSync} />

          <main className="flex-1 overflow-y-auto scroll-area" id="main-scroll">
            <div className="mx-auto w-full lg:max-w-[1080px] lg:px-6">
              {children}
            </div>
          </main>

          <div className="mobile-only">
            <BottomNav active={activeTab} onChange={go} onAdd={() => setAddOpen(true)} />
          </div>
        </div>
      </div>

      <AddTxSheet open={addOpen} onClose={() => setAddOpen(false)} data={data} updateData={updateData} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} go={go} />
    </div>
  );
}
