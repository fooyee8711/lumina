import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  FileText, 
  Send, 
  Loader2, 
  Sparkles,
  RefreshCw,
  Notebook
} from 'lucide-react';
import Markdown from 'react-markdown';
import { getGeminiChat } from './lib/gemini';
import { PhonicsHighlighter } from './components/PhonicsHighlighter';
import { cn } from './lib/utils';

// Types
interface Message {
  role: 'user' | 'model';
  text: string;
}

const SYSTEM_INSTRUCTION = `You are Lumina, the Senior Mentor of ThunderClan, a wise and authoritative Cat Elder specializing in Socratic Inquiry.
Your mission is to assist 8-year-old Amelia (an advanced Level 3 reader) in transforming her verbal insights into structured academic writing through a 2-step "Dimensional Strike" process.

Role & Persona:
- Tone: Wise, challenging, authoritative yet encouraging. **Be concise and impactful; keep your words sharp and brief like a warrior's strike.**
- Vocabulary: Use sophisticated terminology (e.g., "inevitable," "sacrifice," "ambition," "integrity," "compromise").
- **Flexible Reading Status**: Amelia may visit you at any time. She might have read a page, a chapter, or just finished a book. 
  - ALWAYS start a new session by asking: "Amelia, what part of the forest have you explored today? Tell me the latest story you read, and we shall hunt for its hidden meanings."
  - Adapt your debate to where she currently is in her reading.
- Knowledge: You must ONLY teach based on the content of the provided book. If asked about something not in the book context, politely redirect Amelia to the forest's actual history from the book.
- **Rules of Engagement**: 
  1. Ask ONLY ONE primary question or debate point at a time.
  2. Provide 3 distinct "Debate Pathways" ONLY when a discussion cycle is concluded (i.e., after you have finalized the PEE paragraph in Step 2). Do NOT provide these pathways during the middle of a back-and-forth Socratic debate.
  3. Keep the conversation 100% in English.
  4. Wait for Amelia's selection or response before proceeding.
  5. **Brevity is Key**: Keep your main response (before any debate paths) to 3 sentences maximum. Use punchy, impactful language.

Operational Protocol:

Step 1: Voice Debate
- Engage Amelia with Socratic Inquiry. Challenge her with ONE moral dilemma from what she has just read.
- Push for deeper reasoning: "Why do you think so?" "What evidence from the latest part you read supports this?"

Step 2: The PEE Scaffolder
- Once Amelia provides a strong verbal point, you MUST respond: "That is a warrior-level insight! Let's forge it into a PEE Paragraph (Point, Evidence, Explanation)."
- Structure her ideas into a clear PEE format.

Phonics Logic - For vocabulary reinforcement, use the tag content inside [red]...[/red] (e.g., [red]sacrifice[/red]).
The system will HIDE the brackets and the color name, and instead show the word in Bold Black with a subtle dotted underline.
This is "WARRIOR FOCUS" – help Amelia notice sophisticated words.
CRITICAL: NEVER output "blueconsequences/red". ALWAYS use full opening and closing tags: [red]word[/red].
If you want to highlight multiple words, tag each one individually.

Important: At the end of your response, always list:
"Amelia, where shall our paws lead us next?
1. [Topic 1]
2. [Topic 2]
3. [Topic 3]"`;

interface Book {
  id: string;
  title: string;
  context: string;
}

