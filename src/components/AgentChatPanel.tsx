import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { streamAgentChat } from "@/lib/agent-chat-stream";
import { toast } from "sonner";
import { renderMarkdown } from "@/lib/render-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const quickPrompts = [
  "Suggest assistance programs",
  "PSPS talking points",
  "Explain billing options",
];

interface AgentChatPanelProps {
  customerContext?: string;
}

export default function AgentChatPanel({ customerContext }: AgentChatPanelProps) {
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
      await streamAgentChat({
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 chat-scrollbar">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
            <Bot className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Ask me to draft responses, explain policies, or suggest programs for this customer.</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="px-2.5 py-1 rounded-full text-xs border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                >
                  {p}
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
            {m.role === "assistant" ? (
              <div
                className="max-w-[90%] px-2.5 py-1.5 rounded-xl rounded-bl-sm text-xs leading-relaxed bg-muted text-foreground chat-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
            ) : (
              <div className="max-w-[90%] px-2.5 py-1.5 rounded-xl rounded-br-sm text-xs leading-relaxed whitespace-pre-wrap bg-primary text-primary-foreground">
                {m.content}
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

      {/* Input */}
      <div className="p-2 border-t border-border">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this customer..."
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
