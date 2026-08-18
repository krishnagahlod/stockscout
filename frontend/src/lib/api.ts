import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 300000,
});

// --- Health ---
export interface HealthResponse {
  status: string;
  db_connected: boolean;
  stock_count: number;
  price_count: number;
  last_sync: string | null;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get("/health");
  return data;
}

// --- Stocks ---
export interface Stock {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  market_cap_cr: number | null;
  is_nifty500: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getStocks(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  sector?: string;
}): Promise<PaginatedResponse<Stock>> {
  const { data } = await api.get("/stocks", { params });
  return data;
}

export async function getStock(symbol: string): Promise<Stock> {
  const { data } = await api.get(`/stocks/${symbol}`);
  return data;
}

export interface SearchStockResult {
  symbol: string;
  name: string;
  sector: string | null;
  market_cap_cr: number | null;
  is_nifty500: boolean;
  has_price_data: boolean;
}

export async function searchAllStocks(q: string, limit = 20): Promise<SearchStockResult[]> {
  const { data } = await api.get("/stocks/search-all", { params: { q, limit } });
  return data;
}

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
}

export async function getStockPrices(
  symbol: string,
  params?: { start?: string; end?: string; limit?: number }
): Promise<PriceData[]> {
  const { data } = await api.get(`/stocks/${symbol}/prices`, { params });
  return data;
}

export async function getSectors(): Promise<string[]> {
  const { data } = await api.get("/stocks/sectors");
  return data;
}

// --- Data Pipeline ---
export interface SyncStatus {
  total_stocks: number;
  total_prices: number;
  last_universe_sync: string | null;
  last_price_sync: string | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  records_affected: number;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const { data } = await api.get("/data/status");
  return data;
}

export async function syncUniverse(): Promise<SyncResult> {
  const { data } = await api.post("/data/sync-universe");
  return data;
}

export async function syncAll(): Promise<SyncResult> {
  const { data } = await api.post("/data/sync-all");
  return data;
}

export async function syncPrices(params?: {
  limit?: number;
  symbol?: string;
  start_date?: string;
}): Promise<SyncResult> {
  const { data } = await api.post("/data/sync-prices", null, { params });
  return data;
}

// --- Sync Progress ---
export interface SyncProgressData {
  is_running: boolean;
  current_stock: string;
  completed: number;
  total: number;
  total_records: number;
  errors: string[];
  last_message: string;
  progress_pct: number;
}

export async function getSyncProgress(): Promise<SyncProgressData> {
  const { data } = await api.get("/data/sync-progress");
  return data;
}

// --- Screener ---
export interface FilterCondition {
  metric: string;
  op: string;
  value: number | number[];
  unit?: string;
}

export interface CustomStock {
  symbol: string;
  name: string;
  weight?: number;
}

export interface StrategyRules {
  name: string;
  strategy_type?: string;
  universe?: string;
  filters: FilterCondition[];
  ranking?: { metric?: string; order?: string; weights?: Record<string, number> };
  selection?: { top_n: number };
  rebalance?: { frequency: string };
  position_sizing?: 'equal' | 'inverse_volatility' | 'risk_parity' | 'custom' | string;
  max_sector_weight?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  trailing_stop_atr_multiple?: number;
  max_stock_drawdown_pct?: number;
  warnings?: string[];
  stocks?: CustomStock[];
  [key: string]: any;
}


export interface StockScore {
  symbol: string;
  name: string;
  sector: string | null;
  composite_score: number | null;
  metric_values: Record<string, number | null>;
}

export interface ScoredUniverse {
  strategy_name: string;
  total_universe: number;
  filtered_count: number;
  stocks: StockScore[];
}

export interface MetricInfo {
  name: string;
  label: string;
  category: string;
  description: string;
}

export async function runScreener(rules: StrategyRules): Promise<ScoredUniverse> {
  const { data } = await api.post("/screener/run", rules);
  return data;
}

export async function getMetrics(): Promise<MetricInfo[]> {
  const { data } = await api.get("/screener/metrics");
  return data;
}

