"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, PieChart, ShieldCheck, AlertTriangle, Briefcase, Activity } from "lucide-react";

const iconMap: Record<string, any> = {
  "chart-pie": PieChart,
  "shield-check": ShieldCheck,
  "alert-triangle": AlertTriangle,
  "briefcase": Briefcase,
  "activity": Activity,
};

export function ReportSection({ section }: { section: any }) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = iconMap[section.icon] || Activity;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
            <Icon className="w-5 h-5 text-indigo-500" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">{section.title}</h3>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-slate-100 dark:border-slate-800">
              {section.content && (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                  {section.content}
                </p>
              )}
              
              {section.items && (
                <ul className="space-y-3 mt-2">
                  {section.items.map((item: any, idx: number) => {
                    if (typeof item === 'string') {
                      return (
                        <li key={idx} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <span className="text-indigo-500 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      );
                    }
                    
                    if (item.severity) {
                      const colors = {
                        high: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800",
                        medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800",
                        low: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800",
                      } as any;
                      return (
                        <li key={idx} className={`p-3 rounded-xl border flex items-start gap-3 ${colors[item.severity] || colors.medium}`}>
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span className="text-sm font-medium">{item.text}</span>
                        </li>
                      );
                    }

                    if (item.action) {
                      const actionColors = {
                        add: "bg-emerald-500",
                        reduce: "bg-rose-500",
                        hold: "bg-slate-500"
                      } as any;
                      return (
                        <li key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className={`px-2.5 py-1 rounded-md text-xs font-bold text-white uppercase tracking-wider ${actionColors[item.action] || actionColors.hold}`}>
                            {item.action}
                          </div>
                          <div className="font-bold text-sm min-w-[80px]">{item.stock || item.sector}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{item.reason}</div>
                        </li>
                      )
                    }

                    return null;
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