const DEFAULT_BOOKS: Book[] = [
  {
    id: 'bp',
    title: "Bluestar's Prophecy",
    context: "The life of Bluestar, focusing on her choices, sacrifices, and the prophecy that shaped her destiny."
  },
  { 
    id: '1', 
    title: 'Into the Wild', 
    context: 'The first book in the original series. Firepaw (Rusty) joins ThunderClan.' 
  },
  { 
    id: '2', 
    title: 'Fire and Ice', 
    context: 'Fireheart and Graystripe navigate their new roles as warriors.' 
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [books, setBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem('lumina_books');
    return saved ? JSON.parse(saved) : DEFAULT_BOOKS;
  });
  const [activeBookId, setActiveBookId] = useState<string>(() => {
    const saved = localStorage.getItem('lumina_active_book_id');
    return saved && saved !== 'undefined' ? saved : DEFAULT_BOOKS[0].id;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [newBookTile, setNewBookTitle] = useState('');
  const [newBookContext, setNewBookContext] = useState('');
  const [discussedTopics, setDiscussedTopics] = useState<string[]>(() => {
    const saved = localStorage.getItem('lumina_discussed_topics');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [explainingWord, setExplainingWord] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const chatRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeBook = books.find(b => b.id === activeBookId) || books[0];

  // Persist State
  useEffect(() => {
    localStorage.setItem('lumina_books', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem('lumina_active_book_id', activeBookId);
  }, [activeBookId]);

  useEffect(() => {
    localStorage.setItem('lumina_discussed_topics', JSON.stringify(discussedTopics));
  }, [discussedTopics]);

  // Initialize Chat
  useEffect(() => {
    const discussedString = discussedTopics.length > 0 ? `\n\nALREADY DISCUSSED TOPICS (Avoid these or find new angles): ${discussedTopics.join(', ')}` : '';
    chatRef.current = getGeminiChat(`${SYSTEM_INSTRUCTION}${discussedString}\n\nCurrent Context: We are discussing the book "${activeBook.title}". ${activeBook.context}`);
  }, [activeBookId, books, discussedTopics]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleSendMessage = async (text: string, isSuggestion: boolean = false) => {
    const userMessage: Message = { role: 'user', text };
    if (isSuggestion) {
      setDiscussedTopics(prev => prev.includes(text) ? prev : [...prev, text]);
    }
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setInput('');

    try {
      const result = await chatRef.current.sendMessage({ message: text });
      const modelText = result.text;
      if (modelText) {
        setMessages(prev => [...prev, { role: 'model', text: modelText }]);
        // Automatic TTS for Gemini's response
        speak(modelText);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setError('Gemini is taking too long to respond. Please try again or check your book content size.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
        return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Speech recognition start failed:", err);
        setIsRecording(false);
      }
    }
  };

  const speak = (text: string) => {
    // Strip Phonics tags for speech
    const cleanText = text.replace(/\[\/?\w+\]/g, '');
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Find a UK English Male voice
    const voices = window.speechSynthesis.getVoices();
    const ukMaleVoice = voices.find(v => 
      (v.lang === 'en-GB' && v.name.toLowerCase().includes('male')) ||
      (v.lang === 'en-GB' && v.name.toLowerCase().includes('google'))
    ) || voices.find(v => v.lang === 'en-GB');

    if (ukMaleVoice) {
      utterance.voice = ukMaleVoice;
    }
    
    utterance.lang = 'en-GB';
    utterance.rate = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleWordClick = async (word: string) => {
    setExplainingWord(word);
    setIsExplaining(true);
    setExplanation(null);
    
    try {
      // Use a fresh chat instance for definitions to avoid main conversation pollution
      const dictionaryChat = getGeminiChat("You are a wise Warrior Clan Elder acting as a helpful dictionary. Provide very simple, 1-sentence explanations for children. Do NOT include any meta-talk or follow-up questions.");
      const prompt = `Explain the word "${word}" for an 8-year-old child in 1 simple sentence. Relate it to the Warriors book series if possible. Do NOT use any tags or brackets.`;
      const result = await dictionaryChat.sendMessage({ message: prompt });
      setExplanation(result.text);
    } catch (err) {
      console.error('Explanation error:', err);
      setExplanation("A warrior-level word for our journey!");
    } finally {
      setIsExplaining(false);
    }
  };
  const handleAddBook = () => {
    if (!newBookTile.trim()) return;
    const newBook: Book = {
      id: Date.now().toString(),
      title: newBookTile,
      context: newBookContext
    };
    setBooks(prev => [...prev, newBook]);
    setNewBookTitle('');
    setNewBookContext('');
  };

  const renderMessageContent = (msg: Message, isLast: boolean) => {
    // Both user and model messages should have tags processed
    const messageNode = (
      <div className="text-[15px] font-medium leading-relaxed">
        <PhonicsHighlighter 
          text={msg.role === 'model' ? msg.text.replace(/\n\d\.\s+(.*)/g, '') : msg.text} // Strip paths for model text display
          onWordClick={handleWordClick}
        />
      </div>
    );

    if (msg.role === 'user') {
      return messageNode;
    }

    // Split text into main body and paths
    const pathRegex = /\n\d\.\s+(.*)/g;
    const paths: string[] = [];
    let match;
    const mainText = msg.text.replace(pathRegex, (m, p1) => {
      paths.push(p1.trim());
      return '';
    });

    return (
      <div className="space-y-4">
        <div className="text-[15px] leading-relaxed font-medium">
          <PhonicsHighlighter 
            text={mainText} 
            onWordClick={handleWordClick}
          />
        </div>
        
        {isLast && paths.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-black/5 mt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">Choose your path:</span>
            {paths.map((path, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(path, true)}
                className="text-left px-3 py-2 bg-macaron-yellow/30 hover:bg-macaron-pink/40 border border-black/5 rounded-xl text-xs font-bold text-black transition-all"
              >
                <PhonicsHighlighter text={path} onWordClick={handleWordClick} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-macaron-pink/20 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-20 px-10 flex items-center justify-between border-b border-black/5 bg-white/50 backdrop-blur-sm z-20">
        <div className="flex flex-col">
          <h1 className="font-serif italic font-bold text-2xl text-black leading-tight">
            Lumina
          </h1>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-black/60 mt-0.5">
            Speak your mind. Lumina lights the page.
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-macaron-purple text-black px-4 py-2 rounded-full text-xs font-semibold shadow-sm border border-black/5">
            <span className="w-1.5 h-1.5 bg-black rounded-full" />
            Active Mode: Debate & Analysis
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-black hover:bg-black/5 rounded-full transition-all"
          >
            <RefreshCw size={18} />
          </button>
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-macaron-blue rounded-full flex items-center justify-center font-bold text-black border border-black/5 shadow-inner">🐱</div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-5 p-5 overflow-hidden">
        
        {/* Left Panel: Context & Analysis */}
        <section className="hidden md:flex flex-col bg-white rounded-[24px] p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-black/5 overflow-y-auto bg-macaron-mint/10">
          <div className="flex items-center gap-2 mb-6 text-black font-serif font-bold text-lg">
            <BookOpen size={18} />
            Study Context
          </div>

          <div className="mb-6">
            <label className="text-[10px] uppercase font-bold tracking-wider text-black/60 mb-2 block">Current Book</label>
            <select 
              value={activeBookId}
              onChange={(e) => {
                setActiveBookId(e.target.value);
                setMessages([]); // Reset messages on book change
                setDiscussedTopics([]);
              }}
              className="w-full bg-paper border border-black/10 rounded-xl px-4 py-3 text-sm font-semibold text-black focus:outline-none focus:ring-1 focus:ring-macaron-blue"
            >
              {books.map(book => (
                <option key={book.id} value={book.id}>{book.title}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mb-8">
            <div className="w-14 h-20 bg-macaron-yellow rounded-[4px] shadow-sm flex items-center justify-center text-black/20 border border-black/5">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="font-bold text-[15px] text-black leading-tight">{activeBook.title}</div>
              <div className="text-xs text-black/60 font-medium mt-1">Study Mode Active</div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="bg-paper rounded-xl p-4 border border-black/10">
              <span className="text-[10px] uppercase font-bold tracking-wider text-black/60 mb-1 block">Study Status</span>
              <p className="text-sm font-serif italic text-black">Lumina is ready to listen.</p>
            </div>
          </div>

          {discussedTopics.length > 0 && (
            <div className="space-y-3">
               <span className="text-[10px] uppercase font-bold tracking-wider text-black/60 block">Discussed Topics</span>
               <div className="flex flex-col gap-2">
                 {discussedTopics.map((topic, i) => (
                   <div key={i} className="px-3 py-2 bg-macaron-blue/30 rounded-lg text-xs text-black font-medium border border-black/5 flex items-center gap-2">
                     <div className="w-1 h-1 bg-black rounded-full" />
                     <PhonicsHighlighter text={topic} onWordClick={handleWordClick} />
                   </div>
                 ))}
               </div>
            </div>
          )}

          <div className="mt-auto pt-6 flex flex-wrap gap-2">
            {["Loyalty", "Hero's Journey", "Clan System"].map(tag => (
              <span key={tag} className="px-3 py-1 bg-macaron-lavender rounded-full text-[10px] text-black font-bold uppercase tracking-wider border border-black/5">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Center Panel: Interaction Hub */}
        <section className="flex flex-col bg-white rounded-[24px] shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-black/5 flex-1 overflow-hidden relative">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col items-center">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6">
                <div className="w-32 h-32 bg-macaron-yellow/50 rounded-full border border-black/5 flex items-center justify-center shadow-lg relative group">
                  <div className="absolute inset-x-[-20px] inset-y-[-20px] border border-black/5 rounded-full" />
                  <span className="text-5xl group-hover:scale-110 transition-transform">🐱</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-serif font-bold text-black italic tracking-tight uppercase">Lumina is waiting...</h2>
                  <p className="text-black text-sm font-medium leading-relaxed px-4">
                    "Amelia, what new part of the forest have you explored today? Tell me the latest story you read!"
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Was Bluestar right to sacrifice everything for the Clan?",
                    "Should the Warrior Code ever be broken for love?",
                    "Was Thistleclaw's ambition a strength or a curse?"
                  ].map((suggestion) => (
                    <button 
                      key={suggestion}
                      onClick={() => handleSendMessage(suggestion, true)}
                      className="px-4 py-2 rounded-full border border-black/5 bg-macaron-blue/30 text-[11px] font-bold text-black hover:bg-macaron-pink hover:text-black transition-all shadow-sm max-w-[280px]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full space-y-6 mb-24">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={cn(
                    "max-w-[85%] p-5 shadow-sm border border-black/5",
                    msg.role === 'user' 
                      ? "bg-macaron-blue text-black rounded-[24px] rounded-br-[4px]" 
                      : "bg-white text-black rounded-[24px] rounded-bl-[4px]"
                  )}>
                    {renderMessageContent(msg, i === messages.length - 1)}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-paper border border-black/5 rounded-full px-6 py-4 shadow-sm">
                    <Loader2 className="animate-spin text-black" size={20} />
                  </div>
                </div>
              )}
              {error && (
                <div className="flex flex-col items-center justify-center p-6 gap-3">
                  <p className="text-xs text-red-500 font-bold bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-center max-w-xs">
                    {error}
                  </p>
                  <button 
                    onClick={() => handleSendMessage(messages[messages.length - 1]?.text || "Hello", false)}
                    className="text-[10px] font-bold uppercase tracking-widest text-black underline underline-offset-4 hover:opacity-70"
                  >
                    Retry Last Message
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Interaction Bar */}
          <div className="p-6 bg-gradient-to-t from-white via-white to-transparent">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(input, false)}
                  placeholder="Share your thoughts with Lumina..."
                  className="w-full bg-white rounded-full px-8 py-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-macaron-yellow border border-black/5 shadow-sm text-black"
                />
                <button 
                  onClick={() => handleSendMessage(input, false)}
                  disabled={!input.trim()}
                  className="absolute right-2 top-2 w-10 h-10 bg-macaron-yellow rounded-full flex items-center justify-center text-black disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-sm border border-black/5"
                >
                  <Send size={16} />
                </button>
              </div>

              <button 
                onClick={toggleRecording}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95",
                  isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white text-black border border-black/10"
                )}
              >
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button 
                onClick={() => {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isSpeaking ? "bg-black/10 text-black" : "bg-paper text-black"
                )}
              >
                {isSpeaking ? <Volume2 size={18} className="animate-bounce" /> : <VolumeX size={18} />}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl border border-black/10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-serif font-bold text-black">Manage Library</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-paper rounded-full"
                >
                  <VolumeX size={20} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-black uppercase tracking-widest pl-2">Add New Book</label>
                  <input
                    type="text"
                    value={newBookTile}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    placeholder="Book Title"
                    className="w-full bg-paper rounded-2xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-black border-none text-black"
                  />
                  
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setNewBookContext(ev.target?.result as string);
                            setNewBookTitle(file.name.replace('.txt', ''));
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                      id="book-upload"
                    />
                    <label 
                      htmlFor="book-upload"
                      className="flex items-center justify-center gap-2 w-full bg-paper border border-dashed border-black/20 rounded-2xl py-6 cursor-pointer hover:bg-black/5 transition-all text-black font-medium"
                    >
                      <BookOpen size={20} />
                      <span>Upload .txt Book (Recommended)</span>
                    </label>
                  </div>

                  <p className="text-[10px] text-black/60 italic px-2">
                    Tip: Convert your .epub to .txt for the most reliable teaching context.
                  </p>

                  <textarea
                    value={newBookContext}
                    onChange={(e) => setNewBookContext(e.target.value)}
                    placeholder="Or paste book content here..."
                    rows={4}
                    className="w-full bg-paper rounded-2xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-black border-none resize-none text-black"
                  />
                  <button 
                    onClick={handleAddBook}
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    Add to Library
                  </button>
                </div>

                <div className="pt-6 border-t border-paper text-black">
                   <label className="text-xs font-bold uppercase tracking-widest pl-2">Current Collection</label>
                   <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {books.map(book => (
                        <div key={book.id} className="bg-paper p-4 rounded-2xl flex items-center justify-between group">
                          <div>
                            <p className="text-sm font-bold text-black">{book.title}</p>
                            <p className="text-[10px] text-black/60 truncate max-w-[200px]">{book.context}</p>
                          </div>
                          {books.length > 1 && (
                            <button 
                              onClick={() => {
                                setBooks(prev => prev.filter(b => b.id !== book.id));
                                if (activeBookId === book.id) setActiveBookId(books[0].id);
                              }}
                              className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <VolumeX size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word Explanation Modal */}
      <AnimatePresence>
        {explainingWord && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExplainingWord(null)}
            className="fixed inset-0 bg-black/5 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl border border-black/10 text-center"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-full mb-4">
                <Sparkles size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-serif font-bold text-black mb-2 uppercase tracking-widest">{explainingWord}</h3>
              <div className="h-px w-12 bg-black/10 mx-auto mb-4" />
              
              {isExplaining ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 size={24} className="animate-spin text-black/40" />
                  <span className="text-[10px] font-bold uppercase text-black/40 tracking-wider">Seeking knowledge...</span>
                </div>
              ) : (
                <div className="text-sm font-medium leading-relaxed text-black/80 mb-6">
                  <PhonicsHighlighter text={explanation || ''} />
                </div>
              )}
              
              <button 
                onClick={() => setExplainingWord(null)}
                className="w-full bg-black text-white rounded-full py-3 text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Return to Battle
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .dashed-border {
          border-style: dashed;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
