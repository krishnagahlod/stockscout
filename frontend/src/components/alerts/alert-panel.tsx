"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, fetchAlerts, markAlertRead } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function AlertPanel({ strategyId }: { strategyId?: number }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadAlerts();
  }, [strategyId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await fetchAlerts(strategyId, false); // Only fetch unread alerts
      setAlerts(data);
    } catch (err) {
      console.error("Failed to fetch alerts", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (alertId: number) => {
    try {
      await markAlertRead(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error("Failed to dismiss alert", err);
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return null;
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Active Alerts
      </h3>
      <div className="flex flex-col gap-3">
        {alerts.map((alert) => {
          let Icon = Info;
          let colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/20";
          
          if (alert.severity === "warning") {
            Icon = AlertTriangle;
            colorClass = "bg-orange-500/10 text-orange-500 border-orange-500/20";
          } else if (alert.severity === "critical") {
            Icon = AlertCircle;
            colorClass = "bg-red-500/10 text-red-500 border-red-500/20";
          }

          const isExpanded = expanded[alert.id];

          return (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 ${colorClass} transition-all`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold">{alert.title}</h4>
                    <p className="text-sm opacity-90 mt-1 line-clamp-1">
                      {isExpanded ? alert.message : alert.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={() => toggleExpand(alert.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button> */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={() => handleDismiss(alert.id)}
                    title="Dismiss alert"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
