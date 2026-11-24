import { PageTitle, Panel } from "@/components/kit";
import { CheckForm } from "./check-form";

export const metadata = { title: "Check a tip | StockScout" };

const QUESTIONS = [
  { q: "Who sent it, and do they gain if you buy?", a: "Paid groups and accounts that are paid to promote a company profit when you buy, whatever happens next." },
  { q: "Is a SEBI registration number shown?", a: "Anyone giving buy or sell calls must be registered with SEBI as a research analyst or adviser. Look the number up in SEBI's list of registered intermediaries at sebi.gov.in." },
  { q: "Does it promise a return or a date?", a: "Real research talks about risks. \"Target ₹600 by Friday\" and \"guaranteed double\" are sales talk." },
  { q: "Would you still buy it if no one else were?", a: "If the only reason is that others are buying, you may be the late buyer that early sellers need." },
];

export default function CheckPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle title="Check a tip" subtitle="Got a stock tip from a group chat, a reel or a friend? Paste it here. StockScout reads the message and checks each company against its real numbers." />
      <CheckForm />
      <Panel>
        <h2 className="font-display text-lg font-bold text-slate-900">Four questions before acting on any tip</h2>
        <dl className="mt-4 space-y-4">
          {QUESTIONS.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-semibold text-slate-900">{q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{a}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
