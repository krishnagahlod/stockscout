import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

export function AuthShell({ title, intro, error, message, children, footer }: {
  title: string
  intro?: React.ReactNode
  error?: string
  message?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-mesh-light flex flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600"><TrendingUp className="h-5 w-5 text-white" /></span>
        <span className="font-display text-xl font-bold tracking-tight text-slate-900">StockScout</span>
      </Link>
      <main className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-[0_8px_30px_rgb(15,23,42,0.06)] ring-1 ring-slate-200/70">
        <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
        {intro && <p className="mt-1.5 text-sm text-slate-500">{intro}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-5">{children}</div>
      </main>
      {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
    </div>
  )
}

export function Field({ label, ...props }: { label: string } & React.ComponentProps<'input'>) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={props.id} className="text-sm font-medium text-slate-700">{label}</label>
      <input {...props} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200" />
    </div>
  )
}

export function Submit({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="h-11 w-full rounded-xl bg-indigo-600 font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
      {children}
    </button>
  )
}
