"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Cpu,
  Play,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import {
  getSchedulerStatus,
  getSchedulerLogs,
  triggerJob,
  getLLMStatus,
  getDashboardSummary,
} from "@/lib/api";

export default function SettingsPage() {
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    refetchInterval: 10000,
  });

  const { data: scheduler } = useQuery({
    queryKey: ["scheduler-status"],
    queryFn: getSchedulerStatus,
    refetchInterval: 15000,
  });

  const { data: logs } = useQuery({
    queryKey: ["scheduler-logs"],
    queryFn: getSchedulerLogs,
  });

  const { data: llmStatus } = useQuery({
    queryKey: ["llm-status"],
    queryFn: getLLMStatus,
    refetchInterval: 30000,
  });

  const trigger = useMutation({
    mutationFn: (jobName: string) => triggerJob(jobName),
  });

  const stockCount = summary?.stock_count ?? 0;
  const withPrices = summary?.stocks_with_prices ?? 0;
  const withTechnicals = summary?.stocks_with_technicals ?? 0;
  const withFundamentals = summary?.stocks_with_fundamentals ?? 0;

  const coverageItems = [
    {
      label: "Universe",
      count: stockCount,
      total: 500,
      color: "bg-blue-500",
      synced: stockCount > 0,
    },
    {
      label: "Prices",
      count: withPrices,
      total: stockCount || 500,
      color: "bg-green-500",
      synced: withPrices > 0,
    },
    {
      label: "Technicals",
      count: withTechnicals,
      total: stockCount || 500,
      color: "bg-purple-500",
      synced: withTechnicals > 0,
    },
    {
      label: "Fundamentals",
      count: withFundamentals,
      total: stockCount || 500,
      color: "bg-amber-500",
      synced: withFundamentals > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data & Settings</h2>
        <p className="text-muted-foreground">
          View data coverage, automation status, and AI engine settings
        </p>
      </div>

      {/* Data Coverage Overview */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {coverageItems.map((item) => {
          const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
          return (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  {item.synced ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                <p className="text-xl font-bold">
                  {item.count}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{item.total}
                  </span>
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className={`${item.color} h-1.5 rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {pct}% coverage
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>



      <div className="grid gap-4 lg:grid-cols-2">
        {/* LLM Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              AI Engine (Cerebras)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {llmStatus ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      llmStatus.ollama_running ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm">
                    {llmStatus.ollama_running ? "Connected" : "Not Configured"}
                  </span>
                </div>
                {llmStatus.error && (
                  <p className="text-sm text-destructive">{llmStatus.error}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Scheduler */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduler
              <Badge
                variant={scheduler?.running ? "default" : "secondary"}
                className="ml-auto text-[10px]"
              >
                {scheduler?.running ? "Running" : "Stopped"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduler?.jobs && scheduler.jobs.length > 0 ? (
              <div className="space-y-2">
                {scheduler.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between text-sm rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {job.id.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.trigger}
                        {job.next_run && (
                          <>
                            {" · Next: "}
                            {new Date(job.next_run).toLocaleString()}
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => trigger.mutate(job.id)}
                      disabled={trigger.isPending}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No scheduled jobs configured.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Logs */}
      {logs && (logs as unknown[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Recent Job Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    logs as {
                      id: number;
                      job_name: string;
                      status: string;
                      message: string;
                      completed_at: string | null;
                      started_at: string | null;
                    }[]
                  ).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {log.job_name.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "completed"
                              ? "default"
                              : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-60 truncate">
                        {log.message || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.completed_at || log.started_at || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
