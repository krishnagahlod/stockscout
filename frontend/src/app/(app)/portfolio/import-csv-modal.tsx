"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { importHoldings } from "./actions";

interface ParsedHolding {
  assetIdentifier: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
}


export function ImportCSVModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "importing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setMessage("");
    }
  };

  const handleImport = () => {
    if (!file) return;
    setStatus("parsing");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Attempt to map common broker CSV columns
          const parsedHoldings: ParsedHolding[] = [];
          
          results.data.forEach((row: any) => {
            // Normalize keys (lowercase, trim, remove non-alphanumeric except spaces)
            const normalizedRow: Record<string, any> = {};
            for (const key in row) {
              const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
              normalizedRow[cleanKey] = row[key];
            }

            // Find instrument / ticker column
            const tickerVal = normalizedRow["instrument"] || normalizedRow["symbol"] || normalizedRow["ticker"] || normalizedRow["scrip"] || normalizedRow["stock"] || normalizedRow["name"];
            // Find quantity column
            const qtyVal = normalizedRow["qty"] || normalizedRow["quantity"] || normalizedRow["shares"] || normalizedRow["available qty"];
            // Find avg cost column
            const priceVal = normalizedRow["avg cost"] || normalizedRow["avg price"] || normalizedRow["average price"] || normalizedRow["buy price"] || normalizedRow["average cost"];
            // Find current price column (LTP)
            const ltpVal = normalizedRow["ltp"] || normalizedRow["cmp"] || normalizedRow["current price"] || normalizedRow["last traded"] || normalizedRow["last traded price"] || normalizedRow["close price"] || normalizedRow["last price"];

            if (tickerVal && qtyVal !== undefined && priceVal !== undefined) {
              const assetIdentifier = String(tickerVal).trim();
              // Skip if assetIdentifier is empty
              if (!assetIdentifier) return;
              
              const qty = parseFloat(String(qtyVal).replace(/,/g, ''));
              const price = parseFloat(String(priceVal).replace(/,/g, ''));
              const currentPrice = ltpVal ? parseFloat(String(ltpVal).replace(/,/g, '')) : undefined;

              if (!isNaN(qty) && !isNaN(price)) {
                parsedHoldings.push({
                  assetIdentifier,
                  quantity: qty,
                  avgBuyPrice: price,
                  currentPrice: !isNaN(currentPrice as number) ? currentPrice : undefined
                });
              }
            }
          });

          if (parsedHoldings.length === 0) {
            setStatus("error");
            setMessage("Could not find matching columns (Instrument, Qty, Avg. cost). Please check your CSV format.");
            return;
          }

          setStatus("importing");
          const response = await importHoldings(parsedHoldings);
          
          if (response.success) {
            setStatus("success");
            setMessage(`Successfully imported ${response.count} holdings.`);
            setTimeout(() => {
              setOpen(false);
              setFile(null);
              setStatus("idle");
            }, 2000);
          } else {
            setStatus("error");
            setMessage(response.message || "Import failed.");
          }
        } catch (err: any) {
          setStatus("error");
          setMessage(err.message || "An error occurred during import.");
        }
      },
      error: (err) => {
        setStatus("error");
        setMessage("Failed to parse CSV file: " + err.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Holdings</DialogTitle>
          <DialogDescription>
            Upload a CSV exported from your broker (e.g., Zerodha, Upstox).
            We look for columns like Instrument, Qty, and Avg. cost.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          {!file ? (
            <div 
              className="border-2 border-dashed rounded-lg p-12 text-center w-full cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium">Click to select CSV file</p>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center w-full space-y-4">
              <div className="flex items-center p-4 bg-muted rounded-md w-full">
                <FileText className="h-6 w-6 mr-3 text-primary" />
                <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Change</Button>
              </div>
              
              {status === "error" && (
                <div className="flex items-center text-destructive text-sm bg-destructive/10 p-3 rounded w-full">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  <p>{message}</p>
                </div>
              )}
              
              {status === "success" && (
                <div className="flex items-center text-green-600 text-sm bg-green-50 p-3 rounded w-full">
                  <CheckCircle2 className="h-4 w-4 mr-2 flex-shrink-0" />
                  <p>{message}</p>
                </div>
              )}
              
              <Button 
                className="w-full" 
                onClick={handleImport}
                disabled={status === "parsing" || status === "importing" || status === "success"}
              >
                {status === "parsing" ? "Parsing CSV..." : 
                 status === "importing" ? "Syncing with Database..." : 
                 status === "success" ? "Imported!" : 
                 "Import Holdings"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