// --- Strategies ---
export interface StrategyData {
  id: number;
  name: string;
  description: string | null;
  user_prompt: string | null;
  rules_json: string;
  strategy_type: string;
  position_sizing: string | null;
  stop_loss_pct: number | null;
  take_profit_pct: number | null;
  universe: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export async function getStrategies(params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<PaginatedResponse<StrategyData>> {
  const { data } = await api.get("/strategies", { params });
  return data;
}

export async function getStrategy(id: number): Promise<StrategyData> {
  const { data } = await api.get(`/strategies/${id}`);
  return data;
}

export async function createStrategy(payload: {
  name: string;
  description?: string;
  user_prompt?: string;
  rules_json: string;
  strategy_type?: string;
  position_sizing?: string;
  universe?: string;
}): Promise<StrategyData> {
  const { data } = await api.post("/strategies", payload);
  return data;
}

export async function updateStrategy(
  id: number,
  payload: { name?: string; description?: string; rules_json?: string; strategy_type?: string; position_sizing?: string; status?: string }
): Promise<StrategyData> {
  const { data } = await api.put(`/strategies/${id}`, payload);
  return data;
}

export async function deleteStrategy(id: number): Promise<void> {
  await api.delete(`/strategies/${id}`);
}

// --- Features ---
export async function recomputeTechnical(limit?: number): Promise<SyncResult> {
  const { data } = await api.post("/features/recompute-technical", null, { params: { limit } });
  return data;
}

export async function recomputeFundamentals(limit?: number): Promise<SyncResult> {
  const { data } = await api.post("/features/recompute-fundamentals", null, { params: { limit } });
  return data;
}

// --- Backtest ---
export interface BacktestRequest {
  strategy_id: number;
  start_date?: string;
  end_date?: string;
  initial_capital?: number;
  rebalance_frequency?: string;
  tx_cost_bps?: number;
  slippage_bps?: number;
  benchmark_symbol?: string;
  stop_loss_pct?: number;
  take_profit_pct?: number;
}

export interface BacktestMetrics {
  cagr: number | null;
  total_return: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  calmar_ratio: number | null;
  max_drawdown: number | null;
  max_drawdown_duration_days: number | null;
  volatility: number | null;
  win_rate: number | null;
  avg_gain: number | null;
  avg_loss: number | null;
  total_trades: number;
  benchmark_cagr: number | null;
  benchmark_sharpe: number | null;
  benchmark_max_dd: number | null;
  alpha: number | null;
}

export interface EquityCurvePoint {
  date: string;
  portfolio_value: number;
  benchmark_value: number | null;
  drawdown: number;
}

export interface TradeRecord {
  date: string;
  action: string;
  symbol: string;
  name: string;
  shares: number;
  price: number;
  value: number;
  reason: string;
  pnl_pct?: number | null;
  tax_paid?: number | null;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return_pct: number;
}

export interface HoldingSnapshot {
  symbol: string;
  name: string;
  shares: number;
  weight: number;
  avg_cost: number;
  current_price: number;
  pnl_pct: number;
}

export interface BacktestResponse {
  id: number;
  strategy_id: number;
  strategy_name: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_value: number;
  total_taxes_paid: number;
  metrics: BacktestMetrics;
  equity_curve: EquityCurvePoint[];
  trades: TradeRecord[];
  monthly_returns: MonthlyReturn[];
  holdings: HoldingSnapshot[];
  created_at: string | null;
}

export interface Alert {
  id: number;
  strategy_id: number | null;
  stock_id: number | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  is_read: boolean;
  triggered_at: string | null;
}

// ----------------------------------------------------
// Alerts endpoints
// ----------------------------------------------------

export async function fetchAlerts(strategyId?: number, isRead?: boolean): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (strategyId !== undefined) params.append("strategy_id", strategyId.toString());
  if (isRead !== undefined) params.append("is_read", isRead.toString());
  const { data } = await api.get("/alerts", { params });
  return data;
}

export async function markAlertRead(alertId: number): Promise<{ message: string }> {
  const { data } = await api.put(`/alerts/${alertId}/read`);
  return data;
}

import { createClient } from "@/utils/supabase/client";

export async function runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await api.post("/backtest/run", { ...request, user_id: user?.id });
  return data;
}

export async function getBacktestResult(id: number): Promise<BacktestResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await api.get(`/backtest/results/${id}`, { params: { user_id: user?.id } });
  return data;
}

export async function getBacktestResults(params?: {
  strategy_id?: number;
  limit?: number;
}): Promise<BacktestResponse[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await api.get("/backtest/results", { params: { ...params, user_id: user?.id } });
  return data;
}

// --- LLM ---
export interface LLMStatus {
  ollama_running: boolean;
  model?: string;
  model_available?: boolean;
  available_models?: string[];
  error?: string;
}

export interface ParsedStrategy {
  rules: StrategyRules;
  rules_json: string;
}

export interface RiskFactor {
  factor: string;
  severity: string;
  description: string;
}

