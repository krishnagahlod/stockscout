"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function HealthScoreGauge({ score, label }: { score: number; label: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 500);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  let color = "text-emerald-500";
  if (score < 50) color = "text-rose-500";
  else if (score < 75) color = "text-amber-500";

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg className="w-40 h-40 transform -rotate-90">
        <circle
          className="text-slate-200 dark:text-slate-800"
          strokeWidth="12"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="80"
          cy="80"
        />
        <motion.circle
          className={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="80"
          cy="80"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
          {animatedScore}
        </span>
        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
