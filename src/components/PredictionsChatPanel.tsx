import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-chat`;

export interface PredictionsChatConfig {
  name: string;
  subtitle: string;
  suggestions: string[];
  icon?: React.ReactNode;
  persona?: string;
}

interface Props {
  config: PredictionsChatConfig;
}

export default function PredictionsChatPanel({ config }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: updatedMessages, persona: config.persona }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${errData.error || "Something went wrong."}` }]);
        setIsLoading(false);
        return;
      }

      const contentType = resp.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        const data = await resp.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply || "No results found." }]);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (!assistantSoFar) {
        setMessages(prev => [...prev, { role: "assistant", content: "No response received. Try again shortly." }]);
      }
    } catch (e: any) {
      console.error("Predictions chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Failed to connect to the predictions assistant." }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 chat-scrollbar">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
            {config.icon || <Bot className="w-6 h-6 text-muted-foreground" />}
            <div>
              <p className="text-xs font-medium text-foreground">{config.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{config.subtitle}</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              {config.suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-accent transition-colors text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center mt-0.5">
                <Bot className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
            <div
              className={`max-w-[90%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm prose prose-xs prose-headings:text-foreground prose-strong:text-foreground"
              }`}
            >
              {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
            </div>
            {m.role === "user" && (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center mt-0.5">
                <User className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-1.5 items-start">
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="bg-muted px-2.5 py-1.5 rounded-xl rounded-bl-sm flex gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.2s]" />
              <span className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick suggestions after response */}
      {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
        <div className="px-2 py-1.5 border-t border-border flex flex-wrap gap-1.5">
          {config.suggestions.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[10px] px-2 py-1 rounded-md border border-border bg-muted/50 hover:bg-accent transition-colors text-foreground truncate max-w-[48%]"
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-auto"
          >
            <RotateCcw className="w-3 h-3" /> New
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t border-border">
        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-1.5">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about predictions…"
            disabled={isLoading}
            className="flex-1 px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