export interface InvestmentThesis {
  summary: string;
  key_points: string[];
  risks: RiskFactor[];
  recommendation: string;
}

export interface StockExplanationData {
  symbol: string;
  reasons: string[];
  strengths: string[];
  concerns: string[];
  overall: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  role: "assistant";
  content: string;
  strategy_rules?: StrategyRules;
  partial_rules?: StrategyRules;
  options?: string[];
}

export interface FilterExplanation {
  metric: string;
  op: string;
  value: number | number[];
  explanation: string;
}

export interface ExplainRulesResponse {
  strategy_summary: string;
  filter_explanations: FilterExplanation[];
  ranking_explanation: string;
  suitability: string;
}

export interface QuickPreviewStock {
  symbol: string;
  name: string;
  sector: string | null;
}

export interface QuickPreviewResponse {
  match_count: number;
  top_stocks: QuickPreviewStock[];
  total_universe: number;
}

export async function strategyChat(
  messages: ChatMessage[],
  finalize: boolean = false,
  portfolioContext?: string
): Promise<ChatResponse> {
  const { data } = await api.post("/llm/chat", { 
    messages, 
    finalize,
    portfolio_context: portfolioContext
  });
  return data;
}

export async function getLLMStatus(): Promise<LLMStatus> {
  const { data } = await api.get("/llm/status");
  return data;
}

export async function parseStrategy(prompt: string): Promise<ParsedStrategy> {
  const { data } = await api.post("/llm/parse-strategy", { prompt });
  return data;
}

export async function generateThesis(strategyId: number): Promise<InvestmentThesis> {
  const { data } = await api.post("/llm/generate-thesis", { strategy_id: strategyId });
  return data;
}

export async function generateThesisFromRules(rulesJson: string): Promise<InvestmentThesis> {
  const { data } = await api.post("/llm/generate-thesis", { rules_json: rulesJson });
  return data;
}

export async function explainRules(rules: StrategyRules): Promise<ExplainRulesResponse> {
  const { data } = await api.post("/llm/explain-rules", { rules });
  return data;
}

export async function quickPreview(rules: StrategyRules): Promise<QuickPreviewResponse> {
  const { data } = await api.post("/llm/quick-preview", rules);
  return data;
}

export async function explainStock(
  symbol: string,
  strategyId?: number
): Promise<StockExplanationData> {
  const { data } = await api.post("/llm/explain-stock", {
    symbol,
    strategy_id: strategyId,
  });
  return data;
}

// --- Portfolio ---
export interface AllocationEntry {
  symbol: string;
  name: string;
  weight: number;
  shares: number;
  price: number;
  value: number;
}

export interface PortfolioOptResult {
  id: number;
  strategy_id: number;
  strategy_name: string;
  method: string;
  capital: number;
  invested: number;
  leftover_cash: number;
  allocations: AllocationEntry[];
}

export interface RegimeData {
  regime: string;
  nifty_close?: number;
  sma_200?: number;
  pct_vs_sma?: number;
  reason: string;
  date?: string;
}

export async function optimizePortfolio(
  strategyId: number,
  method: string,
  capital: number,
): Promise<PortfolioOptResult> {
  const { data } = await api.post("/portfolio/optimize", null, {
    params: { strategy_id: strategyId, method, capital },
  });
  return data;
}

export async function getRegime(): Promise<RegimeData> {
  const { data } = await api.get("/portfolio/regime");
  return data;
}

// --- Scheduler ---
export interface SchedulerStatus {
  running: boolean;
  jobs: { id: string; name: string; next_run: string | null; trigger: string }[];
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const { data } = await api.get("/scheduler/status");
  return data;
}

export async function getSchedulerLogs(): Promise<unknown[]> {
  const { data } = await api.get("/scheduler/logs");
  return data;
}

export async function triggerJob(jobName: string): Promise<{ message: string }> {
  const { data } = await api.post(`/scheduler/trigger/${jobName}`);
  return data;
}

// --- Alerts ---
export interface AlertData {
  id: number;
  strategy_id: number | null;
  stock_id: number | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  triggered_at: string | null;
}

export async function getAlerts(params?: {
  strategy_id?: number;
  is_read?: boolean;
  limit?: number;
}): Promise<AlertData[]> {
  const { data } = await api.get("/alerts", { params });
  return data;
}

export async function getUnreadCount(): Promise<{ unread_count: number }> {
  const { data } = await api.get("/alerts/unread-count");
  return data;
}



export async function markAllAlertsRead(): Promise<void> {
  await api.put("/alerts", { action: "mark_all_read" });
}

