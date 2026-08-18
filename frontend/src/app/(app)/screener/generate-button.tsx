"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Sparkles } from "lucide-react";

export function GenerateButton({ 
  isFirstTime = false 
}: { 
  isFirstTime?: boolean 
}) {
  const { pending } = useFormStatus();

  if (isFirstTime) {
    return (
      <Button type="submit" size="lg" disabled={pending} className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 px-8">
        <Sparkles className={`h-5 w-5 mr-2 ${pending ? 'animate-pulse' : ''}`} />
        {pending ? "Generating Picks..." : "Generate Picks Now"}
      </Button>
    );
  }

  return (
    <Button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
      <RefreshCcw className={`h-4 w-4 mr-2 ${pending ? 'animate-spin' : ''}`} />
      {pending ? "Regenerating..." : "Regenerate Picks"}
    </Button>
  );
}
