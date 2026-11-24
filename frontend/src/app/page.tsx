import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { MetricRow } from "@/components/kit";

export const metadata = {
  title: "StockScout | Invest with clarity",
  description: "Say what you want from your money. StockScout finds Nifty 500 companies that fit, explains why in plain words, and splits your budget into whole shares.",
};

// Static example on closing prices more than 30 days old (SEBI, May 2026: price data in learning material must lag by 30+ days).
const EXAMPLE = {
  idea: "I have ₹5,000. I'd like steady companies that pay me something every year.",
  lines: [
    { name: "ITC", shares: 6, amount: 1565 },
    { name: "Castrol India", shares: 9, amount: 1771 },
    { name: "Coal India", shares: 4, amount: 1647 },
  ],
  total: 4983,
  left: 17,
  why: "Coal India paid out about 10% of its share price as cash over the year before, among the highest in the Nifty 500.",
  asOf: "19 Oct 2026",
};

const STEPS = [
  { title: "Say it your way", text: "“Safe, big companies for five years.” “Something in healthcare, I can take some risk.” A sentence is enough. Or start from a ready-made idea." },
  { title: "See what fits, and why", text: "A short list of companies, spread across industries, each with reasons drawn from its real numbers. Add an amount and see exactly how many shares it buys." },
  { title: "Buy in your broker app, track it here", text: "Place the orders in Zerodha, Groww or any app you use. Record them here to follow your portfolio and get a plain health check." },
];

const WONT = [
  "Hold your money or place orders for you.",
  "Send tips, “sure-shot” calls or targets.",
  "Hide how a company was picked. Every rule and number is one tap away.",
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600"><TrendingUp className="h-5 w-5 text-white" aria-hidden /></span>
      <span className="font-display text-xl font-bold tracking-tight text-slate-900">StockScout</span>
    </span>
  );
}

const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" aria-label="StockScout home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/auth/login" className="rounded-xl px-3 py-2 font-medium text-slate-600 hover:text-slate-900">Log in</Link>
          <Link href="/auth/signup" className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">Create account</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Say what you want from your money. See which companies fit.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              StockScout turns one plain sentence into a short list of Nifty 500 companies, explains each one in everyday words, and splits your budget into whole shares. Built for people investing for the first time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth/signup" className="rounded-2xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Create a free account</Link>
              <Link href="/auth/login" className="rounded-2xl px-5 py-3.5 text-base font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-white">I have an account</Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">You buy in your own broker app. StockScout never touches your money.</p>
          </div>

          {/* The slip: what a sentence becomes */}
          <figure className="relative">
            <div className="rounded-[28px] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.25)] ring-1 ring-slate-200 sm:p-8">
              <p className="slip-row border-l-4 border-indigo-500 pl-4 text-base leading-relaxed text-slate-800" style={{ "--i": 0 } as React.CSSProperties}>
                “{EXAMPLE.idea}”
              </p>
              <div className="my-6 border-t border-dashed border-slate-300" />
              <table className="w-full text-[15px]">
                <caption className="sr-only">Example split of ₹5,000</caption>
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="pb-2 font-medium">Company</th><th className="pb-2 text-right font-medium">Shares</th><th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE.lines.map((l, i) => (
                    <tr key={l.name} className="slip-row border-t border-slate-100" style={{ "--i": i + 1 } as React.CSSProperties}>
                      <td className="py-3 font-semibold text-slate-900">{l.name}</td>
                      <td className="py-3 text-right font-display text-xl font-bold tabular-nums">{l.shares}</td>
                      <td className="py-3 text-right tabular-nums text-slate-700">{rupee(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="slip-row border-t-2 border-slate-900" style={{ "--i": 4 } as React.CSSProperties}>
                    <td className="pt-3 font-semibold">You spend</td>
                    <td />
                    <td className="pt-3 text-right font-semibold tabular-nums">{rupee(EXAMPLE.total)}<span className="block text-xs font-normal text-slate-500">{rupee(EXAMPLE.left)} left over</span></td>
                  </tr>
                </tfoot>
              </table>
              <p className="slip-row mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900" style={{ "--i": 5 } as React.CSSProperties}>
                <strong className="font-semibold">Why Coal India?</strong> {EXAMPLE.why.replace("Coal India ", "It ")}
              </p>
            </div>
            <figcaption className="mt-3 text-center text-xs text-slate-500">An example for learning, on closing prices from {EXAMPLE.asOf}. Not a recommendation.</figcaption>
          </figure>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8">
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">From a sentence to shares in three steps</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="font-display text-5xl font-bold text-indigo-600/90">{i + 1}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-sm leading-relaxed text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Simple on top. Every number underneath.</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
              Each company opens with three plain answers: is the business strong, is the price reasonable, is the share rising or falling. Want more? Tap any number to see what it means and whether it&apos;s good.
            </p>
            <p className="mt-4 text-sm text-slate-500">Try it: these are Coal India&apos;s real numbers.</p>
          </div>
          <div className="rounded-[28px] bg-white px-6 py-3 ring-1 ring-slate-200">
            <MetricRow metric="roe" value={0.283} />
            <MetricRow metric="debt_to_equity" value={0.12} />
            <MetricRow metric="pe" value={7.06} />
            <MetricRow metric="volatility_30d" value={0.241} />
          </div>
        </section>

        <section className="bg-slate-900 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:px-8 lg:grid-cols-[1fr_1.2fr]">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">What StockScout will never do</h2>
            <div>
              <ul className="space-y-4 text-lg">
                {WONT.map((w) => <li key={w} className="border-l-2 border-amber-400 pl-4 leading-relaxed text-slate-200">{w}</li>)}
              </ul>
              <p className="mt-8 text-sm leading-relaxed text-slate-400">StockScout shares information to help you decide. It is not investment advice, and past numbers never promise future returns. <Link href="/disclaimer" className="underline hover:text-white">Read the full disclaimer</Link>.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-24 text-center md:px-8">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-5xl">Start with ₹500 or ₹50,000.</h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-slate-600">Tell StockScout what you want, and see which companies fit in under a minute.</p>
          <Link href="/auth/signup" className="mt-8 inline-block rounded-2xl bg-indigo-600 px-7 py-4 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Create a free account</Link>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <Logo />
          <p>Information, not advice. Market data may be delayed. <Link href="/disclaimer" className="underline">Disclaimer</Link></p>
        </div>
      </footer>
    </div>
  );
}
