"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Sparkles,
  Save,
  Send,
  Edit3,
  CheckCircle2,
  User,
  Bot,
  Loader2,
  Rocket,
  RefreshCw,
  AlertCircle,
  Database,
  Activity,
  Sliders,
} from "lucide-react";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useLLMStatus,
  useExplainRules,
  useGenerateThesisFromRules,
  useGeneratePlaybook,
} from "@/hooks/use-llm";
import { useCreateStrategy, useStrategy, useUpdateStrategy } from "@/hooks/use-strategies";
import { useRunScreener } from "@/hooks/use-screener";
import type {
  StrategyRules,
  ChatMessage,
  ChatResponse,
  ExplainRulesResponse,
  InvestmentThesis,
  StrategyPlaybook,
  BrokerAccountData,
} from "@/lib/api";
import { strategyChat, getDashboardSummary, getBrokerAccounts } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ResultsTable } from "@/components/screener/results-table";
import {
  GoalSelector,
  type GoalId,
} from "@/components/strategy/goal-selector";
import { ProgressSteps } from "@/components/strategy/progress-steps";
import { StrategyPreviewCard } from "@/components/strategy/strategy-preview-card";
import { PlainEnglishRules } from "@/components/strategy/plain-english-rules";
import { ThesisPanel } from "@/components/strategy/thesis-panel";
import { StockExplainCard } from "@/components/strategy/stock-explain-card";
import { InlineBacktest } from "@/components/strategy/inline-backtest";
import { PlaybookView } from "@/components/strategy/playbook-view";
import { TemplateLibrary } from "@/components/strategy/template-library";
import { VisualComposer } from "@/components/strategy/visual-composer";
import { CustomPortfolioForm } from "@/components/strategy/custom-portfolio-form";

const GOAL_PROMPTS: Record<GoalId, string> = {

  steady_income:
    "[GOAL: steady_income] I want to invest in stocks that pay me regular income through dividends. I want reliable companies that consistently share their profits with investors.",
  long_term_growth:
    "[GOAL: long_term_growth] I want stocks that will grow my money significantly over the next 5-10 years. I'm okay with some ups and downs along the way if the long-term trend is upward.",
  low_risk:
    "[GOAL: low_risk] I want very safe, stable stocks with minimal chance of losing money. Capital preservation is my top priority — I'd rather earn less than risk losing my investment.",
  undervalued:
    "[GOAL: undervalued] I want to find good quality companies that are currently selling below what they're actually worth — bargain stocks that the market hasn't recognized yet.",
  momentum:
    "[GOAL: momentum] I want to invest in stocks that have been performing well recently and are trending upward. I believe winners tend to keep winning.",
  unsure:
    "[GOAL: unsure] I'm new to investing and not sure where to start. Help me figure out what kind of stocks would be right for me based on my situation.",
};

const GOAL_LABELS: Record<GoalId, string> = {
  steady_income: "I want stocks that pay me steady income from dividends",
  long_term_growth: "I want to grow my money over the long term",
  low_risk: "I want safe, stable investments with low risk",
  undervalued: "I want to find good companies that are undervalued",
  momentum: "I want stocks that are trending up with strong momentum",
  unsure: "I'm new to investing — help me figure out what's right for me",
};

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  strategy_rules?: StrategyRules;
  partial_rules?: StrategyRules;
  options?: string[];
}

export default function CreateStrategyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateStrategyContent />
    </Suspense>
  );
}

function CreateStrategyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCustomType = searchParams.get("type") === "custom";
  const editParam = searchParams.get("edit");
  const editId = editParam ? parseInt(editParam, 10) : null;
  const { data: editStrategy, isLoading: isEditLoading } = useStrategy(editId || 0);
  
  const llmStatus = useLLMStatus();
  const createStrategy = useCreateStrategy();
  const updateStrategy = useUpdateStrategy();
  const screener = useRunScreener();
  const explainRulesMutation = useExplainRules();
  const thesisMutation = useGenerateThesisFromRules();
  const playbookMutation = useGeneratePlaybook();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [strategyRules, setStrategyRules] = useState<StrategyRules | null>(
    null
  );
  const [partialRules, setPartialRules] = useState<StrategyRules | null>(null);
  const [strategyName, setStrategyName] = useState("");
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [rulesJson, setRulesJson] = useState("");
  const [savedStrategyId, setSavedStrategyId] = useState<number | null>(null);
  const [rulesExplanation, setRulesExplanation] =
    useState<ExplainRulesResponse | null>(null);
  const [thesis, setThesis] = useState<InvestmentThesis | null>(null);
  const [playbook, setPlaybook] = useState<StrategyPlaybook | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("none");

  const { data: brokerAccounts, isLoading: isLoadingPortfolios } = useQuery({
    queryKey: ["broker-accounts"],
    queryFn: getBrokerAccounts,
  });

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (isCustomType) {
    if (editId && isEditLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    
    let initialStocks: any[] = [];
    if (editStrategy?.rules_json) {
      if (typeof editStrategy.rules_json === 'string') {
        try {
          const parsed = JSON.parse(editStrategy.rules_json);
          initialStocks = parsed.stocks || [];
        } catch (e) {}
      } else if (typeof editStrategy.rules_json === 'object') {
        initialStocks = (editStrategy.rules_json as any).stocks || [];
      }
    }

    return (
      <div className="flex flex-col h-screen max-h-screen bg-slate-50/50">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link href="/strategies">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Custom Portfolio</h2>
              <p className="text-sm text-muted-foreground">Manual stock selection</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <CustomPortfolioForm
            initialName={editStrategy?.name}
            initialPositionSizing={editStrategy?.position_sizing ?? undefined}
            initialStocks={initialStocks}
            onSave={(data) => {
              const payload = {
                name: data.name,
                rules_json: JSON.stringify({
                  name: data.name,
                  strategy_type: "custom",
                  universe: "custom",
                  stocks: data.stocks,
                  position_sizing: data.position_sizing,
                  filters: [],
                  rebalance: { frequency: "quarterly" }
                }),
                strategy_type: "custom",
                position_sizing: data.position_sizing,
                universe: "custom"
              };
              if (editId) {
                updateStrategy.mutate({ id: editId, ...payload }, {
                  onSuccess: () => router.push(`/strategies/${editId}`)
                });
              } else {
                createStrategy.mutate(payload, {
                  onSuccess: () => router.push("/strategies")
                });
              }
            }}
            onCancel={() => editId ? router.push(`/strategies/${editId}`) : router.push("/strategies")}
            isSaving={createStrategy.isPending || updateStrategy.isPending}
          />
        </div>
      </div>
    );
  }

  const aiOk =
    llmStatus.data?.ollama_running && llmStatus.data?.model_available;

  const currentStep = strategyRules
    ? savedStrategyId
      ? 3
      : 2
    : messages.length > 0
    ? 1
    : 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (currentStep >= 1) inputRef.current?.focus();
  }, [currentStep]);

  const getPortfolioContextStr = () => {
    if (selectedPortfolioId === "none") return undefined;
    
    if (selectedPortfolioId === "csv") {
      return `Portfolio Name: Manual / CSV Imported Portfolio\nContext: User has uploaded stock holdings via CSV. Prioritize sector balance and diversification relative to existing holdings.`;
    }

    if (selectedPortfolioId === "all") {
      const cap = (dashboard as any)?.portfolio_capital ? `Rs. ${(dashboard as any).portfolio_capital}` : "Existing Capital";
      const count = (dashboard as any)?.total_holdings ? `${(dashboard as any).total_holdings} stocks` : "Existing positions";
      return `Portfolio Name: Unified Portfolio (All Accounts & CSV)\nTotal Capital: ${cap}\nHoldings: ${count}`;
    }

    if (!brokerAccounts) return undefined;
    const acc = brokerAccounts.find(a => a.id.toString() === selectedPortfolioId);
    if (!acc) return undefined;
    
    return `Portfolio Name: ${acc.broker_name} (${acc.account_label})\nTotal Value: Rs. ${acc.total_current_value}\nHoldings Count: ${acc.holdings_count}`;
  };

  const runFinalization = async (msgs: DisplayMessage[]) => {
    setIsLoading(true);
    setHasNewMessages(false);
    try {
      const apiMessages: ChatMessage[] = msgs.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response: ChatResponse = await strategyChat(apiMessages, true, getPortfolioContextStr());

      if (response.strategy_rules) {
        setStrategyRules(response.strategy_rules);
        setShowSidePanel(true);
        setRulesJson(JSON.stringify(response.strategy_rules, null, 2));
        setStrategyName(response.strategy_rules.name || "My Strategy");
        setSavedStrategyId(null); // Reset saved state for rebuild

        explainRulesMutation.mutate(response.strategy_rules, {
          onSuccess: (data) => setRulesExplanation(data),
        });
        thesisMutation.mutate(JSON.stringify(response.strategy_rules), {
          onSuccess: (data) => setThesis(data),
        });
        playbookMutation.mutate(
          { rules: response.strategy_rules },
          { onSuccess: (data) => setPlaybook(data) }
        );
        screener.mutate(response.strategy_rules);
      }


      const assistantMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.content,
        strategy_rules: response.strategy_rules,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to build strategy. ${
          err instanceof Error ? err.message : "Please try again."
        }`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(
    async (text: string, displayText?: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayText || text.trim(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);
      if (strategyRules) setHasNewMessages(true);

      try {
        const apiMessages: ChatMessage[] = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response: ChatResponse = await strategyChat(apiMessages, false, getPortfolioContextStr());

        const assistantMsg: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.content,
          partial_rules: response.partial_rules,
          options: response.options,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.partial_rules) {
          setPartialRules(response.partial_rules as StrategyRules);
        }
      } catch (err) {
        const errorMsg: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, something went wrong. ${
            err instanceof Error ? err.message : "Please try again."
          }`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading, strategyRules]
  );

  const handleGoalSelect = (goalId: GoalId) => {
    sendMessage(GOAL_PROMPTS[goalId], GOAL_LABELS[goalId]);
  };

  const handleFinalize = () => runFinalization(messages);

  const handleRebuild = () => runFinalization(messages);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSave = () => {
    if (!strategyRules) return;
    const chatSummary = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" → ");
    createStrategy.mutate(
      {
        name: strategyName || strategyRules.name,
        description: `AI chat: ${chatSummary.slice(0, 200)}`,
        user_prompt: chatSummary,
        rules_json: JSON.stringify(strategyRules),
      },
      {
        onSuccess: (data) => setSavedStrategyId(data.id),
      }
    );
  };

  const handleApplyEditedRules = () => {
    try {
      const parsed = JSON.parse(rulesJson);
      setStrategyRules(parsed);
      setIsEditingRules(false);
      setRulesExplanation(null);
      setThesis(null);
      setPlaybook(null);
      explainRulesMutation.mutate(parsed, {
        onSuccess: (data) => setRulesExplanation(data),
      });
      thesisMutation.mutate(JSON.stringify(parsed), {
        onSuccess: (data) => setThesis(data),
      });
      playbookMutation.mutate(
        { rules: parsed },
        { onSuccess: (data) => setPlaybook(data) }
      );
      screener.mutate(parsed);

    } catch {
      // invalid JSON
    }
  };

  // Show "Build" in header when ready, or "Rebuild" if strategy exists and user chatted more
  const showBuildButton =
    (messages.length >= 2 || partialRules) && !strategyRules;
  const showRebuildButton = strategyRules && hasNewMessages && !isLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b shrink-0">
        <Link href="/strategies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 flex items-center gap-4">
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Strategy Builder
          </h2>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm font-medium text-slate-500">Portfolio:</span>
            <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
              <SelectTrigger className="w-[200px] h-8 text-xs bg-white border-slate-200 shadow-sm">
                <SelectValue placeholder="Select Portfolio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Build from scratch)</SelectItem>
                <SelectItem value="csv">Manual / CSV Imported Portfolio</SelectItem>
                <SelectItem value="all">All Holdings (Unified)</SelectItem>
                {brokerAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.account_label} ({acc.broker_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ProgressSteps currentStep={currentStep} />
      </div>

      {/* LLM Status Warning */}
      {llmStatus.data && !aiOk && (
        <div className="mx-6 mt-3 rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-2">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            AI not configured
            {llmStatus.data.error
              ? `: ${llmStatus.data.error}`
              : ". Add your Groq API key to backend/.env"}
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Chat Panel */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`flex flex-col h-full bg-transparent ${
            showSidePanel ? "w-1/2 border-r border-slate-200/60 shadow-xl z-10 bg-white" : "w-full max-w-4xl mx-auto"
          }`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {messages.length === 0 && (
              <div className="space-y-8">
                <GoalSelector
                  onSelect={handleGoalSelect}
                  disabled={isLoading || !aiOk}
                />

                <TemplateLibrary 
                  onSelect={(template) => {
                    setStrategyRules(template.rules);
                    setShowSidePanel(true);
                    setRulesJson(JSON.stringify(template.rules, null, 2));
                    setStrategyName(template.rules.name || "My Strategy");
                    setSavedStrategyId(null);
                    
                    explainRulesMutation.mutate(template.rules, {
                      onSuccess: (data) => setRulesExplanation(data),
                    });
                    thesisMutation.mutate(JSON.stringify(template.rules), {
                      onSuccess: (data) => setThesis(data),
                    });
                    playbookMutation.mutate(
                      { rules: template.rules },
                      { onSuccess: (data) => setPlaybook(data) }
                    );
                    screener.mutate(template.rules);
                    
                    const systemMsg: DisplayMessage = {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: `I've loaded the **${template.name}** template for you. You can review the rules on the right and make any changes, or just save it and build your portfolio!`,
                      strategy_rules: template.rules
                    };
                    setMessages([systemMsg]);
                  }}
                />
              </div>
            )}

            {messages.map((msg) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
              >
                <div
                  className={`flex gap-4 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-10 h-10 rounded-2xl bg-indigo-50 shadow-sm border border-indigo-100 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-3xl px-6 py-4 text-base leading-relaxed shadow-sm border ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white border-indigo-500 rounded-br-sm shadow-indigo-200"
                        : "bg-white text-slate-800 border-slate-200/60 rounded-bl-sm"
                    }`}
                  >
                    <div className={`prose prose-sm md:prose-base max-w-none ${msg.role === "user" ? "text-white prose-headings:text-white prose-strong:text-white" : "text-slate-800"}`}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          strong: ({node, ...props}) => <strong className={`font-bold ${msg.role === "user" ? "text-white" : "text-indigo-900"}`} {...props} />,
                          p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1.5" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1.5" {...props} />,
                          li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                          h3: ({node, ...props}) => <h3 className={`font-display font-bold text-lg mt-5 mb-2 ${msg.role === "user" ? "text-white" : "text-slate-900"}`} {...props} />,
                          h4: ({node, ...props}) => <h4 className={`font-display font-bold text-md mt-4 mb-1 ${msg.role === "user" ? "text-white" : "text-slate-800"}`} {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.strategy_rules && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60">
                        <div className="flex flex-wrap gap-2">
                          {msg.strategy_rules.filters.map((f, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-1 rounded-lg"
                            >
                              {f.metric} {f.op} {String(f.value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.options && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Select an option to respond:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.options.map((opt, i) => {
                            const isCustom = opt.toLowerCase().includes("custom") || opt.toLowerCase().includes("type your own");
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (isCustom) {
                                    inputRef.current?.focus();
                                  } else {
                                    sendMessage(opt, opt);
                                  }
                                }}
                                disabled={isLoading || messages[messages.length - 1].id !== msg.id}
                                className={`text-left p-3 rounded-2xl border transition-all text-xs font-semibold flex items-start gap-2.5 shadow-2xs ${
                                  isCustom 
                                    ? "border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70" 
                                    : "border-slate-200/80 bg-slate-50 text-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-md"
                                } ${isLoading || messages[messages.length - 1].id !== msg.id ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                              >
                                <span className={`w-5 h-5 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0 ${isCustom ? "bg-indigo-200/60 text-indigo-800" : "bg-white text-slate-600 border border-slate-200"}`}>
                                  {isCustom ? "✏️" : String.fromCharCode(65 + i)}
                                </span>
                                <span className="leading-snug flex-1">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 w-10 h-10 rounded-2xl bg-slate-900 shadow-sm flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Inline Action Buttons on the Last Assistant Message */}
                {msg.role === "assistant" && messages.length >= 2 && messages[messages.length - 1].id === msg.id && (
                  <div className="ml-14 mt-4 flex flex-col items-start gap-4">
                    {!strategyRules && (
                      <>
                        {msg.partial_rules && (
                          <>
                            <StrategyPreviewCard rules={msg.partial_rules} />
                            <Button onClick={handleFinalize} disabled={isLoading} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all rounded-2xl h-12 px-6">
                              <Rocket className="mr-2 h-5 w-5" />
                              {isLoading ? "Building..." : "Build Strategy"}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {strategyRules && hasNewMessages && (
                      <Button onClick={handleRebuild} disabled={isLoading} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all rounded-2xl h-12 px-6">
                        <RefreshCw className="mr-2 h-5 w-5" />
                        {isLoading ? "Rebuilding..." : "Rebuild Strategy"}
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-2xl bg-indigo-50 shadow-sm border border-indigo-100 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl rounded-bl-sm px-6 py-4 shadow-sm flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium text-slate-500">Thinking...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 bg-white/80 backdrop-blur-xl shrink-0 border-t border-slate-200/60">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  messages.length === 0
                    ? "Or describe what you want in your own words..."
                    : strategyRules
                    ? "Tell me what to change — I'll rebuild the strategy..."
                    : "Reply to refine your strategy..."
                }
                disabled={isLoading || !aiOk}
                rows={1}
                className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 shadow-inner"
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading || !aiOk}
                className="rounded-2xl h-14 w-14 shrink-0 bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-3 text-center uppercase tracking-wider">
              {!strategyRules &&
                (messages.length >= 2 || partialRules) &&
                "Click 'Build My Strategy' when ready • "}
              {strategyRules &&
                hasNewMessages &&
                "Click 'Rebuild Strategy' to apply your changes • "}
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </motion.div>

        {/* Strategy Panel */}
        <AnimatePresence>
          {showSidePanel && strategyRules && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-1/2 overflow-y-auto p-6 space-y-6 bg-slate-50/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {/* Plain English Explanation */}
              <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 px-6 py-5">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    Your Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 bg-white">
                  <PlainEnglishRules
                    explanation={rulesExplanation}
                    isLoading={explainRulesMutation.isPending}
                  />
                  {!rulesExplanation && !explainRulesMutation.isPending && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {strategyRules.filters.map((f, i) => (
                          <Badge key={i} variant="secondary" className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
                            {f.metric} {f.op} {String(f.value)}
                          </Badge>
                        ))}
                      </div>
                      {strategyRules.ranking && (
                        <p className="text-sm font-medium text-slate-500">
                          {strategyRules.ranking.weights ? (
                            <>
                              Ranked by Composite Score (
                              <span className="text-slate-900">
                                {((strategyRules.ranking.weights as unknown) as any[]).map(w => `${w.weight * 100}% ${w.metric}`).join(", ")}
                              </span>
                              )
                            </>
                          ) : (
                            <>
                              Ranked by <span className="text-slate-900">{strategyRules.ranking.metric}</span> (
                              {strategyRules.ranking.order})
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  <VisualComposer 
                    initialRules={strategyRules}
                    onApply={(rules) => {
                      setStrategyRules(rules);
                      setRulesJson(JSON.stringify(rules, null, 2));
                      setRulesExplanation(null);
                      setThesis(null);
                      setPlaybook(null);
                      explainRulesMutation.mutate(rules, {
                        onSuccess: (data) => setRulesExplanation(data),
                      });
                      thesisMutation.mutate(JSON.stringify(rules), {
                        onSuccess: (data) => setThesis(data),
                      });
                      playbookMutation.mutate(
                        { rules },
                        { onSuccess: (data) => setPlaybook(data) }
                      );
                      screener.mutate(rules);
                    }}
                  />

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingRules(!isEditingRules);
                        if (!isEditingRules) {
                          setRulesJson(JSON.stringify(strategyRules, null, 2));
                        }
                      }}
                      className="h-9 text-xs rounded-xl font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      {isEditingRules ? "Cancel Edit" : "Edit Rules (JSON)"}
                    </Button>
                    {isEditingRules && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-3">
                        <textarea
                          value={rulesJson}
                          onChange={(e) => setRulesJson(e.target.value)}
                          className="w-full min-h-48 rounded-xl border border-slate-200 bg-slate-900 text-green-400 px-4 py-3 text-xs font-mono resize-y shadow-inner"
                        />
                        <Button size="default" onClick={handleApplyEditedRules} className="w-full rounded-xl bg-indigo-600 text-white">
                          Apply Changes
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Investment Thesis */}
              <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 px-6 py-5">
                  <CardTitle className="text-base font-display">AI Investment Thesis</CardTitle>
                </CardHeader>
                <CardContent className="p-6 bg-white">
                  <ThesisPanel
                    thesis={thesis}
                    isLoading={thesisMutation.isPending}
                  />
                  {thesisMutation.isError && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-4 rounded-xl">
                      Could not generate thesis. Try saving and running a backtest first.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Actionable Strategy Execution Playbook */}
              <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 px-6 py-5 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Actionable Quant Playbook & ATR Guidance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 bg-white">
                  <PlaybookView
                    playbook={playbook}
                    isLoading={playbookMutation.isPending}
                  />
                </CardContent>
              </Card>


              {/* Matching Stocks */}
              <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 px-6 py-5 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-display">
                    {screener.data
                      ? `${screener.data.filtered_count} Matching Stocks`
                      : screener.isPending
                      ? "Finding matching stocks..."
                      : "Matching Stocks"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 bg-white">
                  {screener.isPending && (
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-500 bg-slate-50 p-4 rounded-xl">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                      Screening universe...
                    </div>
                  )}

                  {/* Empty state with helpful diagnostics */}
                  {screener.data && screener.data.filtered_count === 0 && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
                          <div className="text-sm">
                            <p className="font-bold text-amber-800 text-base">
                              No stocks match these filters
                            </p>
                            <p className="text-amber-700 mt-2 leading-relaxed">
                              This usually happens when filters are too strict or
                              fundamental data hasn't been synced for enough
                              stocks. Try:
                            </p>
                            <ul className="mt-3 space-y-2 text-amber-700 font-medium">
                              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Tell the AI to use fewer or more relaxed filters</li>
                              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Use market_cap, trailing_pe, or momentum_12m</li>
                              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Sync more fundamental data from Settings</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
                        <Database className="h-4 w-4" />
                        Universe: {screener.data.total_universe} stocks
                      </div>
                    </div>
                  )}

                  {screener.data && screener.data.filtered_count > 0 && (
                    <div className="space-y-4">
                      <ResultsTable data={screener.data} />
                      {screener.data.stocks.length > 0 && (
                        <div className="border-t border-slate-100 pt-4 space-y-2 mt-4">
                          <p className="text-xs font-bold tracking-widest uppercase text-indigo-600 mb-3">
                            AI Analysis
                          </p>
                          {screener.data.stocks.map((stock) => (
                            <div
                              key={stock.symbol}
                              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                              <span className="text-sm font-bold text-slate-900">
                                {stock.symbol}{" "}
                                <span className="text-xs font-medium text-slate-400 ml-2">
                                  {stock.name}
                                </span>
                              </span>
                              <StockExplainCard symbol={stock.symbol} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {screener.isError && (
                    <p className="text-sm text-rose-600 bg-rose-50 p-4 rounded-xl">
                      Screening failed. Ensure data is synced.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Save & Backtest */}
              <Card className="rounded-[2rem] border-0 shadow-premium overflow-hidden bg-gradient-to-br from-indigo-50 to-white">
                <CardContent className="p-8 space-y-6">
                  {!savedStrategyId ? (
                    <>
                      <div>
                        <label className="text-sm font-bold text-slate-900 mb-2 block">
                          Strategy Name
                        </label>
                        <Input
                          value={strategyName}
                          onChange={(e) => setStrategyName(e.target.value)}
                          className="h-12 rounded-xl bg-white border-slate-200"
                        />
                      </div>
                      <Button
                        onClick={handleSave}
                        disabled={createStrategy.isPending}
                        className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 text-base"
                      >
                        <Save className="mr-2 h-5 w-5" />
                        {createStrategy.isPending ? "Saving..." : "Save Strategy"}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-center gap-2 text-base font-bold text-emerald-600 bg-emerald-50 py-3 rounded-xl border border-emerald-100">
                        <CheckCircle2 className="h-5 w-5" />
                        Strategy Saved Successfully!
                      </div>

                      {/* Quick Action Hub for 3 Phases */}
                      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 text-slate-900 rounded-3xl p-6 shadow-sm space-y-4 border border-indigo-100/80">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                          <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                          <h4 className="font-black text-sm tracking-wide text-slate-900 uppercase">STRATEGY INTELLIGENCE SUITE ACTIVE</h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          Your strategy now has full live macro monitoring, quantitative pre-flight guidance, and multi-channel rebalancing enabled.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          <Link href={`/strategies/${savedStrategyId}?tab=playbook`} className="w-full">
                            <Button variant="outline" className="w-full h-11 text-xs rounded-xl bg-white hover:bg-indigo-50/80 border-slate-200 hover:border-indigo-200 text-slate-800 font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs">
                              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span>AI Playbook & ATR</span>
                            </Button>
                          </Link>
                          <Link href={`/strategies/${savedStrategyId}?tab=monitor`} className="w-full">
                            <Button variant="outline" className="w-full h-11 text-xs rounded-xl bg-white hover:bg-rose-50/80 border-slate-200 hover:border-rose-200 text-slate-800 font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs">
                              <Activity className="h-4 w-4 text-rose-500 shrink-0" />
                              <span>Live Drift Monitor</span>
                            </Button>
                          </Link>
                          <Link href={`/strategies/${savedStrategyId}?tab=rebalance`} className="w-full">
                            <Button variant="outline" className="w-full h-11 text-xs rounded-xl bg-white hover:bg-emerald-50/80 border-slate-200 hover:border-emerald-200 text-slate-800 font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs">
                              <Sliders className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>Rebalance Sheet</span>
                            </Button>
                          </Link>
                        </div>
                      </div>


                      <InlineBacktest strategyId={savedStrategyId} />
                      <div className="flex gap-3 pt-2">
                        <Link
                          href={`/strategies/${savedStrategyId}`}
                          className="flex-1"
                        >
                          <Button
                            variant="outline"
                            className="w-full h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                          >
                            View Full Strategy
                          </Button>
                        </Link>
                        <Link href="/portfolio" className="flex-1">
                          <Button
                            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md"
                          >
                            Optimize Portfolio
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
