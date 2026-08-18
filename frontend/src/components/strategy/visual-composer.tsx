import { useState, useEffect } from "react";
import type { StrategyRules } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings2, Save } from "lucide-react";

interface VisualComposerProps {
  initialRules: StrategyRules;
  onApply: (rules: StrategyRules) => void;
}

export function VisualComposer({ initialRules, onApply }: VisualComposerProps) {
  const [rules, setRules] = useState<StrategyRules>(JSON.parse(JSON.stringify(initialRules)));
  
  useEffect(() => {
    setRules(JSON.parse(JSON.stringify(initialRules)));
  }, [initialRules]);

  const handleApply = () => {
    onApply(rules);
  };

  return (
    <div className="space-y-6 mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-4 h-4 text-slate-500" />
        <h4 className="text-sm font-semibold text-slate-700">Visual Composer</h4>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-slate-500">Position Sizing</Label>
          <Select 
            value={rules.position_sizing || "equal"} 
            onValueChange={(val) => setRules({...rules, position_sizing: val})}
          >
            <SelectTrigger className="h-8 text-xs w-full bg-white">
              <SelectValue placeholder="Select Sizing Strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equal">Equal Weight</SelectItem>
              <SelectItem value="inverse_volatility">Inverse Volatility</SelectItem>
              <SelectItem value="risk_parity">Risk Parity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex flex-col gap-1">
          <Label className="text-xs text-slate-500">Selection Size (Top N)</Label>
          <div className="flex items-center gap-3">
            <Slider 
              value={[rules.selection?.top_n || 20]} 
              min={5} max={100} step={5}
              onValueChange={([v]) => setRules({...rules, selection: { ...rules.selection, top_n: v }})}
              className="flex-1"
            />
            <span className="text-xs font-medium w-6 text-right">{rules.selection?.top_n || 20}</span>
          </div>
        </div>

        <div className="space-y-2 flex flex-col gap-1">
          <Label className="text-xs text-slate-500">Stop Loss (%)</Label>
          <div className="flex items-center gap-3">
            <Slider 
              value={[rules.stop_loss_pct ? rules.stop_loss_pct * 100 : 0]} 
              min={0} max={50} step={1}
              onValueChange={([v]) => setRules({...rules, stop_loss_pct: v > 0 ? v / 100 : undefined})}
              className="flex-1"
            />
            <span className="text-xs font-medium w-8 text-right">
              {rules.stop_loss_pct ? `${(rules.stop_loss_pct * 100).toFixed(0)}%` : 'None'}
            </span>
          </div>
        </div>

        <div className="space-y-2 flex flex-col gap-1">
          <Label className="text-xs text-slate-500">Take Profit (%)</Label>
          <div className="flex items-center gap-3">
            <Slider 
              value={[rules.take_profit_pct ? rules.take_profit_pct * 100 : 0]} 
              min={0} max={200} step={5}
              onValueChange={([v]) => setRules({...rules, take_profit_pct: v > 0 ? v / 100 : undefined})}
              className="flex-1"
            />
            <span className="text-xs font-medium w-8 text-right">
              {rules.take_profit_pct ? `${(rules.take_profit_pct * 100).toFixed(0)}%` : 'None'}
            </span>
          </div>
        </div>

        <Button size="sm" onClick={handleApply} className="w-full mt-2 h-8 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 font-semibold shadow-none">
          <Save className="w-3 h-3 mr-2" />
          Apply Visual Changes
        </Button>
      </div>
    </div>
  );
}
