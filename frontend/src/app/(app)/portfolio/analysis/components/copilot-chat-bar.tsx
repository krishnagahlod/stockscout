"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Send, Loader2, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendPortfolioChatMessage } from "../actions";

export function CopilotChatBar({ snapshotSummary }: { snapshotSummary: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    {
      role: "assistant",
      content: "Hello! I have your full portfolio data. Ask me anything about your sector allocation, risks, or get stock-specific advice."
    }
  ]);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!isOpen) setIsOpen(true);

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const newMessages = [...messages, userMessage];

    try {
      const response = await sendPortfolioChatMessage(newMessages, snapshotSummary);
      
      if (response.success && response.message) {
        setMessages(prev => [...prev, response.message]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "Sorry, I encountered an error communicating with the server." 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, something went wrong." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center">
      {/* 
        Container for the chat bar. 
        It has pointer-events-auto so we can click inside it.
        We limit max width and add padding to position it nicely above the bottom edge.
      */}
      <div className="w-full max-w-4xl px-4 pb-6 pointer-events-auto">
        <motion.div
          initial={false}
          animate={{
            height: isOpen ? "600px" : "auto",
            maxHeight: isOpen ? "80vh" : "auto"
          }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="flex flex-col bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          
          {/* Chat History Area (Only visible when open) */}
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6"
                ref={chatContainerRef}
              >
                <div className="flex flex-col space-y-6 pb-2">
                  {messages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`flex gap-3 sm:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      
                      <div 
                        className={`rounded-2xl px-5 py-4 max-w-[90%] sm:max-w-[85%] shadow-sm ${
                          msg.role === "user" 
                            ? "bg-indigo-600 text-white rounded-br-sm" 
                            : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-bl-sm prose prose-sm md:prose-base dark:prose-invert prose-headings:font-bold prose-a:text-indigo-600 dark:prose-a:text-indigo-400"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <div className="text-[15px] leading-relaxed">{msg.content}</div>
                        ) : (
                          <div className="markdown-content max-w-full overflow-x-auto">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/20">
                          <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-3 sm:gap-4 justify-start">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="rounded-2xl px-6 py-4 bg-slate-100 dark:bg-slate-900 rounded-bl-sm flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-500 animate-pulse">
                          Analyzing...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Bar Area */}
          <div className="p-3 sm:p-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsOpen(!isOpen)}
                className="p-3 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors shrink-0 text-slate-500"
                title={isOpen ? "Close Chat" : "Expand Chat"}
              >
                {isOpen ? <X className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
              
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio..."
                  className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-full py-3 sm:py-4 pl-5 pr-14 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  onClick={() => !isOpen && setIsOpen(true)}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-full transition-all shadow-md"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