export async function deleteAlert(id: number): Promise<void> {
  await api.delete(`/alerts/${id}`);
}

export async function checkThesisBreaks(): Promise<{ message: string }> {
  const { data } = await api.post("/alerts/check-thesis-breaks");
  return data;
}

// --- Dashboard ---
export interface DashboardSummary {
  stock_count: number;
  price_count: number;
  strategy_count: number;
  backtest_count: number;
  unread_alerts: number;
  technical_features_count: number;
  fundamental_count: number;
  stocks_with_prices: number;
  stocks_with_technicals: number;
  stocks_with_fundamentals: number;
  latest_backtest: {
    id: number;
    strategy_name: string;
    cagr: number | null;
    sharpe: number | null;
    max_dd: number | null;
    run_date: string | null;
  } | null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get("/dashboard/summary");
  return data;
}

// --- Macro Context & Playbook ---
export interface SectorMomentum {
  sector: string;
  return_30d: number;
  momentum_rank: number;
}

export interface MacroContext {
  regime: string;
  vix: number;
  breadth_ratio: number;
  macro_summary: string;
  top_sectors: SectorMomentum[];
  updated_at: string;
}

export interface ProfitTarget {
  level: string;
  price: number;
  gain_pct: number;
  exit_pct: number;
  method: string;
  rationale: string;
}

export interface TaxImpact {
  holding_period: string;
  tax_rate_pct: number;
  gross_gain_pct: number;
  tax_pct: number;
  net_gain_pct: number;
  net_target_price: number;
}


export interface StockPlaybookGuidance {
  symbol: string;
  name: string;
  sector?: string;
  current_price: number;
  entry_zone_low: number;
  entry_zone_high: number;
  initial_stop_loss: number;
  stop_distance_pct: number;
  take_profit_target: number;
  trailing_stop_rule: string;
  technical_signal_status: 'BULLISH_ENTRY' | 'HOLD_TREND' | 'WAIT_PULLBACK' | 'NEUTRAL' | string;
  entry_rationale: string;
  stop_loss_rationale: string;
  key_metrics_to_watch: string[];
  news_catalysts: string;
  regime_behavior: string;
  profit_targets: ProfitTarget[];
  tax_impact_short_term: TaxImpact[];
  tax_impact_long_term: TaxImpact[];
  risk_reward_ratio: number;
  breakeven_after_tax_pct: number;
  target_reasoning_summary: string;
  stop_loss_methodology: string;
}

export interface WatchlistCandidate {
  symbol: string;
  name: string;
  sector?: string;
  current_price: number;
  reason_near_miss: string;
}

export interface StrategyPlaybook {
  strategy_id?: number;
  strategy_name: string;
  generated_at: string;
  macro_context?: MacroContext;
  market_outlook: string;
  rebalance_schedule_guidance: string;
  overall_risk_budget: string;
  sector_allocation_rationale: string;
  stock_guidance: StockPlaybookGuidance[];
  watchlist: WatchlistCandidate[];
}

export async function getLiveMacroContext(): Promise<MacroContext> {
  const { data } = await api.get("/llm/macro-context");
  return data;
}

export async function generatePlaybook(payload: { strategy_id?: number; rules?: StrategyRules }): Promise<StrategyPlaybook> {
  const { data } = await api.post("/playbook/generate", payload);
  return data;
}

export async function getStrategyPlaybook(strategyId: number): Promise<StrategyPlaybook> {
  const { data } = await api.get(`/playbook/strategy/${strategyId}`);
  return data;
}

export interface HoldingDrift {
  symbol: string;
  name: string;
  sector?: string;
  status: 'ALIGNED' | 'AT_RISK' | 'DRIFTED' | 'STOP_LOSS_BREACHED' | 'TAKE_PROFIT_REACHED' | string;
  current_price: number;
  stop_loss_price?: number;
  take_profit_price?: number;
  reasons: string[];
}

export interface RegimeDriftWarning {
  current_regime: string;
  severity: 'low' | 'medium' | 'high' | string;
  recommended_action: string;
}

export interface StrategyDriftReport {
  strategy_id: number;
  strategy_name: string;
  checked_at: string;
  health_score: number;
  health_status: 'HEALTHY' | 'NEEDS_REBALANCE' | 'CRITICAL_INTERVENTION' | string;
  regime_warning?: RegimeDriftWarning;
  holdings_drift: HoldingDrift[];
  summary_commentary: string;
  action_required: boolean;
}

