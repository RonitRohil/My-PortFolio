import { useState } from "react";

export function useMonthNavigator(initialYear?: number, initialMonth?: number) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());

  const goToPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
    } else {
      setMonth((value) => value - 1);
    }
  };

  const goToNext = () => {
    const current = new Date();
    if (year === current.getFullYear() && month === current.getMonth()) return;
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
    } else {
      setMonth((value) => value + 1);
    }
  };

  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const label = new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return { year, month, goToPrev, goToNext, goToToday, isCurrentMonth, label };
}
