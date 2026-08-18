"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface NewsItem {
  id: string | number;
  title: string;
  summary: string;
  source: string;
  url: string;
  sentiment_score: number;
  published_at: string;
}

export function NewsPanel({ news, aiAnalysis }: { news: NewsItem[], aiAnalysis?: string }) {
  if (!news || news.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No recent news available for this stock.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {aiAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-foreground/90 leading-relaxed shadow-sm relative overflow-hidden"
        >
          <div className="flex gap-2 items-start relative z-10">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="italic text-xs md:text-sm">{aiAnalysis}</p>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary/10 rounded-full blur-xl pointer-events-none" />
        </motion.div>
      )}

      {news.map((item, index) => {
        let sentiment = "neutral";
        if (item.sentiment_score > 0.05) sentiment = "bullish";
        if (item.sentiment_score < -0.05) sentiment = "bearish";

        let sentimentColor = "bg-muted text-muted-foreground";
        if (sentiment === "bullish") sentimentColor = "bg-green-500/10 text-green-600 dark:text-green-400";
        if (sentiment === "bearish") sentimentColor = "bg-red-500/10 text-red-600 dark:text-red-400";
        
        return (
          <motion.div
            key={item.id || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border-b last:border-0 pb-4 last:pb-0"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                <h4 className="font-semibold text-sm line-clamp-2 leading-tight">
                  {item.title}
                </h4>
              </a>
              <Badge variant="secondary" className={`${sentimentColor} shrink-0 capitalize text-[10px] px-1.5 py-0`}>
                {sentiment}
              </Badge>
            </div>
            
            {item.summary && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {item.summary}
              </p>
            )}
            
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/60">
              <span>{item.source}</span>
              <span>{item.published_at ? new Date(item.published_at).toLocaleDateString() : "Recent"}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
