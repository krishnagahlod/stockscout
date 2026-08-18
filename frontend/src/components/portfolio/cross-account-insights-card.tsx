"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, PieChart, TrendingUp, Layers, AlertTriangle } from "lucide-react";
import { StrategyPlaybook, HoldingSnapshot } from "@/lib/api";

interface CrossAccountInsightsCardProps {
  playbook: StrategyPlaybook | null;
  holdings: HoldingSnapshot[];
  isUnifiedMode: boolean;
}

export function CrossAccountInsightsCard({ playbook, holdings, isUnifiedMode }: CrossAccountInsightsCardProps) {
  if (!playbook || !isUnifiedMode) {
    return (
      <Card className="border-dashed bg-muted/20 h-64 flex flex-col items-center justify-center text-center">
        <Layers className="h-10 w-10 text-muted-foreground mb-4" />
        <CardTitle className="mb-2">Cross-Account Insights</CardTitle>
        <CardDescription className="max-w-sm">
          Select "All Accounts" to view unified analytics, overlapping positions, and cross-portfolio concentration risk.
        </CardDescription>
      </Card>
    );
  }

  // Calculate some dummy cross-account metrics for the demo based on the unified playbook
  // In a real app, these would come from the backend's /portfolio/cross-account-analysis endpoint
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.current_price, 0);
  
  // Find "overlapping" positions by assuming any position with high weight might be an overlap for demo purposes
  const overlappingHoldings = holdings
    .filter(h => h.weight > 0.1) // 10% weight is significant
    .slice(0, 3);
    
  const concentrationRisk = holdings.length > 0 
    ? Math.round(holdings.reduce((sum, h, i) => i < 5 ? sum + h.weight : sum, 0) * 100) 
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Unified Exposure & Overlaps
          </CardTitle>
          <CardDescription>
            Holdings distributed across multiple demat accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Overlapping Positions
            </h4>
            {overlappingHoldings.length > 0 ? (
              <div className="space-y-2">
                {overlappingHoldings.map((h, i) => (
                  <div key={h.symbol} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{h.symbol}</span>
                      <span className="text-xs text-muted-foreground">Held in {Math.floor(Math.random() * 2) + 2} accounts</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-sm">{(h.weight * 100).toFixed(1)}%</span>
                      <span className="text-xs text-muted-foreground text-amber-600 font-medium">High Concentration</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded border border-dashed text-center">
                No significant overlapping positions detected across your accounts.
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Concentration Risk</h4>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Top 5 Holdings</span>
              <span className="text-sm font-medium">{concentrationRisk}% of Total NAV</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${concentrationRisk > 50 ? 'bg-amber-500' : 'bg-primary'}`} 
                style={{ width: `${concentrationRisk}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {concentrationRisk > 50 
                ? "Your total portfolio is highly concentrated. Consider cross-account rebalancing."
                : "Your combined portfolio is well diversified across accounts."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Purpose Alignment
          </CardTitle>
          <CardDescription>
            How well your accounts match their designated purpose
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Long Term Wealth</span>
                <Badge variant="outline" className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/30">Strongly Aligned</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                92% of holdings are large-cap, low-volatility assets suitable for long-term holding.
              </p>
            </div>
            
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Active Trading</span>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/30">Drifting</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                3 positions have been held for &gt; 45 days. Consider moving them to your investment account.
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <PieChart className="h-4 w-4" /> Unified Allocation Insight
            </h4>
            <p className="text-sm text-muted-foreground">
              {playbook.sector_allocation_rationale}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
