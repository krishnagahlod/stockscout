import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LESSONS, lessonBySlug } from "@/lib/lessons";
import { Panel } from "@/components/kit";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: `${lessonBySlug((await params).slug)?.title ?? "Lesson"} | StockScout` };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = lessonBySlug((await params).slug);
  if (!lesson) notFound();
  const next = LESSONS[LESSONS.indexOf(lesson) + 1];

  return (
    <article className="max-w-2xl mx-auto space-y-6">
      <Link href="/learn" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />All lessons</Link>
      <header>
        <p className="text-sm text-slate-500">{lesson.group}</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900">{lesson.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-800">{lesson.oneLine}</p>
      </header>
      <div className="space-y-4 text-[17px] leading-relaxed text-slate-700">
        {lesson.body.map((p) => <p key={p}>{p}</p>)}
      </div>
      {lesson.example && (
        <Panel className="border-l-4 border-indigo-400">
          <p className="text-sm font-semibold text-slate-500">Example</p>
          <p className="mt-1 leading-relaxed text-slate-800">{lesson.example}</p>
        </Panel>
      )}
      {lesson.deeper && <p className="text-sm text-slate-600">Go deeper: <a href={lesson.deeper.href} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline">{lesson.deeper.label}</a></p>}
      {next && (
        <Link href={`/learn/${next.slug}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-300">
          <span><span className="block text-xs text-slate-500">Next lesson</span><span className="font-semibold text-slate-900">{next.title}</span></span>
          <ArrowRight className="h-5 w-5 text-indigo-600" />
        </Link>
      )}
    </article>
  );
}
