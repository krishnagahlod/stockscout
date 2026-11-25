"use client";

import { useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/kit";
import { setWeeklyEmail } from "./actions";

export function WeeklyEmailToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
        <div>
          <p className="font-semibold text-slate-900">Weekly email {on ? "is on" : "is off"}</p>
          <p className="text-sm text-slate-600">Every Saturday morning: how your portfolio did, what&apos;s coming up for it, and one 2-minute lesson. Three lines, no tips.</p>
        </div>
      </div>
      <Button variant={on ? "outline" : "default"} className="rounded-xl" disabled={pending} onClick={() => start(() => setWeeklyEmail(!on))}>
        {on ? "Turn off" : "Turn on"}
      </Button>
    </Panel>
  );
}
