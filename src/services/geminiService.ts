import { GoogleGenAI } from "@google/genai";
import { PortfolioData } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzePortfolio(data: PortfolioData) {
  const prompt = `
    Analyze this personal finance portfolio and provide 3 concise, actionable insights for improvement.
    The user is in India (INR).
    
    Data Summary:
    - Bank Balance: ${data.bankAccounts.reduce((sum, a) => sum + a.balance, 0)}
    - Total Investments (Current): ${data.investments.mutualFunds.reduce((sum, m) => sum + m.currentValue, 0) + data.investments.stockPortfolios.reduce((sum, p) => sum + p.holdings.reduce((s, h) => s + (h.quantity * h.currentPrice), 0), 0)}
    - Loans Outstanding: ${data.loans.reduce((sum, l) => sum + l.outstandingBalance, 0)}
    
    Format the response as a JSON array of strings.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const text = response.text;
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson) as string[];
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return ["Build an emergency fund.", "Diversify your portfolio.", "Review high-interest debt."];
  }
}
