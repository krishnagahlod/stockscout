import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStockSearch } from "@/hooks/use-stock-search";
import { Search, X, Check, Loader2, Plus, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomStock } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomPortfolioFormProps {
  onSave: (data: { name: string; position_sizing: string; stocks: CustomStock[] }) => void;
  onCancel: () => void;
  isSaving: boolean;
  initialName?: string;
  initialPositionSizing?: string;
  initialStocks?: CustomStock[];
}

export function CustomPortfolioForm({ onSave, onCancel, isSaving, initialName, initialPositionSizing, initialStocks }: CustomPortfolioFormProps) {
  const [name, setName] = useState(initialName || "My Custom Portfolio");
  const [positionSizing, setPositionSizing] = useState(initialPositionSizing || "equal");
  const [searchQuery, setSearchQuery] = useState("");
  const { results, isLoading, search } = useStockSearch();
  const [selectedStocks, setSelectedStocks] = useState<CustomStock[]>(initialStocks || []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    search(val);
  };

  const addStock = (stock: any) => {
    if (!selectedStocks.find(s => s.symbol === stock.symbol)) {
      setSelectedStocks([...selectedStocks, { symbol: stock.symbol, name: stock.name, weight: undefined }]);
    }
    setSearchQuery("");
  };

  const removeStock = (symbol: string) => {
    setSelectedStocks(selectedStocks.filter(s => s.symbol !== symbol));
  };

  const handleWeightChange = (symbol: string, val: string) => {
    const w = parseFloat(val);
    setSelectedStocks(selectedStocks.map(s => s.symbol === symbol ? { ...s, weight: isNaN(w) ? undefined : w / 100 } : s));
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{initialName ? "Edit Custom Portfolio" : "Create Custom Portfolio"}</CardTitle>
        <CardDescription>Manually select stocks for your portfolio. We'll track it and provide AI playbooks just like our automated strategies.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Portfolio Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Dividend Stars" />
        </div>

        <div className="space-y-2 relative">
          <Label>Search and Add Stocks</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or symbol..." 
              className="pl-9" 
              value={searchQuery}
              onChange={handleSearch}
            />
            {isLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          
          {searchQuery && results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {results.map((r, i) => (
                <div 
                  key={i} 
                  className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center text-sm"
                  onClick={() => addStock(r)}
                >
                  <div>
                    <span className="font-medium">{r.symbol.replace('.NS', '')}</span>
                    <span className="text-muted-foreground ml-2">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!r.has_price_data && (
                      <Badge variant="outline" className="text-orange-500 border-orange-500">No Backtest Data</Badge>
                    )}
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedStocks.length > 0 && (
          <div className="space-y-3 border rounded-md p-4 bg-muted/20">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Selected Stocks ({selectedStocks.length})</h3>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Position Sizing:</Label>
                <Select value={positionSizing} onValueChange={setPositionSizing}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equal Weight</SelectItem>
                    <SelectItem value="inverse_volatility">Inverse Volatility</SelectItem>
                    <SelectItem value="custom">Custom Weights</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {selectedStocks.map((stock) => (
                <div key={stock.symbol} className="flex items-center justify-between bg-background border rounded-md p-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{stock.symbol.replace('.NS', '')}</span>
                    <span className="text-muted-foreground text-xs">{stock.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {positionSizing === "custom" && (
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          className="w-16 h-7 text-xs px-2" 
                          placeholder="%"
                          value={stock.weight !== undefined ? (stock.weight * 100).toString() : ""}
                          onChange={(e) => handleWeightChange(stock.symbol, e.target.value)}
                        />
                        <span className="text-muted-foreground text-xs">%</span>
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStock(stock.symbol)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {positionSizing === "custom" && (
              <div className="flex justify-between items-center text-xs pt-2 border-t mt-2">
                <span className="text-muted-foreground">Total Weight:</span>
                <span className={`font-medium ${
                  Math.abs(selectedStocks.reduce((a, b) => a + (b.weight || 0), 0) - 1.0) > 0.01 ? "text-red-500" : "text-green-500"
                }`}>
                  {(selectedStocks.reduce((a, b) => a + (b.weight || 0), 0) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t p-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={() => onSave({ name, position_sizing: positionSizing, stocks: selectedStocks })}
          disabled={selectedStocks.length === 0 || isSaving}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialName ? "Update Portfolio" : "Create Portfolio"}
        </Button>
      </CardFooter>
    </Card>
  );
}
