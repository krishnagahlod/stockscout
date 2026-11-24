"use client";

import { ShieldAlert, AlertTriangle, Scale, BrainCircuit, Activity } from "lucide-react";

export default function DisclaimerPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Legal & Compliance Disclaimer</h1>
          <p className="text-muted-foreground">Important information regarding the use of StockScout AI</p>
        </div>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-amber-800 dark:text-amber-500 font-semibold m-0">Not SEBI Registered Investment Advice</h3>
              <p className="text-amber-900/80 dark:text-amber-200/80 m-0">
                StockScout is an informational and educational platform. We are NOT registered with the Securities and Exchange Board of India (SEBI) as an Investment Advisor, Research Analyst, or Portfolio Manager. The AI-generated insights, scores, and strategies provided on this platform do not constitute financial, investment, or trading advice.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-5 space-y-3 bg-card">
            <div className="flex items-center gap-2 text-primary font-medium">
              <BrainCircuit className="h-4 w-4" />
              AI Limitations
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Our platform utilizes Large Language Models (LLMs) and quantitative algorithms to parse financial data, analyze news sentiment, and construct rule-based portfolios. While we strive for accuracy, AI models can hallucinate, misinterpret nuances in financial reports, or fail to account for unprecedented market conditions.
            </p>
          </div>

          <div className="border rounded-lg p-5 space-y-3 bg-card">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Activity className="h-4 w-4" />
              Backtesting vs Live Markets
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Backtested performance results are hypothetical and generated with the benefit of hindsight. They do not reflect actual trading, liquidity constraints, slippage, or brokerage fees. Past performance of any algorithm or strategy is no guarantee of future results in live markets.
            </p>
          </div>
        </div>

        <div className="border-l-4 border-slate-300 pl-4 py-1 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-muted-foreground" />
            Assumption of Risk
          </h3>
          <p className="text-muted-foreground">
            Trading in equity markets involves substantial risk of loss and is not suitable for every investor. You are solely responsible for evaluating the merits and risks associated with the use of any information or content on this platform before making any investment decisions. By using StockScout, you agree that we bear no liability for any financial losses or damages incurred.
          </p>
          <p className="text-muted-foreground">
            Data provided by third-party APIs (including Yahoo Finance and news aggregators) may be delayed, inaccurate, or incomplete. Always verify financial data through official exchange disclosures before executing trades.
          </p>
        </div>
      </div>
    </div>
  );
}
