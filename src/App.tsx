/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Layout from "./components/Layout";
import { PortfolioData } from "./types";
import { loadData, saveData } from "./lib/storage";
import Dashboard from "./pages/Dashboard";
import BankAccounts from "./pages/BankAccounts";
import Investments from "./pages/Investments";
import IncomeTracker from "./pages/IncomeTracker";
import ExpenseTracker from "./pages/ExpenseTracker";
import LoansTracker from "./pages/LoansTracker";
import Settings from "./pages/Settings";

export default function App() {
  const [data, setData] = useState<PortfolioData>(loadData());
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateData = (newData: Partial<PortfolioData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard data={data} />;
      case "bank":
        return <BankAccounts data={data} updateData={updateData} />;
      case "investments":
        return <Investments data={data} updateData={updateData} />;
      case "income":
        return <IncomeTracker data={data} updateData={updateData} />;
      case "expenses":
        return <ExpenseTracker data={data} updateData={updateData} />;
      case "loans":
        return <LoansTracker data={data} updateData={updateData} />;
      case "settings":
        return <Settings data={data} updateData={updateData} />;
      default:
        return <Dashboard data={data} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
