"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { addHolding } from "./actions";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Adding..." : "Add Holding"}
    </Button>
  );
}

import { StockAutocomplete } from "@/components/stock-autocomplete";

export function AddHoldingForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");

  async function action(formData: FormData) {
    setError("");
    try {
      await addHolding(formData);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Holding
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Holding</SheetTitle>
          <SheetDescription>
            Enter the details of your stock purchase.
          </SheetDescription>
        </SheetHeader>

        <form action={action} className="space-y-4 mt-6">
          {error && <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded">{error}</div>}
          
          <div className="space-y-2 relative">
            <Label htmlFor="ticker">Ticker</Label>
            <input type="hidden" name="ticker" value={selectedTicker} />
            <StockAutocomplete 
               onSelect={(symbol) => setSelectedTicker(symbol)}
               placeholder="Search and select a stock..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" name="quantity" type="number" min="1" placeholder="e.g. 100" required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="avgBuyPrice">Average Buy Price (₹)</Label>
            <Input id="avgBuyPrice" name="avgBuyPrice" type="number" step="0.01" min="0" placeholder="e.g. 2500.50" required />
          </div>
          
          <SubmitButton />
        </form>
      </SheetContent>
    </Sheet>
  );
}
