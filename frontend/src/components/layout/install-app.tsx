"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome and Edge fire this once, early, often before the menu that shows the button is open; keep it here.
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

/** "Install the app": the browser's own install prompt where there is one, otherwise the steps for this phone. */
export function InstallApp() {
  const [mode, setMode] = useState<"none" | "prompt" | "ios" | "menu">("none");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const decide = () => {
      if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return setMode("none");
      if (deferred) return setMode("prompt");
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return setMode("ios");
      setMode(window.matchMedia("(pointer: coarse)").matches ? "menu" : "none");
    };
    decide();
    listeners.add(decide);
    return () => { listeners.delete(decide); };
  }, []);

  if (mode === "none") return null;

  const click = async () => {
    if (mode === "prompt" && deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      setMode("none");
    } else setOpen((o) => !o);
  };

  return (
    <div className="px-4 pb-2">
      <button type="button" onClick={click} aria-expanded={mode === "prompt" ? undefined : open}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600">
        <Download className="h-4 w-4" />
        Install the app
      </button>
      {open && (
        <p className="px-4 pb-2 text-xs leading-relaxed text-slate-600">
          {mode === "ios"
            ? <>In Safari, tap the Share button (the square with an arrow), then <strong>Add to Home Screen</strong>.</>
            : <>Open your browser&apos;s menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>}
        </p>
      )}
    </div>
  );
}
