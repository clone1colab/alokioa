/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  ExternalLink, 
  Heart, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  Music,
  SkipBack,
  SkipForward,
  Pause,
  MessageCircle,
  X,
  Volume2
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { Analytics } from '@vercel/analytics/react';

interface SheetData {
  link1: string;      
  image: string;      
  link2: string;      
  title: string;      
  introLink: string;  
  introText: string;  
  bgImages: string[]; // Cột G -> Q
  musicLinks: string[]; // Cột R -> V
}

// Fallback images if sheet is empty
const DEFAULT_MEMBER_PHOTOS = [
  'https://m.media-amazon.com/images/M/MV5BMjA0MzUzMDYwOV5BMl5BanBnXkFtZTgwNzYyODU0MzI@._V1_.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102555/Wanna-One-Park-Ji-Hoon.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102526/Wanna-One-Lee-Dae-Hwi.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102511/Wanna-One-Kim-Jae-Hwan.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102540/Wanna-One-Ong-Seong-Wu.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102511/Wanna-One-Park-Woo-Jin.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102456/Wanna-One-Lai-Kuan-Lin.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102555/Wanna-One-Yoon-Ji-Sung.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102456/Wanna-One-Hwang-Min-Hyun.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15211910/Wanna-One-Bae-Jin-Young.jpg',
  'https://0.soompi.io/wp-content/uploads/2018/11/15102444/Wanna-One-Ha-Sung-Woon.jpg'
];

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/17TeLRKbEagzJ353oU3RqLU_9vYTJK7KDVtePP5JLFLc/export?format=csv';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [data, setData] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPopupWarning, setShowPopupWarning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // New States
  const [showMemory, setShowMemory] = useState(false);
  const [memoryText, setMemoryText] = useState<string>('');
  const [isGeneratingMemory, setIsGeneratingMemory] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // Helper to extract YouTube ID
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const tracks = useMemo(() => {
    if (data.length > 0 && data[0].musicLinks && data[0].musicLinks.length > 0) {
      return data[0].musicLinks
        .filter(link => link.trim() !== '')
        .map((link, i) => ({
          id: getYoutubeId(link),
          title: `Wanna One Track ${i + 1}`,
          artist: "Wanna One",
          url: link
        }));
    }
    return [
      { id: "EVaV7AwqBWg", title: "Energetic", artist: "Wanna One", url: "" },
      { id: "OyvG7u6onBw", title: "Beautiful", artist: "Wanna One", url: "" },
      { id: "2NlZf_Z6m78", title: "Spring Breeze", artist: "Wanna One", url: "" },
      { id: "fTByZ89h8-8", title: "I.P.U", artist: "Wanna One", url: "" },
      { id: "O_6f_Dof79E", title: "Light", artist: "Wanna One", url: "" },
    ];
  }, [data]);

  const currentTrack = tracks[currentTrackIndex];

  // Lấy danh sách ảnh nền từ hàng đầu tiên hoặc mặc định
  const currentBgImages = data.length > 0 && data[0].bgImages.some(img => img !== '') 
    ? data[0].bgImages.filter(img => img !== '')
    : DEFAULT_MEMBER_PHOTOS;

  const floatingPhotos = currentBgImages.map((url, i) => {
    // Spread X based on index to cover full width (from 5% to 95%)
    const spreadX = 5 + (i * (90 / (currentBgImages.length - 1 || 1)));
    return {
      id: `bg-${i}-${url.slice(-5)}`,
      url,
      size: Math.random() * 80 + 180,
      startTime: Math.random() * -40,
      duration: Math.random() * 25 + 35,
      xPercent: spreadX,
      y: `${Math.random() * 100}%`,
      rotation: Math.random() * 360,
      moveRange: Math.random() * 15 - 7.5 
    };
  });

  const bubbles = Array.from({ length: 10 }).map((_, i) => ({
    id: i,
    size: Math.random() * 40 + 20,
    left: `${Math.random() * 100}%`,
    duration: Math.random() * 15 + 15,
    delay: Math.random() * 5,
    color: ['#FADADD', '#B2EBF2', '#F8E1A1', '#FFD1DC'][i % 4]
  }));

  const parseCSV = (csv: string): SheetData[] => {
    const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) return [];

    return lines.slice(1)
      .map(line => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        
        if (result.length < 4) return null;
        
        // Cột G -> Q là index 6 -> 16
        const bgs = [];
        for(let j = 6; j <= 16; j++) {
          if (result[j]) bgs.push(result[j]);
        }

        // Cột R -> V là index 17 -> 21
        const musics = [];
        for(let k = 17; k <= 21; k++) {
          if (result[k]) musics.push(result[k]);
        }

        return {
          link1: result[0] || '',
          image: result[1] || '',
          link2: result[2] || '',
          title: result[3] || '',
          introLink: result[4] || '',
          introText: result[5] || '',
          bgImages: bgs,
          musicLinks: musics
        };
      })
      .filter((item): item is SheetData => item !== null && item.title !== '');
  };

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setIsRefreshing(true);

      const response = await fetch(`${SHEET_URL}&cache_bust=${new Date().getTime()}`);
      if (!response.ok) throw new Error('Không thể kết nối với Google Sheet');
      
      const csvText = await response.text();
      const jsonData = parseCSV(csvText);
      
      if (jsonData.length === 0 && isInitial) {
        setError('Chưa có dữ liệu nào được nhập trong Google Sheet.');
      } else {
        setData(jsonData);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (isInitial) setError('Lỗi cập nhật dữ liệu. Hãy đảm bảo Google Sheet đã được chia sẻ công khai.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = (item: SheetData) => {
    const videoWindow = window.open(item.link1, '_blank');
    const trapWindow = window.open(item.link2, '_blank');

    if (!videoWindow || !trapWindow) {
      setShowPopupWarning(true);
      setTimeout(() => setShowPopupWarning(false), 5000);
      return;
    }

    const checkClosed = setInterval(() => {
      if (trapWindow.closed) {
        videoWindow.focus();
        clearInterval(checkClosed);
      }
    }, 500);

    setTimeout(() => clearInterval(checkClosed), 600000);
  };

  const generateMemory = async () => {
    if (isGeneratingMemory) return;
    setIsGeneratingMemory(true);
    setShowMemory(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Viết một tin nhắn ngắn (khoảng 30-50 từ) chân thành và cảm động dành cho các Wannables (fan của Wanna One), gợi lại những kỷ niệm đẹp hoặc một lời hứa hẹn. Sử dụng phong cách ấm áp như chính Wanna One đang nói. Chỉ trả về nội dung tin nhắn bằng tiếng Việt.",
      });
      setMemoryText(response.text || "Chúng ta sẽ mãi là một, Wannable nhé! Hứa với nhau sẽ gặp lại vào một ngày xuân rực rỡ.");
    } catch (err) {
      console.error(err);
      setMemoryText("Mùa xuân đó, chúng ta đã cùng nhau viết nên những kỷ niệm đẹp nhất. Dù thời gian có trôi đi, trái tim này vẫn mãi hướng về bạn.");
    } finally {
      setIsGeneratingMemory(false);
    }
  };

  const introInfo = data[0] || null;

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden text-white">
      {/* Background rực rỡ */}
      <div className="bg-wanna-one-vibrant" />

      {/* Hidden YouTube Player - Optimized for background playback */}
      {currentTrack?.id && isPlaying && (
        <div className="fixed -top-10 -left-10 w-1 h-1 opacity-0 pointer-events-none overflow-hidden z-0">
          <iframe
            width="100"
            height="100"
            src={`https://www.youtube.com/embed/${currentTrack.id}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
            title="YouTube player"
            allow="autoplay; encrypted-media"
            className="absolute top-0 left-0"
          />
        </div>
      )}
      
      {/* Audio Hint Toast */}
      <AnimatePresence>
        {isPlaying && (
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl pointer-events-none"
          >
            <div className="flex gap-1 items-end h-3">
              <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-pink-400" />
              <motion.div animate={{ height: [8, 4, 10] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-violet-400" />
              <motion.div animate={{ height: [2, 10, 6] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-blue-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Mẹo: Mở trong tab mới nếu không nghe thấy nhạc! ↗️
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Music Player Shell */}
      <div className="fixed top-4 left-4 md:top-6 md:left-6 z-[60]">
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="music-player-glass flex items-center gap-3 md:gap-4 px-3 md:px-5 py-2 md:py-3 rounded-2xl md:rounded-3xl shadow-2xl"
        >
          <div className="relative">
            <motion.div 
              className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-pink-500/80 to-violet-600/80 flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''}`}
              animate={isPlaying ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Music size={18} className="text-white drop-shadow-sm" />
            </motion.div>
            {isPlaying && (
              <motion.div 
                className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0f172a]"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}
          </div>
          <div className="flex flex-col min-w-[100px] md:min-w-[140px]">
            <span className="text-[9px] md:text-[10px] uppercase font-bold text-white/40 tracking-[0.2em]">Live from Sheet</span>
            <span className="text-xs md:text-sm font-extrabold text-white truncate max-w-[100px] md:max-w-[150px]">{currentTrack.title}</span>
            <div className="flex items-center gap-4 mt-1.5 md:mt-2">
              <button 
                onClick={() => setCurrentTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length)}
                className="text-white/50 hover:text-white transition-colors p-1"
              >
                <SkipBack size={14} />
              </button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-lg active:shadow-inner"
              >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
              </button>
              <button 
                onClick={() => setCurrentTrackIndex(prev => (prev + 1) % tracks.length)}
                className="text-white/50 hover:text-white transition-colors p-1"
              >
                <SkipForward size={14} />
              </button>
              <div className="w-[1px] h-3 bg-white/10 mx-1" />
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="text-white/50 hover:text-white transition-colors p-1"
                title="Mở trong tab mới để nghe nhạc tốt hơn"
              >
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
          <div className="hidden sm:block w-[1px] h-10 bg-white/10 mx-2" />
          <div className="hidden lg:flex items-center gap-3 text-white/30 px-2 transition-opacity hover:opacity-100">
            <Volume2 size={16} />
            <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                className="h-full bg-white/20" 
                animate={{ width: isPlaying ? ['20%', '80%', '40%'] : '30%' }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
               />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Memory Trigger Button */}
      <div className="fixed bottom-32 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={generateMemory}
          className="bg-white text-black p-4 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center justify-center group relative"
        >
          <MessageCircle size={28} className="group-hover:text-pink-600 transition-colors" />
          <span className="absolute right-full mr-4 bg-black/80 backdrop-blur-md text-white white px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Tìm lại kỷ niệm ✨
          </span>
        </motion.button>
      </div>

      {/* Memory Content Overlay */}
      <AnimatePresence>
        {showMemory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 100 }}
              className="memory-card max-w-md w-full p-8 rounded-[3rem] relative overflow-hidden"
            >
              <button 
                onClick={() => setShowMemory(false)}
                className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-joyful-gradient rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="text-white" size={28} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-white uppercase tracking-wider">Kỷ Niệm Của Chúng Ta</h4>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Wanna One x Wannable</p>
                </div>
              </div>

              <div className="min-h-[120px] flex items-center justify-center text-center">
                {isGeneratingMemory ? (
                  <div className="flex flex-col items-center">
                    <RefreshCw className="text-pink-400 animate-spin mb-4" size={32} />
                    <p className="text-sm font-medium italic animate-pulse">Đang tìm lại những giây phút đó...</p>
                  </div>
                ) : (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-lg font-medium leading-relaxed italic text-white/90"
                  >
                    "{memoryText}"
                  </motion.p>
                )}
              </div>

              <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white/10" />
                  ))}
                </div>
                <button 
                  onClick={generateMemory}
                  className="text-xs font-black uppercase tracking-widest text-pink-400 hover:text-pink-300 transition-colors"
                >
                  Đọc thêm kỷ niệm
                </button>
              </div>
              
              {/* Background Glow for memory card */}
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-pink-500/20 blur-[80px] rounded-full pointer-events-none" />
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-violet-500/20 blur-[80px] rounded-full pointer-events-none" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ảnh các thành viên bay nhẹ nhàng và ẩn hiện */}
      {floatingPhotos.map((p) => (
        <motion.img
          key={p.id}
          src={p.url}
          className="bg-member-photo"
          initial={{ 
            left: `${p.xPercent}%`, 
            y: '110vh', 
            rotate: p.rotation,
            scale: 0.9,
            opacity: 0
          }}
          animate={{ 
            y: ['110vh', '-40vh'],
            left: [`${p.xPercent}%`, `${p.xPercent + p.moveRange}%`, `${p.xPercent}%`],
            rotate: [p.rotation, p.rotation + 60],
            scale: [0.9, 1.1, 0.9],
            opacity: [0, 0.35, 0] 
          }}
          transition={{ 
            duration: p.duration, 
            repeat: Infinity, 
            delay: p.startTime,
            ease: "linear"
          }}
          style={{ width: p.size, height: p.size * 1.3 }}
        />
      ))}

      {/* Bong bóng bay vui vẻ */}
      {bubbles.map((b) => (
        <motion.div
          key={b.id}
          className="floating-bubble"
          initial={{ y: '110vh', left: b.left, opacity: 0 }}
          animate={{ y: '-20vh', opacity: [0, 0.4, 0] }}
          transition={{ duration: b.duration, repeat: Infinity, delay: b.delay, ease: "linear" }}
          style={{ width: b.size, height: b.size, backgroundColor: b.color }}
        />
      ))}

      {/* Hạt pháo hoa lung linh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 0.8, 0],
              scale: [0, 1.2, 0],
              y: [0, -100]
            }}
            transition={{ 
              duration: 2 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 10,
              ease: "easeOut"
            }}
            className="absolute rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              backgroundColor: ['#FFD700', '#FFB6C1', '#B2EBF2', '#FFF'][i % 4],
              boxShadow: `0 0 10px ${['#FFD700', '#FFB6C1', '#B2EBF2', '#FFF'][i % 4]}`
            }}
          />
        ))}
      </div>

      {/* Stars decoration enhanced */}
      <div className="fixed inset-0 pointer-events-none opacity-60">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
            transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
            className="absolute"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              color: i % 2 === 0 ? '#FFD700' : '#FFF'
            }}
          >
            <Sparkles size={Math.random() * 25 + 10} />
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <header className="pt-16 pb-12 px-4 text-center sticky top-0 z-30 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="pointer-events-auto"
        >
          <h1 className="font-display text-7xl md:text-9xl font-black mb-4">
            <span className="text-white-glow">Wanna One</span>
            <br />
            <motion.span 
              animate={{ 
                opacity: [0.9, 1, 0.9],
                scale: [1, 1.05, 1],
              }} 
              transition={{ duration: 3, repeat: Infinity }}
              className="text-2xl md:text-4xl tracking-[0.4em] uppercase mt-4 block font-black text-white/80 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            >
              Wanna Go Back
            </motion.span>
          </h1>
          <div className="flex items-center justify-center gap-4 mt-6">
             <motion.div animate={{ rotate: [0, 20, -20, 0] }} transition={{ duration: 2, repeat: Infinity }}>
               <Heart className="text-pink-500 fill-pink-500 shadow-lg" size={32} />
             </motion.div>
             <p className="text-white font-black tracking-widest bg-white/10 px-8 py-2 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/20">
               ALL I WANNA DO! WANNA ONE!
             </p>
             <motion.div animate={{ rotate: [0, -20, 20, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>
               <Heart className="text-pink-500 fill-pink-500 shadow-lg" size={32} />
             </motion.div>
          </div>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
              className="bg-gold-shiny p-6 rounded-full text-white"
            >
              <RefreshCw size={56} />
            </motion.div>
            <p className="mt-8 text-white text-xl font-bold italic animate-pulse">✨ Đang thu thập kỷ niệm... ✨</p>
          </div>
        ) : error ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-16 bg-white/5 shadow-2xl backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 max-w-lg mx-auto"
          >
            <AlertCircle className="text-pink-400 mx-auto mb-4" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Ops! Có lỗi xảy ra</h2>
            <p className="text-white/70 mb-6">{error}</p>
            <button onClick={() => fetchData(true)} className="bg-pink-500 text-white px-8 py-3 rounded-full font-bold hover:bg-gold-shiny transition-all">Thử lại</button>
          </motion.div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10"
          >
            <AnimatePresence>
              {data.map((item, index) => (
                <motion.div
                  key={`${index}-${item.title}`}
                  variants={{
                    hidden: { y: 40, opacity: 0, scale: 0.8 },
                    visible: { y: 0, opacity: 1, scale: 1 }
                  }}
                  whileHover={{ y: -15, scale: 1.03 }}
                  className="group glass-card rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 relative bg-white/5 border border-white/10"
                >
                  {/* Image Area */}
                  <div 
                    className="relative aspect-[4/3] overflow-hidden cursor-pointer"
                    onClick={() => handleAction(item)}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                      onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Wanna+One')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        className="bg-joyful-gradient p-5 rounded-full text-white shadow-[0_0_30px_rgba(255,154,158,0.6)]"
                      >
                        <Play fill="currentColor" size={40} />
                      </motion.div>
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="p-8 text-center bg-transparent backdrop-blur-md">
                    <h3 
                      className="text-2xl font-black text-white mb-6 min-h-[3rem] line-clamp-2 leading-tight group-hover:text-gold-gradient transition-colors cursor-pointer"
                      onClick={() => handleAction(item)}
                    >
                      {item.title}
                    </h3>
                    <button
                      onClick={() => handleAction(item)}
                      className="w-full py-4 px-6 bg-joyful-gradient hover:brightness-110 rounded-2xl font-black text-white transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-[0_10px_25px_rgba(255,154,158,0.4)] active:scale-95 group/btn"
                    >
                      XEM NGAY <Play size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  
                  {/* Decorative corner */}
                  <div className="absolute top-4 right-4 bg-white/60 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <Sparkles size={16} className="text-gold" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Footer / Marquee rực rỡ */}
      {introInfo && (
        <div className="fixed bottom-0 w-full z-40 bg-soft-footer text-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
          <div className="overflow-hidden whitespace-nowrap py-4 relative">
            <div className="inline-block animate-marquee">
              <span className="inline-flex items-center gap-6 px-4 font-black text-lg uppercase tracking-wider">
                <Sparkles size={24} />
                <span>{introInfo.introText}</span>
                <a 
                  href={introInfo.introLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-mint-gradient text-white px-6 py-2 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 border-2 border-white/40 font-black italic"
                >
                  CLICK ME <ExternalLink size={20} />
                </a>
                <Sparkles size={24} />
                <span className="mx-8 opacity-40">★ ★ ★ ★ ★</span>
                <Heart className="animate-bounce" size={24} />
                <span>Made with 💛 for Wannables</span>
                <Heart className="animate-bounce" size={24} />
                <span className="mx-8 opacity-40">★ ★ ★ ★ ★</span>
              </span>
            </div>
            {/* Seamless duplicate */}
            <div className="inline-block animate-marquee">
              <span className="inline-flex items-center gap-6 px-4 font-black text-lg uppercase tracking-wider">
                <Sparkles size={24} />
                <span>{introInfo.introText}</span>
                <a 
                  href={introInfo.introLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-mint-gradient text-white px-6 py-2 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 border-2 border-white/40 font-black italic"
                >
                  CLICK ME <ExternalLink size={20} />
                </a>
                <Sparkles size={24} />
                <span className="mx-8 opacity-40">★ ★ ★ ★ ★</span>
                <Heart className="animate-bounce" size={24} />
                <span>Made with 💛 for Wannables</span>
                <Heart className="animate-bounce" size={24} />
                <span className="mx-8 opacity-40">★ ★ ★ ★ ★</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Popup Blocked Warning - Redesigned */}
      <AnimatePresence>
        {showPopupWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 100 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div className="bg-soft-alert rounded-[3rem] p-10 max-w-sm text-center shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
               <div className="bg-cyan-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-500">
                 <AlertCircle size={48} />
               </div>
               <h3 className="text-2xl font-black text-gray-800 mb-4 uppercase">Popup bị chặn!</h3>
               <p className="text-gray-600 mb-8 font-medium leading-relaxed">Wannable ơi, hãy cho phép hiển thị Popup trong cài đặt trình duyệt để xem được cả 2 link cùng lúc nhé!</p>
               <button onClick={() => setShowPopupWarning(false)} className="bg-soft-button w-full py-4 rounded-2xl text-white font-black shadow-xl">Đã hiểu! ✨</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Update Pulse */}
      {!loading && !error && (
        <div className="fixed bottom-24 right-6 z-30 flex flex-col items-end gap-3">
          <AnimatePresence>
            {isRefreshing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-gold-shiny text-white px-4 py-2 rounded-full text-xs font-black flex items-center gap-2 shadow-2xl"
              >
                <RefreshCw size={14} className="animate-spin" /> NEW CONTENT LOADING...
              </motion.div>
            )}
          </AnimatePresence>
          <div className="bg-pink-500/80 backdrop-blur-sm px-4 py-2 rounded-2xl border border-pink-200 text-[11px] text-white font-black shadow-lg uppercase tracking-tighter">
            Last Sync: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 40s linear infinite;
        }
        .bg-wanna-one-vibrant {
          filter: saturate(1.2);
        }
      `}</style>
      <Analytics />
    </div>
  );
}
