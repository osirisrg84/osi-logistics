import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Mic, Square } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface AiAssistantPanelProps {
  chat: (message: string, history?: ChatMessage[]) => Promise<{ data: { reply: string } }>;
  buttonClassName?: string;
  panelClassName?: string;
  title?: string;
  placeholder?: string;
  greeting?: string;
  accent?: 'orange' | 'blue';
  /** Foto de la asistente, su nombre y su rol (por idioma), y preguntas rapidas (por idioma). */
  avatarSrc?: string;
  name?: string;
  role?: { es: string; en: string };
  quickPrompts?: { es: string[]; en: string[] };
}

const ACCENT_CLASSES = {
  orange: {
    header: 'bg-gradient-to-r from-orange-500 to-orange-400',
    userBubble: 'bg-orange-500',
    sendButton: 'bg-orange-500 hover:bg-orange-400',
    listenBg: 'bg-orange-500/10',
    listenBar: 'bg-orange-500',
    listenText: 'text-orange-500',
  },
  blue: {
    header: 'bg-gradient-to-r from-blue-500 to-blue-400',
    userBubble: 'bg-blue-500',
    sendButton: 'bg-blue-500 hover:bg-blue-400',
    listenBg: 'bg-blue-500/10',
    listenBar: 'bg-blue-500',
    listenText: 'text-blue-500',
  },
} as const;

const LISTEN_BAR_HEIGHTS = [8, 14, 20, 13, 22, 16, 9, 18, 24, 15, 11, 19, 14, 8];

export function AiAssistantPanel({ chat, buttonClassName, panelClassName, title = 'Asistente OSI', placeholder = 'Pregunta algo...', greeting, accent = 'orange', avatarSrc, name, role, quickPrompts }: AiAssistantPanelProps) {
  const accentClasses = ACCENT_CLASSES[accent];
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = typeof window !== 'undefined' && !!getSpeechRecognitionCtor();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = lang === 'en' ? 'en-US' : 'es-ES';
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const chunks: string[] = [];
      for (let i = 0; i < e.results.length; i++) chunks.push(e.results[i][0].transcript);
      setInput(prev => (prev ? `${prev} ` : '') + chunks.join(' ').trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
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
        className={`${buttonClassName ?? 'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform'}${avatarSrc && !open ? ' !p-0 ring-2 ring-offset-2 ring-offset-transparent ' + (accent === 'blue' ? 'ring-blue-400' : 'ring-orange-400') : ''}`}
        aria-label="OSI IA"
      >
        {open ? <X className="w-6 h-6" /> : avatarSrc ? (
          <span className="relative block w-full h-full">
            <img src={avatarSrc} alt={name ?? 'OSI IA'} className="w-full h-full rounded-full object-cover" />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
          </span>
        ) : <Bot className="w-6 h-6" />}
      </button>

      {open && (
        <div className={panelClassName ?? 'fixed bottom-24 right-4 left-4 sm:left-auto z-40 sm:w-96 max-h-[70vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden fade-in'}>
          <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700 text-white flex-shrink-0 ${accentClasses.header}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt={name ?? title} className="w-9 h-9 rounded-full object-cover border-2 border-white/70 flex-shrink-0" />
              ) : (
                <Bot className="w-4 h-4 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-tight">{name ?? title}</p>
                {name && <p className="text-[11px] text-white/85 truncate leading-tight">{lang === 'en' ? 'AI assistant' : 'Asistente IA'}{role ? ` · ${role[lang === 'en' ? 'en' : 'es']}` : ''}</p>}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white/20 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
            {listening && (
              <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm ${accentClasses.listenBg}`}>
                <div className="flex items-end gap-[3px] h-8">
                  {LISTEN_BAR_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className={`w-[3px] rounded-full ${accentClasses.listenBar}`}
                      style={{
                        height: h,
                        transformOrigin: 'center',
                        animation: `waveBar ${0.3 + (i % 6) * 0.07}s ease-in-out infinite alternate`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
                <p className={`text-xs font-semibold ${accentClasses.listenText}`}>{lang === 'en' ? 'Listening...' : 'Escuchando...'}</p>
              </div>
            )}
            {messages.length === 0 && (
              <div className="py-4 flex flex-col items-center gap-3">
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
                  {greeting ?? '¿En qué te puedo ayudar?'}
                </p>
                {quickPrompts && (
                  <div className="flex flex-col gap-2 w-full">
                    {quickPrompts[lang === 'en' ? 'en' : 'es'].map((q) => (
                      <button
                        key={q}
                        onClick={() => void send(q)}
                        className="text-left text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && avatarSrc && <img src={avatarSrc} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />}
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? `${accentClasses.userBubble} text-white`
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-end gap-2 justify-start">
                {avatarSrc && <img src={avatarSrc} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />}
                <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl px-3 py-2 text-sm text-gray-400 dark:text-slate-500">
                  {lang === 'en' ? 'Thinking...' : 'Pensando...'}
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
              onKeyDown={e => { if (e.key === 'Enter') void send(); }}
              disabled={sending}
            />
            {speechSupported && (
              <button
                onClick={toggleListening}
                disabled={sending}
                className={`w-9 h-9 rounded-xl disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors ${
                  listening ? 'bg-red-500 hover:bg-red-400 animate-pulse' : accentClasses.sendButton
                }`}
                aria-label={listening ? 'Detener dictado' : 'Hablar'}
              >
                {listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => void send()}
              disabled={!input.trim() || sending}
              className={`w-9 h-9 rounded-xl disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors ${accentClasses.sendButton}`}
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
