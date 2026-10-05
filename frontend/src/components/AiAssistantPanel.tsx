import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send } from 'lucide-react';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

interface AiAssistantPanelProps {
  chat: (message: string, history?: ChatMessage[]) => Promise<{ data: { reply: string } }>;
  buttonClassName?: string;
  panelClassName?: string;
  title?: string;
  placeholder?: string;
  greeting?: string;
}

export function AiAssistantPanel({ chat, buttonClassName, panelClassName, title = 'Asistente OSI', placeholder = 'Pregunta algo...', greeting }: AiAssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const { data } = await chat(text, messages.slice(-6));
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude procesar eso, intenta de nuevo.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className={buttonClassName ?? 'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform'}
        aria-label="Asistente IA"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {open && (
        <div className={panelClassName ?? 'fixed bottom-24 right-4 left-4 sm:left-auto z-40 sm:w-96 max-h-[70vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden fade-in'}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-orange-500 to-orange-400 text-white flex-shrink-0">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm font-bold">{title}</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">
                {greeting ?? '¿En qué te puedo ayudar?'}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl px-3 py-2 text-sm text-gray-400 dark:text-slate-500">
                  Pensando...
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
            <input
              className="input flex-1 text-sm"
              placeholder={placeholder}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
