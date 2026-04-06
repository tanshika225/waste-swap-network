import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { MessageSquare, Send, X, Minimize2, Maximize2, Bot, User, Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Speech Recognition setup
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = false;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ta'>('en');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hello! I'm your Waste Swap Assistant. How can I help you today?" }
  ]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (recognition) {
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
      recognition.start();
      setIsListening(true);
    }
  };

  const speakText = async (text: string) => {
    if (!isSpeaking) return;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say this naturally in the appropriate language (Tamil or English): ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }

        const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!audioContext) setAudioContext(ctx);
        
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    if (e) e.preventDefault();
    const userMessage = textOverride || input.trim();
    if (!userMessage || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are the official AI Assistant for the Waste Swap Network. Your goal is to help users manage waste, understand segregation (biodegradable vs non-biodegradable), provide advice on swapping items, and explain how the platform works. 
          
          CURRENT LANGUAGE PREFERENCE: ${language === 'ta' ? 'Tamil' : 'English'}. 
          Please respond primarily in ${language === 'ta' ? 'Tamil' : 'English'}. If the user switches language, you can follow, but respect the current UI setting.
          
          Be professional, helpful, and culturally aware of Chennai's waste management context. Keep responses concise and use markdown for formatting.`,
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      });

      const response = await chat.sendMessage({ message: userMessage });
      const modelText = response.text || "I'm sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: 'model', text: modelText }]);
      speakText(modelText);
    } catch (error) {
      console.error("ChatBot Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chatbot-window"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '64px' : '500px',
              width: '350px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/90 backdrop-blur-xl border border-stone-200 rounded-3xl shadow-2xl overflow-hidden mb-4 flex flex-col relative z-50"
          >
            {/* Header */}
            <div className="w-full flex-shrink-0 min-h-[64px] p-4 bg-emerald-600 text-white flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Eco Assistant</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-emerald-100">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex bg-white/10 rounded-lg p-0.5 mr-1">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      language === 'en' ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage('ta')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      language === 'ta' ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'
                    }`}
                  >
                    தமிழ்
                  </button>
                </div>
                <button 
                  onClick={() => setIsSpeaking(!isSpeaking)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  title={isSpeaking ? "Mute Voice" : "Unmute Voice"}
                >
                  {isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {messages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user' ? 'bg-stone-100' : 'bg-emerald-100'
                        }`}>
                          {msg.role === 'user' ? <User className="w-4 h-4 text-stone-600" /> : <Bot className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-emerald-600 text-white rounded-tr-none' 
                            : 'bg-stone-100 text-stone-800 rounded-tl-none'
                        }`}>
                          <div className="markdown-body prose prose-sm max-w-none">
                            <Markdown>{msg.text}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="bg-stone-100 p-3 rounded-2xl rounded-tl-none">
                          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-stone-100 bg-white">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything..."
                        className="w-full pl-4 pr-12 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    {recognition && (
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center ${
                          isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                        title="Voice Input"
                      >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className={`p-4 rounded-full shadow-2xl transition-all flex items-center gap-2 ${
          isOpen ? 'bg-stone-900 text-white' : 'bg-emerald-600 text-white'
        }`}
      >
        <MessageSquare className="w-6 h-6" />
        {!isOpen && <span className="font-bold text-sm pr-2">Eco Chat</span>}
      </motion.button>
    </div>
  );
}
