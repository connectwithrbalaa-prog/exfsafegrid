import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Flame, Zap, DollarSign, Heart, Activity } from "lucide-react";
import { streamChat } from "@/lib/chat-stream";
import { toast } from "sonner";
import { renderMarkdown } from "@/lib/render-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const quickTopics = [
  { icon: Flame, label: "Wildfire Risk", prompt: "What's the current wildfire risk in my area and how can I prepare?" },
  { icon: Zap, label: "Outages", prompt: "How do I report a power outage and check restoration status?" },
  { icon: DollarSign, label: "Billing", prompt: "Can you explain my bill and available payment options?" },
  { icon: Heart, label: "Assistance", prompt: "What assistance programs am I eligible for?" },
  { icon: Activity, label: "Grid Stress", prompt: "What is grid stress and how can I help reduce demand?" },
];

interface ChatPanelProps {
  customerContext?: string;
}

export default function ChatPanel({ customerContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        customerContext,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        onError: (err) => {
          toast.error(err);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error("Connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-accent-foreground">ExfSafeGrid Assistant</h3>
          <p className="text-xs text-muted-foreground">Ask about outages, billing, safety & more</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 chat-scrollbar">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">How can I help today?</p>
              <p className="text-xs text-muted-foreground mt-1">Choose a topic or type your question</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {quickTopics.map((t) => (
                <button
                  key={t.label}
                  onClick={() => send(t.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                >
                  <t.icon className="w-3 h-3 text-primary" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                <Bot className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
            {m.role === "assistant" ? (
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-chat-bot text-chat-bot-foreground chat-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
            ) : (
              <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap bg-chat-user text-chat-user-foreground">
                {m.content}
              </div>
            )}
            {m.role === "user" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-0.5">
                <User className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}




        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="bg-chat-bot px-3 py-2 rounded-2xl rounded-bl-md flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick topics after response */}
      {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
        <div className="flex flex-wrap gap-2 justify-center px-3 py-2 border-t border-border">
          {quickTopics.map((t) => (
            <button
              key={t.label}
              onClick={() => send(t.prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
            >
              <t.icon className="w-3 h-3 text-primary" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
