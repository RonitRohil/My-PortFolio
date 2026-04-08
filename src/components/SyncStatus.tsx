import { useEffect, useState } from "react";

export function SyncStatus({ lastSync }: { lastSync: Date | null }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span
        className={`inline-block h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`}
        aria-hidden="true"
      />
      <span>
        {online
          ? lastSync
            ? `Synced ${lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
            : "Online"
          : "Offline - changes buffered locally"}
      </span>
    </div>
  );
}
