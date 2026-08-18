import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-slate-900 placeholder:text-slate-400 selection:bg-indigo-100 selection:text-indigo-900 border-slate-200 h-10 w-full min-w-0 rounded-xl border bg-white px-4 py-2 text-base shadow-sm transition-[color,box-shadow,border-color] duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-indigo-400 focus-visible:ring-[3px] focus-visible:ring-indigo-500/20 hover:border-slate-300",
        "aria-invalid:border-rose-500 aria-invalid:ring-rose-500/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
