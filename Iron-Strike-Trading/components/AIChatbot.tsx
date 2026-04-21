import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  BookOpen,
  HelpCircle,
  TrendingUp,
  Minimize2,
  Maximize2,
  Target,
  DollarSign,
  BarChart3,
  Flame,
  Expand,
  Shrink,
  EyeOff
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SelectSignalHistory } from "@shared/schema";

interface StructuredResponse {
  answer: string;
  confidence: number;
  risk: string;
  next_actions: string[];
  disclaimer?: string;
  sources?: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  structured?: StructuredResponse;
}

interface ChatbotResponse {
  response: string;
  structured?: StructuredResponse;
  success?: boolean;
  validationErrors?: string[];
}

const QUICK_PROMPTS = [
  { icon: Target, text: "Best strike for AAPL?", category: "signal" },
  { icon: BarChart3, text: "Explain Greeks", category: "education" },
  { icon: DollarSign, text: "0DTE risk tips", category: "education" },
  { icon: Flame, text: "Analyze my signals", category: "signal" },
  { icon: TrendingUp, text: "Call vs Put?", category: "education" },
  { icon: HelpCircle, text: "How to use screener?", category: "help" },
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const structured = message.structured;
  
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : ""}`}>
        <div className={`p-2 rounded-full shrink-0 ${
          isUser ? "bg-primary" : "bg-card border border-border"
        }`}>
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-foreground" />
          )}
        </div>
        <div className={`p-3 rounded-lg ${
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-card border border-border text-foreground"
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          
          {!isUser && structured && (
            <div className="mt-3 space-y-2 pt-2 border-t border-border/50">
              {structured.risk && (
                <div className="flex items-start gap-2 text-xs">
                  <Badge variant="secondary" className="text-amber-400 shrink-0">Risk</Badge>
                  <span className="text-muted-foreground">{structured.risk}</span>
                </div>
              )}
              
              {structured.next_actions && structured.next_actions.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground font-medium">Next Steps:</span>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {structured.next_actions.slice(0, 3).map((action, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-cyan-400">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {structured.disclaimer && (
                <p className="text-[10px] text-muted-foreground/70 italic mt-2">
                  {structured.disclaimer}
                </p>
              )}
            </div>
          )}
          
          <p className={`text-xs mt-1 ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}

interface AIChatbotProps {
  recentSignals?: SelectSignalHistory[];
  embedded?: boolean;
}

export default function AIChatbot({ recentSignals, embedded = false }: AIChatbotProps) {
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chatbot-hidden') === 'true';
    }
    return false;
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const handleHide = () => {
    setIsHidden(true);
    setIsOpen(false);
    localStorage.setItem('chatbot-hidden', 'true');
  };
  
  const handleShow = () => {
    setIsHidden(false);
    localStorage.setItem('chatbot-hidden', 'false');
  };
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your Iron Strike Coach, your personal trading mentor. I'm here to help you:\n\n• Develop winning trading strategies\n• Analyze signals & manage risk\n• Master options Greeks & timing\n• Build discipline & consistency\n• Learn from your trades\n\nWhat would you like to work on today?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const signalContext = recentSignals?.slice(0, 5).map(s => ({
        symbol: s.symbol,
        action: s.action,
        optionType: s.optionType,
        strikePrice: s.strikePrice,
        premium: s.premium,
        confidence: s.confidence,
        reasoning: s.reasoning
      }));
      
      const response = await apiRequest("POST", "/api/chat", { 
        message,
        signalContext
      });
      return response.json() as Promise<ChatbotResponse>;
    },
    onSuccess: (data) => {
      let content: string;
      if (typeof data.response === 'object' && data.response !== null) {
        content = Object.entries(data.response)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
      } else {
        content = String(data.response || "Analysis complete.");
      }
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: new Date(),
        structured: data.structured,
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      let content = "I apologize, but I encountered an error. Please try again or rephrase your question.";
      try {
        const msg = error?.message || "";
        const jsonMatch = msg.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message) {
            content = parsed.message;
          }
        } else if (msg.includes("429")) {
          content = "AI service is temporarily busy. Please try again in a moment.";
        }
      } catch {}
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleSend = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputValue.trim());
    setInputValue("");
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Embedded mode: render inline without positioning controls
  if (embedded) {
    return (
      <Card className="w-full bg-background border-border">
        <CardHeader className="p-3 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-muted rounded-lg">
              <Bot className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                Iron Strike Coach
                <Badge variant="secondary" className="text-[10px]">
                  AI Market Mentor
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Your personal trading coach & mentor</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-[400px]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {chatMutation.isPending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-3 border-t border-border">
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_PROMPTS.slice(0, 4).map((prompt, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover-elevate text-muted-foreground text-xs"
                  onClick={() => handleQuickPrompt(prompt.text)}
                  data-testid={`embedded-quick-prompt-${index}`}
                >
                  <prompt.icon className="h-3 w-3 mr-1" />
                  {prompt.text}
                </Badge>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about options, Greeks, or signals..."
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                disabled={chatMutation.isPending}
                data-testid="input-embedded-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || chatMutation.isPending}
                className="shrink-0"
                size="icon"
                data-testid="button-embedded-send-chat"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // When hidden, show a small show toggle
  if (isHidden) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 9999 
        }}
      >
        <Button
          onClick={handleShow}
          variant="outline"
          className="h-10 rounded-full shadow-lg text-xs gap-2"
          data-testid="button-show-chat"
        >
          <MessageCircle className="h-4 w-4" />
          Show AI Chat
        </Button>
      </div>
    );
  }
  
  if (!isOpen) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 9999 
        }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isFullScreen ? '0' : '16px',
        right: isFullScreen ? '0' : '16px',
        top: isFullScreen ? '0' : 'auto',
        left: isFullScreen ? '0' : 'auto',
        zIndex: 9999,
        width: isFullScreen ? '100%' : isMinimized ? '288px' : '420px',
        maxWidth: isFullScreen ? '100%' : 'calc(100vw - 32px)',
        height: isFullScreen ? '100%' : isMinimized ? '56px' : '600px',
        maxHeight: isFullScreen ? '100%' : isMinimized ? '56px' : 'calc(100dvh - 32px)',
      }}
    >
      <Card className={`w-full h-full bg-background border-border shadow-xl transition-all duration-200 ${isFullScreen ? 'rounded-none' : ''}`}>
      <CardHeader className="p-3 border-b border-border flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded-lg">
            <Bot className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              Iron Strike Coach
              <Badge variant="secondary" className="text-[10px]">
                AI Market Mentor
              </Badge>
            </CardTitle>
            {!isMinimized && (
              <p className="text-xs text-muted-foreground">Your personal trading coach & mentor</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isMinimized && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsFullScreen(!isFullScreen)}
              data-testid="button-fullscreen-chat"
            >
              {isFullScreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMinimized(!isMinimized)}
            data-testid="button-minimize-chat"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => { setIsOpen(false); setIsFullScreen(false); }}
            data-testid="button-close-chat"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleHide}
            data-testid="button-hide-chat"
            title="Hide chatbot"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-60px)]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {chatMutation.isPending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-3 border-t border-border">
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_PROMPTS.map((prompt, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover-elevate text-muted-foreground text-xs"
                  onClick={() => handleQuickPrompt(prompt.text)}
                  data-testid={`quick-prompt-${index}`}
                >
                  <prompt.icon className="h-3 w-3 mr-1" />
                  {prompt.text}
                </Badge>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about options, Greeks, or signals..."
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || chatMutation.isPending}
                className="shrink-0"
                size="icon"
                data-testid="button-send-chat"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
      </Card>
    </div>
  );
}
