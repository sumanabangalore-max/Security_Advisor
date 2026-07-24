import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, RefreshCw, Trash2, Sparkles, Terminal, Copy, Check } from "lucide-react";
import { api } from "../api";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  modelUsed?: string;
  tokensUsed?: number;
}

interface AiChatbotPanelProps {
  userRole: "admin" | "analyst" | "viewer";
}

export default function AiChatbotPanel({ userRole }: AiChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("sec_advisor_chat_history");
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [
      {
        id: "welcome-1",
        sender: "assistant",
        text: "### Welcome to SecAdvisor AI Assistant! 🛡️\n\nI have live context of your **Master Inventory**, **Active Vulnerabilities**, and **EOS/EOL lifecycle tracking**.\n\nYou can ask me questions like:\n- *\"What open vulnerabilities affect my production environment?\"*\n- *\"Which software packages are End of Life (EOL)?\"*\n- *\"How do I mitigate CVE-2026-8888 in Apache?\"*\n\nHow can I assist you today?",
        timestamp: new Date().toISOString(),
        modelUsed: "Gemini 3.6 Flash"
      }
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("sec_advisor_chat_history", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: promptToSend,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customPrompt) setInput("");
    setLoading(true);

    try {
      // Build history payload for Gemini
      const historyPayload = newMessages.slice(-10).map(m => ({
        role: m.sender === "user" ? "user" : "model",
        parts: m.text
      }));

      const res = await api.post<{ response: string; tokens_used: number; model_used: string }>("/api/v1/chat", {
        message: promptToSend,
        history: historyPayload
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: "assistant",
        text: res.response,
        timestamp: new Date().toISOString(),
        modelUsed: res.model_used,
        tokensUsed: res.tokens_used
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `### ⚠️ Chat Assistant Error\n\nFailed to receive response: ${err.message || "Unknown error"}.\n\nPlease ensure GEMINI_API_KEY is configured in your environment or switch AI engine in the top header.`,
        timestamp: new Date().toISOString(),
        modelUsed: "Error"
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your conversation history?")) {
      const initial: ChatMessage[] = [
        {
          id: `welcome-${Date.now()}`,
          sender: "assistant",
          text: "Conversation reset. Ask me anything about your CMDB inventory, vulnerabilities, or EOL status!",
          timestamp: new Date().toISOString(),
          modelUsed: "Gemini 3.6 Flash"
        }
      ];
      setMessages(initial);
      localStorage.removeItem("sec_advisor_chat_history");
    }
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMarkdownText = (text: string, msgId: string) => {
    const paragraphs = text.split("\n\n");
    return (
      <div className="space-y-3 text-xs">
        {paragraphs.map((para, i) => {
          if (para.startsWith("```")) {
            const lines = para.split("\n");
            const lang = lines[0].replace("```", "").trim();
            const code = lines.slice(1, lines.length - 1).join("\n");
            const codeId = `${msgId}-code-${i}`;
            return (
              <div key={i} className="rounded border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-zinc-300 my-2">
                <div className="border-b border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[9px] text-zinc-500 flex justify-between items-center uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1">
                    <Terminal className="h-3 w-3 text-emerald-400" />
                    {lang || "command"}
                  </span>
                  <button
                    onClick={() => handleCopyCode(code, codeId)}
                    className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {copiedId === codeId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedId === codeId ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto leading-relaxed">{code}</pre>
              </div>
            );
          }
          if (para.startsWith("###")) {
            return <h4 key={i} className="text-xs font-bold text-white uppercase tracking-wider mt-3 border-b border-zinc-800 pb-1">{para.replace("###", "").trim()}</h4>;
          }
          if (para.startsWith("##")) {
            return <h3 key={i} className="text-sm font-bold text-emerald-400 mt-3">{para.replace("##", "").trim()}</h3>;
          }
          if (para.startsWith("* ") || para.startsWith("- ")) {
            const items = para.split("\n");
            return (
              <ul key={i} className="list-disc list-inside space-y-1 text-zinc-300">
                {items.map((it, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: formatBold(it.replace(/^[\*\-]\s*/, "")) }} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatBold(para) }} />
          );
        })}
      </div>
    );
  };

  const formatBold = (str: string) => {
    return str.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
              .replace(/\*(.*?)\*/g, '<em class="text-zinc-200">$1</em>')
              .replace(/`(.*?)`/g, '<code class="bg-zinc-800 text-emerald-400 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
  };

  const samplePrompts = [
    "What open vulnerabilities affect my production environment?",
    "Which software packages in my inventory are End of Life (EOL)?",
    "Give me technical patching steps for CVE-2026-8888",
    "Summarize our overall Docker CMDB security posture"
  ];

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#121214] flex flex-col h-[650px] shadow-xl overflow-hidden" id="ai-chatbot-panel">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-[#0c0c0e]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              SecAdvisor AI Security Assistant
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3 w-3" />
                Context Aware
              </span>
            </h3>
            <p className="text-[10px] text-zinc-500">Live system memory: Master Inventory + CVE Matches + EOS/EOL Lifecycle</p>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Clear Conversation History"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Chat
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#09090b]/50">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                isUser ? "bg-emerald-600 text-white" : "bg-zinc-800 text-emerald-400 border border-zinc-700"
              }`}>
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div className={`max-w-[85%] rounded-lg p-4 space-y-2 ${
                isUser
                  ? "bg-emerald-600/15 border border-emerald-500/20 text-white"
                  : "bg-[#121214] border border-zinc-800 text-zinc-300"
              }`}>
                {/* Meta info header */}
                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono border-b border-zinc-800/50 pb-1.5 mb-1">
                  <span>{isUser ? "You" : m.modelUsed || "SecAdvisor AI"}</span>
                  <div className="flex items-center gap-2">
                    {m.tokensUsed && <span>{m.tokensUsed} tokens</span>}
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Body */}
                {renderMarkdownText(m.text, m.id)}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded bg-zinc-800 text-emerald-400 border border-zinc-700 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 animate-bounce" />
            </div>
            <div className="bg-[#121214] border border-zinc-800 rounded-lg p-3.5 text-xs text-zinc-400 font-mono flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
              SecAdvisor AI is querying live CMDB context & Gemini model...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 border-t border-zinc-800 bg-[#0c0c0e]/80 flex flex-wrap gap-2 overflow-x-auto">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 self-center mr-1">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          Quick Actions:
        </span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            disabled={loading}
            className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 rounded px-2.5 py-1 transition-all cursor-pointer truncate max-w-xs"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-zinc-800 bg-[#121214]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about vulnerabilities, EOL software, patching, or system risk..."
            disabled={loading}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors"
            id="chat-input-field"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
            id="chat-send-btn"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
