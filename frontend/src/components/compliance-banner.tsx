"use client";

import { Info, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export function ComplianceBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('compliance_banner_dismissed');
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    localStorage.setItem('compliance_banner_dismissed', 'true');
    setIsVisible(false);
  };

  return (
    <div className="w-full bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 text-slate-500 z-50">
      <div className="flex items-center justify-center gap-2 flex-1">
        <Info className="h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-[11px] sm:text-xs font-medium text-center tracking-wide">
          INFORMATIONAL AI TOOL • NOT SEBI REGISTERED INVESTMENT ADVICE •{" "}
          <Link href="/disclaimer" className="underline hover:text-slate-800">
            READ FULL DISCLAIMER
          </Link>
        </p>
      </div>
      <button 
        onClick={handleDismiss} 
        className="p-1 hover:bg-slate-200 rounded-md transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
