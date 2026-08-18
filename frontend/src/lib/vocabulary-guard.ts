export function applyVocabularyGuard(text: string): string {
  if (!text) return text;
  
  // Case-insensitive replacements for banned terms
  let sanitized = text;
  
  const replacements = [
    { pattern: /\b(buy|buying)\b/gi, replacement: "consider" },
    { pattern: /\b(sell|selling)\b/gi, replacement: "re-evaluate" },
    { pattern: /\b(recommend|recommends|recommending|recommendation)\b/gi, replacement: "highlight" },
    { pattern: /\b(should buy|should sell)\b/gi, replacement: "might fit your criteria" },
    { pattern: /\b(best stock|top stock)\b/gi, replacement: "strong match" },
    { pattern: /\b(guaranteed|sure thing)\b/gi, replacement: "historically aligned" }
  ];
  
  for (const { pattern, replacement } of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}
