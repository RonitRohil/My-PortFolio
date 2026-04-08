import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { migrateLocalStorageToSupabase } from "../lib/migrateToSupabase";
import { MIGRATION_FLAG_KEY } from "../lib/dataService";
import { supabase } from "../lib/supabase";

interface Props {
  children: ReactNode;
}

const AuthSessionContext = createContext<{ signOut: () => Promise<void> } | null>(null);

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error("useAuthSession must be used within AuthGuard");
  return context;
}

export function AuthGuard({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      setSession(currentSession);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (!session || alreadyMigrated) return;

    migrateLocalStorageToSupabase()
      .then(({ migrated, counts }) => {
        if (migrated) console.log("Supabase migration complete:", counts);
      })
      .catch((migrationError) => {
        console.error("Supabase migration failed:", migrationError);
      });
  }, [session]);

  const signIn = async () => {
    setSigningIn(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setSigningIn(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <h1 className="mb-6 text-center text-2xl font-bold text-emerald-500">My Portfolio</h1>
          <div className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && signIn()}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && signIn()}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              onClick={signIn}
              disabled={signingIn}
              className="mt-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingIn ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AuthSessionContext.Provider value={{ signOut }}>{children}</AuthSessionContext.Provider>;
}
