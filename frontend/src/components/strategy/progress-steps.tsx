"use client";

import { Check } from "lucide-react";

const STEPS = [
  { label: "Goal", shortLabel: "Goal" },
  { label: "Chat", shortLabel: "Chat" },
  { label: "Review", shortLabel: "Review" },
  { label: "Save", shortLabel: "Save" },
];

interface ProgressStepsProps {
  currentStep: number; // 0-3
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="flex items-center gap-1 px-2">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;

        return (
          <div key={step.label} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isCompleted
                  ? "bg-primary/15 text-primary"
                  : isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-3 text-center">{i + 1}</span>
              )}
              <span>{step.shortLabel}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 h-px ${
                  i < currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
