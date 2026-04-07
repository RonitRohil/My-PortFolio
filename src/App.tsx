/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import { PortfolioData } from "./types";
import { loadData, saveData } from "./lib/storage";
import Dashboard from "./pages/Dashboard";
import BankAccounts from "./pages/BankAccounts";
import Investments from "./pages/Investments";
import Transactions from "./pages/Transactions";
import LoansTracker from "./pages/LoansTracker";
import Settings from "./pages/Settings";
import { useAutoScheduler } from "./hooks/useAutoScheduler";

export default function App() {
  const [data, setData] = useState<PortfolioData>(() => loadData());
  const [activeTab, setActiveTab] = useState("dashboard");
  const validTabs = useMemo(() => new Set(["dashboard", "bank", "investments", "transactions", "loans", "settings"]), []);

  const getTabFromLocation = useCallback(() => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const hashTab = hash.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get("p") || "").replace(/^\/+|\/+$/g, "");
    const candidate = hashTab || queryTab;
    return validTabs.has(candidate) ? candidate : "dashboard";
  }, [validTabs]);

  useEffect(() => {
    const initialTab = getTabFromLocation();
    setActiveTab(initialTab);

    if (new URLSearchParams(window.location.search).get("p")) {
      const nextHash = `#/${initialTab}`;
      window.history.replaceState({}, "", `${window.location.pathname}${nextHash}`);
    }

    const onHashChange = () => setActiveTab(getTabFromLocation());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [getTabFromLocation]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    const nextHash = `#/${activeTab}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }, [activeTab]);

  const updateData = useCallback(
    (newData: Partial<PortfolioData>) => {
      setData((prev) => ({ ...prev, ...newData }));
    },
    [],
  );

  useAutoScheduler(data, updateData);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard data={data} setActiveTab={setActiveTab} />;
      case "bank":
        return <BankAccounts data={data} updateData={updateData} />;
      case "investments":
        return <Investments data={data} updateData={updateData} />;
      case "transactions":
        return <Transactions data={data} updateData={updateData} />;
      case "loans":
        return <LoansTracker data={data} updateData={updateData} />;
      case "settings":
        return <Settings data={data} updateData={updateData} setActiveTab={setActiveTab} />;
      default:
        return <Dashboard data={data} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} data={data}>
      {renderContent()}
    </Layout>
  );
}
