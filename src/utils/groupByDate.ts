export interface DayGroup<T> {
  date: string;
  displayDate: string;
  items: T[];
  dayIncome: number;
  dayExpense: number;
  dayNet: number;
}

export function groupTransactionsByDate<T extends { date: string; amount: number }>(
  items: T[],
  type: "income" | "expense" | "mixed",
): DayGroup<T>[] {
  const sorted = [...items].sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime());
  const groups = new Map<string, T[]>();
  sorted.forEach((item) => {
    const key = item.date.substring(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([date, dayItems]) => {
    const d = new Date(`${date}T00:00:00`);
    const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });
    const total = dayItems.reduce((sum, item) => sum + item.amount, 0);
    return {
      date,
      displayDate: `${dateStr} (${weekday})`,
      items: dayItems,
      dayIncome: type === "income" ? total : 0,
      dayExpense: type === "expense" ? total : 0,
      dayNet: type === "income" ? total : type === "expense" ? -total : 0,
    };
  });
}
