"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, CheckCheck, RefreshCw, Trash2, BellOff } from "lucide-react";
import {
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  deleteAlert,
  checkThesisBreaks,
  type AlertData,
} from "@/lib/api";

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive"
> = {
  info: "secondary",
  warning: "default",
  critical: "destructive",
};

export default function AlertsPage() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => getAlerts({ limit: 100 }),
    refetchInterval: 10000,
  });

  const markRead = useMutation({
    mutationFn: markAlertRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
    },
  });

  const markAll = useMutation({
    mutationFn: markAllAlertsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
    },
  });

  const removeAlert = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
    },
  });

  const thesisCheck = useMutation({
    mutationFn: checkThesisBreaks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
    },
  });

  const unreadCount = alerts.filter((a: AlertData) => !a.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alerts</h2>
          <p className="text-muted-foreground">
            Monitor thesis breaks and strategy signals
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => thesisCheck.mutate()}
            disabled={thesisCheck.isPending}
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${
                thesisCheck.isPending ? "animate-spin" : ""
              }`}
            />
            Check Thesis Breaks
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {thesisCheck.data && (
        <Badge variant="default">{thesisCheck.data.message}</Badge>
      )}

      {/* Unread count banner */}
      {unreadCount > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center gap-3">
          <Bell className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alert Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <BellOff className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">No alerts yet</p>
              <p className="text-xs text-muted-foreground text-center max-w-md">
                Alerts appear when strategy thesis breaks are detected, or when
                a rebalance is due. Click &ldquo;Check Thesis Breaks&rdquo;
                above after creating and backtesting a strategy.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert: AlertData) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    !alert.is_read
                      ? "bg-accent/50 border-primary/20"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={
                          SEVERITY_VARIANT[alert.severity] || "secondary"
                        }
                        className="text-[10px]"
                      >
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {alert.alert_type.replace(/_/g, " ")}
                      </Badge>
                      {!alert.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.message}
                    </p>
                    {alert.triggered_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(alert.triggered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!alert.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => markRead.mutate(alert.id)}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAlert.mutate(alert.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