export async function getStrategyDriftReport(strategyId: number, sendNotifications = false): Promise<StrategyDriftReport> {
  const { data } = await api.get(`/monitor/strategy/${strategyId}/drift`, { params: { send_notifications: sendNotifications } });
  return data;
}

export async function runBatchMonitoring(): Promise<StrategyDriftReport[]> {
  const { data } = await api.post("/monitor/run-all");
  return data;
}

export interface RebalanceTradeOrder {
  symbol: string;
  name: string;
  sector?: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'TRIM' | 'ADD' | string;
  current_shares: number;
  target_shares: number;
  shares_difference: number;
  estimated_price: number;
  estimated_order_value: number;
  target_weight_pct: number;
  execution_guidance: string;
}

export interface SectorAttribution {
  sector: string;
  portfolio_weight_pct: number;
  benchmark_weight_pct: number;
  relative_weight_pct: number;
  estimated_sector_return_pct: number;
  contribution_to_alpha_pct: number;
  commentary: string;
}

export interface FactorAttribution {
  factor_name: string;
  score_index: number;
  contribution_pct: number;
  status: 'DOMINANT DRIVER' | 'STABLE' | 'DETRACTING' | string;
  description: string;
}

export interface RebalanceExecutionPlan {
  strategy_id: number;
  strategy_name: string;
  generated_at: string;
  portfolio_capital: number;
  position_sizing_method: string;
  estimated_turnover_pct: number;
  estimated_tx_cost_inr: number;
  orders: RebalanceTradeOrder[];
  sector_attribution: SectorAttribution[];
  factor_attribution: FactorAttribution[];
  executive_summary: string;
}

export async function getRebalancePlan(strategyId: number, capital = 500000.0): Promise<RebalanceExecutionPlan> {
  const { data } = await api.get(`/rebalance/strategy/${strategyId}/plan`, { params: { capital } });
  return data;
}

export async function notifyRebalancePlan(strategyId: number, capital = 500000.0): Promise<{ success: boolean; delivery_status: any }> {
  const { data } = await api.post(`/rebalance/strategy/${strategyId}/notify`, null, { params: { capital } });
  return data;
}

// ----------------------------------------------------
// Portfolio Intelligence & Rebalance Endpoints
// ----------------------------------------------------

export async function getPortfolioPlaybook(userId: string): Promise<any> {
  const { data } = await api.get("/portfolio/playbook", { params: { user_id: userId } });
  return data.report;
}

export async function getPortfolioDrift(userId: string): Promise<any> {
  const { data } = await api.get("/portfolio/drift", { params: { user_id: userId } });
  return data.report;
}

export async function getPortfolioRebalanceSheet(params: {
  userId: string;
  sizingMethod?: string;
  capitalMode?: string;
  additionalCapital?: number;
}): Promise<RebalanceExecutionPlan> {
  const { data } = await api.post("/portfolio/rebalance-sheet", {
    user_id: params.userId,
    sizing_method: params.sizingMethod || "risk_parity",
    capital_mode: params.capitalMode || "existing",
    additional_capital: params.additionalCapital ?? 0.0,
  });
  return data.plan;
}

export async function notifyPortfolioRebalance(params: {
  userId: string;
  email?: string;
  telegramChatId?: string;
  capitalMode?: string;
  additionalCapital?: number;
}): Promise<{ success: boolean; dispatched?: any }> {
  const { data } = await api.post("/portfolio/notify-rebalance", {
    user_id: params.userId,
    email: params.email,
    telegram_chat_id: params.telegramChatId,
    capital_mode: params.capitalMode || "existing",
    additional_capital: params.additionalCapital ?? 0.0,
  });
  return data;
}

// ----------------------------------------------------
// Broker Integration Endpoints
// ----------------------------------------------------
export interface BrokerCredentialsInput {
  broker_name: string;
  account_label: string;
  account_purpose: string;
  credentials: Record<string, string>;
}

export interface BrokerAccountData {
  id: number;
  broker_name: string;
  account_label: string;
  account_purpose: string;
  last_synced_at: string | null;
  sync_status: string;
  holdings_count: number;
  total_current_value: number;
}

export async function connectBroker(payload: BrokerCredentialsInput): Promise<{ status: string; message: string; account_id: number }> {
  const { data } = await api.post("/brokers/connect", payload);
  return data;
}

export async function getBrokerAccounts(): Promise<BrokerAccountData[]> {
  const { data } = await api.get("/brokers/accounts");
  return data;
}

export async function syncBrokerAccount(accountId: number): Promise<{ status: string; message: string }> {
  const { data } = await api.post(`/brokers/${accountId}/sync`);
  return data;
}

export default api;
