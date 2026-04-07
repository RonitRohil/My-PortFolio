import React from "react";

export default function MonthNavigator({
  label,
  onPrev,
  onNext,
  isCurrentMonth,
  onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  isCurrentMonth: boolean;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
      <button onClick={onPrev} className="rounded-lg p-2 text-xl hover:bg-white/10">
        ‹
      </button>
      <div className="flex flex-col items-center">
        <span className="font-semibold text-base">{label}</span>
        {!isCurrentMonth && (
          <button onClick={onToday} className="mt-0.5 text-xs text-teal-400">
            Back to today
          </button>
        )}
      </div>
      <button
        onClick={onNext}
        disabled={isCurrentMonth}
        className={`rounded-lg p-2 text-xl ${isCurrentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"}`}
      >
        ›
      </button>
    </div>
  );
}
