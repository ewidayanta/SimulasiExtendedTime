/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Menu, 
  HelpCircle, 
  Bell, 
  Check, 
  ChevronDown, 
  User, 
  Minus, 
  Plus, 
  ChevronUp,
  Settings,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Utils
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('IDR', 'Rp');
};

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function App() {
  // --- Simulation State ---
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); 
  const timeLeftRef = React.useRef(timeLeft);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  const [isSimulationOpen, setIsSimulationOpen] = useState(true); // Open control panel by default if not started
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(5);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [incrementAmount, setIncrementAmount] = useState(1000000); // Default increment 1jt
  const [bidLimit, setBidLimit] = useState(100000000); // Default limit 100jt
  const [participantCount, setParticipantCount] = useState(5);
  const [bidFrequency, setBidFrequency] = useState(5); // Default bid every 5 seconds
  
  // --- Extended Mode State ---
  const [isExtendedEnabled, setIsExtendedEnabled] = useState(true);
  const [extended1Input, setExtended1Input] = useState(60); // Default 60s
  const [extended2Input, setExtended2Input] = useState(30); // Default 30s
  const [extendedPhase, setExtendedPhase] = useState(0); // 0: Main, 1: Ext 1, 2: Ext 2
  const biddersInLast10Sec = React.useRef<Set<string>>(new Set());
  const bidsInLast2MinutesNormal = React.useRef(0);
  const bidsInExtended1 = React.useRef(0);
  const [allowedBidders, setAllowedBidders] = useState<string[]>([]);

  // Get top N unique bidders helper
  const getTopUniqueBidders = (n: number, currentBids = bids) => {
    const unique = new Set<string>();
    const result: string[] = [];
    for (const b of currentBids) {
      if (!unique.has(b.user)) {
        unique.add(b.user);
        result.push(b.user);
        if (result.length === n) break;
      }
    }
    return result;
  };
  
  // --- Auction State ---
  const [bids, setBids] = useState<{id: number, amount: number, user: string, time: string, phase: number}[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [winner, setWinner] = useState<{user: string, amount: number} | null>(null);
  
  // Track the absolute last bid amount placed by the user to ensure it persists
  const [userLastBidAmount, setUserLastBidAmount] = useState<number | null>(null);
  
  const [myBidAmount, setMyBidAmount] = useState(0);
  const [pendingBidAmount, setPendingBidAmount] = useState(0);
  const [pin, setPin] = useState('');
  const [isLotDetailsOpen, setIsLotDetailsOpen] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLowBidModal, setShowLowBidModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [ping, setPing] = useState(25);

  const lastBotBidTime = React.useRef(0);

  // Ping simulation logic
  useEffect(() => {
    if (!isSimulationActive) {
      setPing(0);
      return;
    }
    const interval = setInterval(() => {
      // Simulate realistic fluctuation
      setPing(prev => {
        const base = Math.random() > 0.9 ? 80 : 25; // Occasional spike
        const flicker = Math.floor(Math.random() * 15);
        return base + flicker;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isSimulationActive]);

  // Timer logic
  useEffect(() => {
    if (!isSimulationActive) return;

    if (timeLeft === 0) {
      if (isExtendedEnabled) {
        if (extendedPhase === 0) {
          // Rule: "apabila 2 menit sebelum penutupan diwaktu normal ada lebih dari 1 penawaran maka akan lanjut di extended 1 dengan peserta 3 penawar teratas."
          if (bidsInLast2MinutesNormal.current >= 2) {
            setExtendedPhase(1);
            setTimeLeft(extended1Input);
            const top3 = getTopUniqueBidders(3);
            setAllowedBidders(top3);
            return;
          }
        } else if (extendedPhase === 1) {
          // Rule: "apabila di waktu extended 1 tersebut masih banyak penawaran maka 2 peserta teratas akan masuk ke extended 2. kl di extended 1 tidak ada yang menawar maka pemenangnya adalah penawaran tertinggi diwaktu normal"
          if (bidsInExtended1.current >= 1) {
            setExtendedPhase(2);
            setTimeLeft(extended2Input);
            const top2 = getTopUniqueBidders(2);
            setAllowedBidders(top2);
            return;
          } else {
            // End of Extended 1 with NO bids: winner is highest bidder from normal/main phase (phase === 0)
            const normalBids = bids.filter(b => b.phase === 0);
            const finalWinner = normalBids[0] ? { user: normalBids[0].user, amount: normalBids[0].amount } : null;
            setWinner(finalWinner);
            setIsFinished(true);
            setIsSimulationActive(false);
            return;
          }
        }
      }
      
      // Final End for Phase 2 or when extended mode is disabled/not triggered
      const finalWinner = bids[0] ? { user: bids[0].user, amount: bids[0].amount } : null;
      setWinner(finalWinner);
      setIsFinished(true);
      setIsSimulationActive(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, isSimulationActive, isExtendedEnabled, extendedPhase, extended1Input, extended2Input, bids]);

  // Auto-bidder simulation logic
  useEffect(() => {
    if (!isSimulationActive || participantCount <= 0) return;
    
    const interval = setInterval(() => {
      const currentT = timeLeftRef.current;
      if (currentT <= 0) return;

      const now = Date.now();
      const isInLast10 = currentT <= 10;
      
      // Logic:
      // If extended is on and in last 10s, bots become aggressive (every 2-3s)
      // Otherwise use the bidFrequency
      const effectiveFreq = (isInLast10 && isExtendedEnabled) ? 3000 : (bidFrequency * 1000);
      
      if (now - lastBotBidTime.current < effectiveFreq) return;
      
      // Randomly decide if a participant bids 
      const bidChance = isInLast10 && isExtendedEnabled ? 0.7 : 0.4;
      if (Math.random() < bidChance) {
        lastBotBidTime.current = now;

        // Determine participant name based on phase rules
        let participantName = '';
        if (extendedPhase > 0) {
          // Only bots that are in allowedBidders can place automatic bids
          const availableBots = allowedBidders.filter(u => u !== 'Anda');
          if (availableBots.length === 0) return; // No eligible bots to simulate
          participantName = availableBots[Math.floor(Math.random() * availableBots.length)];
        } else {
          const participantIndex = Math.floor(Math.random() * participantCount);
          participantName = `User ${String.fromCharCode(66 + participantIndex)}`;
        }

        setBids(prev => {
          const highestBid = prev[0]?.amount || 0;
          
          let newAmount;
          if (prev.length === 0) {
            newAmount = bidLimit;
          } else {
            const randomSteps = Math.floor(Math.random() * 2) + 1;
            newAmount = highestBid + (incrementAmount * randomSteps);
          }
          
          // Track activity for transitions
          if (extendedPhase === 0 && currentT <= 120) {
            bidsInLast2MinutesNormal.current += 1;
          } else if (extendedPhase === 1) {
            bidsInExtended1.current += 1;
          }
          
          if (currentT <= 10) {
            biddersInLast10Sec.current.add(participantName);
          }

          const newBid = {
            id: Date.now(),
            amount: newAmount,
            user: participantName,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            phase: extendedPhase,
          };
          
          setMyBidAmount(current => current <= newAmount ? newAmount + incrementAmount : current);
          return [newBid, ...prev].sort((a, b) => b.amount - a.amount);
        });
      }
    }, 1000); 
    
    return () => clearInterval(interval);
  }, [participantCount, bidLimit, incrementAmount, bidFrequency, isSimulationActive, isExtendedEnabled, extendedPhase, allowedBidders]);

  const handleLaunch = () => {
    const totalSeconds = (inputHours * 3600) + (inputMinutes * 60) + inputSeconds;
    setTimeLeft(totalSeconds);
    setExtendedPhase(0);
    biddersInLast10Sec.current.clear();
    bidsInLast2MinutesNormal.current = 0;
    bidsInExtended1.current = 0;
    setAllowedBidders([]);
    setIsFinished(false);
    setWinner(null);
    lastBotBidTime.current = 0;
    
    // Reset auction: Start with empty bids to let simulation feel more "real"
    setBids([]);
    setUserLastBidAmount(null);
    setMyBidAmount(bidLimit);
    setIsSimulationOpen(false);
    setIsSimulationActive(true);
  };

  const handleSetTime = () => {
    const totalSeconds = (inputHours * 3600) + (inputMinutes * 60) + inputSeconds;
    setTimeLeft(totalSeconds);
    setIsSimulationOpen(false);
  };

  const submitBid = () => {
    if (timeLeft <= 0) return;
    if (pin !== '123') {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
      return;
    }

    if (extendedPhase > 0 && !allowedBidders.includes('Anda')) {
      alert(`Maaf, Anda tidak termasuk dalam ${extendedPhase === 1 ? '3' : '2'} penawar teratas yang berhak mengikuti fase Extended ${extendedPhase}.`);
      return;
    }

    const highestBid = bids[0]?.amount || 0;
    if (myBidAmount <= highestBid) {
      setPendingBidAmount(myBidAmount);
      setShowLowBidModal(true);
      return;
    }
    
    setPendingBidAmount(myBidAmount);
    setShowConfirmModal(true);
  };

  const confirmBid = () => {
    if (timeLeft <= 0) {
      setShowConfirmModal(false);
      return;
    }

    if (extendedPhase > 0 && !allowedBidders.includes('Anda')) {
      alert(`Maaf, Anda tidak termasuk dalam ${extendedPhase === 1 ? '3' : '2'} penawar teratas yang berhak mengikuti fase Extended ${extendedPhase}.`);
      setShowConfirmModal(false);
      return;
    }

    const highestBid = bids[0]?.amount || 0;
    if (pendingBidAmount <= highestBid) {
      setShowConfirmModal(false);
      setShowLowBidModal(true);
      return;
    }

    const newBid = {
      id: Date.now(),
      amount: pendingBidAmount,
      user: 'Anda',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      phase: extendedPhase,
    };
    
    if (extendedPhase === 0 && timeLeft <= 120) {
      bidsInLast2MinutesNormal.current += 1;
    } else if (extendedPhase === 1) {
      bidsInExtended1.current += 1;
    }

    // Track bidder if in last 10 seconds
    if (timeLeft <= 10) {
      biddersInLast10Sec.current.add('Anda');
    }
    
    // Sort and keep highest at top
    const updatedBids = [newBid, ...bids].sort((a, b) => b.amount - a.amount);
    setBids(updatedBids);
    
    // Automatically set next bid amount to be ready for next turn
    setUserLastBidAmount(pendingBidAmount);
    setMyBidAmount(pendingBidAmount + incrementAmount);
    
    setPin('');
    setShowConfirmModal(false);
    setShowSuccessModal(true);
  };

  // Handle auto-close for success modal
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showSuccessModal) {
      timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showSuccessModal]);

  const adjustBid = (multiplier: number) => {
    const highestBid = bids[0]?.amount || 0;
    setMyBidAmount(prev => {
      // Ensure we are always at least one increment above highest bid
      const nextValidMin = highestBid + incrementAmount;
      
      if (multiplier > 0) {
        // If adding and current value is below next valid minimum, jump to it
        if (prev < nextValidMin) {
          return nextValidMin + (incrementAmount * (multiplier - 1));
        }
        return prev + (incrementAmount * multiplier);
      } else {
        // If subtracting, don't go below the next valid minimum
        const result = prev + (incrementAmount * multiplier);
        return Math.max(nextValidMin, result);
      }
    });
  };

  const isUserBlockedFromBidding = timeLeft <= 0 || (extendedPhase > 0 && !allowedBidders.includes('Anda'));

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Ticker / Running Text Notification */}
      <div 
        className="bg-[#1a3a63] text-white py-1.5 overflow-hidden relative cursor-pointer hover:bg-[#1e4475] transition-colors group"
        onClick={() => setIsSimulationOpen(true)}
      >
        <motion.div 
          className="whitespace-nowrap flex items-center gap-12 group-hover:pause"
          animate={{ x: [0, -1000] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        >
          {[...Array(6)].map((_, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-4">
              <span className="opacity-50">✦</span> 
              KLIK DISINI UNTUK PENGATURAN SIMULASI LELANG 
              <span className="opacity-50">✦</span> 
              SESUAIKAN LIMIT & KELIPATAN PADA PANEL KONTROL
              <span className="bg-blue-500 text-[8px] px-2 py-0.5 rounded ml-2 group-hover:bg-blue-400 transition-colors">MULAI DISINI</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Simulation Toggle Bar */}
      <div className="bg-[#f8f9fa] border-b px-8 py-2 flex justify-between items-center text-gray-500 text-[10px] font-bold">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-[#1a3a63] animate-spin-slow" />
          <span className="uppercase tracking-widest text-[#1a3a63]">Panel Kontrol Simulasi</span>
        </div>
        <button 
          onClick={() => setIsSimulationOpen(!isSimulationOpen)}
          className="bg-[#1a3a63] text-white px-4 py-1 rounded hover:bg-opacity-90 transition uppercase"
        >
          {isSimulationOpen ? 'Sembunyikan Panel' : 'Buka Pengaturan Simulasi'}
        </button>
      </div>

      {/* Simulation Control Panel */}
      <AnimatePresence>
        {isSimulationOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white border-b shadow-inner"
          >
            <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* 1. Limit & Participants Config */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-[#1a3a63]">Limit Penawaran (IDR)</label>
                  <input 
                    type="text" 
                    value={bidLimit === 0 ? '' : bidLimit.toLocaleString('id-ID')}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\./g, '')) || 0;
                      setBidLimit(val);
                    }}
                    placeholder="Contoh: 500.000.000.000"
                    className="w-full border-2 border-gray-100 p-2.5 rounded text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Jumlah Peserta Simulasi</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      value={participantCount}
                      onChange={(e) => setParticipantCount(parseInt(e.target.value))}
                      className="flex-1 accent-blue-600 h-1.5"
                    />
                    <span className="text-sm font-black text-[#1a3a63] w-4">{participantCount}</span>
                  </div>
                </div>
              </div>

              {/* 2. Multiplier & Frequency Config */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-[#1a3a63]">Kelipatan (IDR)</label>
                  <input 
                    type="text" 
                    value={incrementAmount === 0 ? '' : incrementAmount.toLocaleString('id-ID')}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\./g, '')) || 0;
                      setIncrementAmount(val);
                    }}
                    placeholder="Contoh: 100.000.000"
                    className="w-full border-2 border-gray-100 p-2.5 rounded text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Frekuensi Penawaran (Detik)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="1" 
                      max="30" 
                      value={bidFrequency}
                      onChange={(e) => setBidFrequency(parseInt(e.target.value))}
                      className="flex-1 accent-emerald-600 h-1.5"
                    />
                    <span className="text-sm font-black text-[#1a3a63] w-6">{bidFrequency}s</span>
                  </div>
                </div>
              </div>

              {/* 3. Timer Config (Waktu Cooldown) */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-[#1a3a63]">Waktu Cooldown (Jam:Menit:Detik)</label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-gray-300 uppercase">Jam</span>
                      <input 
                        type="text" 
                        value={inputHours === 0 ? '' : inputHours}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value.replace(/\D/g, '')) || 0;
                          setInputHours(val);
                        }}
                        placeholder="0"
                        className="w-full border-2 border-gray-100 p-2 rounded text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-gray-300 uppercase">Menit</span>
                      <input 
                        type="text" 
                        value={inputMinutes === 0 ? '' : inputMinutes}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value.replace(/\D/g, '')) || 0;
                          setInputMinutes(Math.min(59, val));
                        }}
                        placeholder="0"
                        className="w-full border-2 border-gray-100 p-2 rounded text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-gray-300 uppercase">Detik</span>
                      <input 
                        type="text" 
                        value={inputSeconds === 0 ? '' : inputSeconds}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value.replace(/\D/g, '')) || 0;
                          setInputSeconds(Math.min(59, val));
                        }}
                        placeholder="0"
                        className="w-full border-2 border-gray-100 p-2 rounded text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <button onClick={handleSetTime} className="w-full bg-blue-600/10 text-blue-700 py-2 rounded font-bold text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Update Waktu</button>
                </div>
              </div>

              {/* 4. Extended Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-[#1a3a63]">Extended Mode</label>
                  <button 
                    onClick={() => setIsExtendedEnabled(!isExtendedEnabled)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${isExtendedEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isExtendedEnabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {isExtendedEnabled && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Extended 1 (s)</label>
                          <input 
                            type="text" 
                            value={extended1Input}
                            onChange={(e) => setExtended1Input(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                            className="w-full border-2 border-gray-100 p-2 rounded text-sm font-mono outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Extended 2 (s)</label>
                          <input 
                            type="text" 
                            value={extended2Input}
                            onChange={(e) => setExtended2Input(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                            className="w-full border-2 border-gray-100 p-2 rounded text-sm font-mono outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <p className="text-[8px] text-gray-400 italic leading-tight">
                        *Lanjut ke Extended 1 jika pada 2 menit terakhir waktu normal terdapat &gt;1 penawaran (diikuti 3 penawar teratas).
                        <br />
                        *Lanjut ke Extended 2 jika pada Extended 1 terdapat penawaran (diikuti 2 penawar teratas).
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <button 
                  onClick={handleLaunch}
                  className="w-full bg-[#449d44] text-white py-[11px] rounded font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-[#357ebd] transition-all flex items-center justify-center"
                >
                  Mulai Simulasi
                </button>
              </div>
            </div>

            {/* Last User Bid Status Bar */}
            {isSimulationActive && bids.length > 0 && (
              <div className={`${bids[0]?.user === 'Anda' ? 'bg-blue-50/50 border-blue-50' : 'bg-red-50/50 border-red-100'} border-t px-6 py-3 flex items-center justify-between transition-colors`}>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${bids[0]?.user === 'Anda' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                    <div className={`w-2 h-2 rounded-full animate-pulse delay-100 ${bids[0]?.user === 'Anda' ? 'bg-blue-400' : 'bg-red-400'}`}></div>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${bids[0]?.user === 'Anda' ? 'text-[#1a3a63]' : 'text-red-700'}`}>Aktivitas Terakhir Anda</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Penawaran Terakhir Anda:</span>
                    <span className={`text-sm font-black font-mono ${bids[0]?.user === 'Anda' ? 'text-blue-600' : 'text-red-600'}`}>
                      {userLastBidAmount ? formatCurrency(userLastBidAmount) : 'Belum Ada Penawaran'}
                    </span>
                  </div>
                  <div className={`h-8 w-px ${bids[0]?.user === 'Anda' ? 'bg-blue-100' : 'bg-red-200'}`}></div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Status:</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${bids[0]?.user === 'Anda' ? 'text-green-600' : 'text-red-600'}`}>
                      {bids[0]?.user === 'Anda' ? 'Tertinggi (Winner)' : 'Terlampaui (Outbid)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header (White) */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-10 md:h-12">
            {/* Logo & Bureaucracy Branding */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 mb-0.5">
                 <div className="w-4 h-4 bg-[#1a3a63] rounded-sm flex items-center justify-center">
                    <img src="https://www.djkn.kemenkeu.go.id/images/logo-kemenkeu.png" alt="Logo" className="w-2.5 h-2.5 object-contain brightness-200" referrerPolicy="no-referrer" />
                 </div>
                 <span className="text-[7px] uppercase font-bold text-[#1a3a63] tracking-wider">Direktorat Jenderal Kekayaan Negara</span>
              </div>
              <div className="text-xl font-bold text-[#3b6db4] flex items-center">
                lelang<span className="text-blue-400 ring-2 ring-blue-400 rounded-full w-2.5 h-2.5 inline-block ml-0.5 border-[3px] border-white shadow-sm"></span>
                <span className="text-[#1a3a63] text-[8px] ml-0.5 font-normal italic tracking-tighter self-end mb-0.5">Indonesia</span>
              </div>
            </div>

            {/* Search Navigation Bar */}
            <div className="hidden md:flex flex-1 max-w-sm mx-8">
              <div className="relative w-full border border-gray-100 rounded-sm">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <span className="text-[8px] text-gray-400 font-bold border-r pr-1.5 flex items-center gap-1 uppercase tracking-tighter">
                    Kategori <ChevronDown size={10} />
                  </span>
                </div>
                <input 
                  type="text" 
                  className="block w-full pl-20 pr-8 py-1.5 bg-white text-[10px] outline-none italic text-gray-300" 
                  placeholder="CARI DI LELANG INDONESIA"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-300">
                  <Search size={14} />
                </div>
              </div>
            </div>

            {/* Top Navigation Links */}
            <div className="flex items-center gap-6">
              <nav className="hidden lg:flex items-center gap-6 text-[10px] font-bold uppercase text-[#1a3a63]">
                <a href="#" className="hover:text-blue-600 transition-colors">Beranda</a>
                <a href="#" className="flex items-center gap-1 hover:text-blue-600 transition-colors">Kantor <ChevronDown size={12} /></a>
                <a href="#" className="text-green-600 hover:text-green-700 transition-colors">UMKM</a>
              </nav>
              <div className="flex items-center gap-4">
                <Bell size={18} className="text-gray-300 hover:text-[#1a3a63] transition-colors cursor-pointer" />
                <div className="border border-gray-100 rounded-sm px-2 py-1 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="text-[10px] font-bold text-gray-600">eka widayanta</span>
                  <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <User size={12} className="text-gray-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Sub-navigation (Dark Blue) */}
      <div className="bg-[#1a3a63] shadow-sm relative z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex gap-10 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <a href="#" className="border-b-2 border-white pb-0.5 italic">Lelang Saya</a>
            <a href="#" className="opacity-80 italic hover:opacity-100 transition-opacity">Permohonan Lelang</a>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-4 relative">
        {!isSimulationActive && !isFinished && (
          <div className="absolute inset-0 z-[60] bg-gray-100/80 backdrop-blur-sm flex items-center justify-center p-4 text-center">
            <div className="bg-white p-8 rounded-lg shadow-2xl border border-gray-200 max-w-md space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-[#1a3a63] rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Settings size={32} />
              </div>
              <h2 className="text-xl font-black text-[#1a3a63] uppercase tracking-widest">Simulasi Belum Mulai</h2>
              <p className="text-gray-500 text-sm font-medium">Silakan atur parameter simulasi (waktu, limit, peserta) pada panel di atas, lalu klik <strong>"Mulai Simulasi"</strong> untuk memulai uji coba penawaran.</p>
              <button 
                onClick={() => setIsSimulationOpen(true)}
                className="inline-block bg-[#1a3a63] text-white px-6 py-2.5 rounded font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all text-sm"
              >
                Buka Panel Kontrol
              </button>
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 z-[60] bg-[#1a3a63]/95 backdrop-blur-md flex items-center justify-center p-4 text-center overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-6 lg:p-10 rounded-lg shadow-2xl border-4 border-blue-400 w-full max-w-2xl space-y-6 relative my-8"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
              
              <div className="space-y-2">
                <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-inner border border-yellow-100">
                  <Timer size={32} className="animate-bounce" />
                </div>
                <h2 className="text-2xl font-black text-[#1a3a63] uppercase tracking-tighter">LELANG SELESAI</h2>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md border-2 border-gray-200">
                <p className="text-gray-400 text-[10px] uppercase font-black tracking-[0.2em] mb-1">Pemenang Lelang</p>
                {winner ? (
                  <div className="space-y-1">
                    <p className={`text-xl font-black ${winner.user === 'Anda' ? 'text-blue-600' : 'text-gray-800'}`}>
                      {winner.user === 'Anda' ? 'ANDA SENDIRI (SELAMAT!)' : winner.user}
                    </p>
                    <p className="text-lg font-mono text-emerald-600 font-black">{formatCurrency(winner.amount)}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 font-bold">Tidak ada penawaran</p>
                )}
              </div>

              {/* Historis Lengkap */}
              <div className="text-left space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Riwayat Penawaran Lengkap</p>
                <div className="max-h-[300px] overflow-y-auto rounded border border-gray-100 bg-white shadow-inner">
                   {bids.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {bids.map((bid, index) => {
                        return (
                          <React.Fragment key={bid.id}>
                            <div className={`flex items-center justify-between p-3 ${bid.user === 'Anda' ? 'bg-blue-50/50' : ''}`}>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className={`text-xs font-black ${bid.user === 'Anda' ? 'text-blue-600' : 'text-gray-700'}`}>{bid.user === 'Anda' ? 'ANDA' : bid.user}</p>
                                  <p className="text-[9px] text-gray-400 font-medium">{bid.time}</p>
                                </div>
                                {bid.phase > 0 && (
                                  <span className={`text-[7px] font-black text-white px-1.5 py-0.5 rounded uppercase ${bid.phase === 2 ? 'bg-red-600' : 'bg-orange-600'}`}>
                                    EXT {bid.phase}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-mono font-black text-emerald-600">{formatCurrency(bid.amount)}</p>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Belum ada penawaran</div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsSimulationOpen(true)}
                  className="flex-1 bg-gray-100 text-[#1a3a63] px-6 py-3 rounded font-black uppercase tracking-widest hover:bg-gray-200 transition-all text-[10px]"
                >
                  Ubah Parameter
                </button>
                <button 
                  onClick={handleLaunch}
                  className="flex-1 bg-[#449d44] text-white px-6 py-3 rounded font-black uppercase tracking-widest hover:bg-[#357ebd] transition-all text-[10px] shadow-lg"
                >
                  Mulai Ulang
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Countdown Timer Display (Green) */}
        <div className="flex flex-col items-center mb-2 gap-1.5">
          <div className={`w-full max-w-sm rounded-[4px] py-1 flex items-center justify-center text-4xl font-mono text-white shadow-md border-b-2 transition-colors ${
            extendedPhase === 1 
              ? 'bg-orange-500 border-orange-700' 
              : extendedPhase === 2 
                ? 'bg-red-600 border-red-800' 
                : 'bg-[#449d44] border-[#357ebd]'
          }`}>
             {formatTime(timeLeft)}
          </div>
          {isSimulationActive && (
            <div className="flex flex-col items-center gap-1">
              {extendedPhase > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <div className={`${extendedPhase === 2 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'} px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border animate-pulse`}>
                    Extended Phase {extendedPhase} Active
                  </div>
                  <div className="flex flex-col items-center gap-1 my-1 text-center bg-white border border-gray-200/80 px-4 py-2 rounded shadow-sm max-w-sm">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">
                      Peserta Berhak (Top {extendedPhase === 1 ? '3' : '2'} Penawar)
                    </span>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                      {allowedBidders.map((user) => (
                        <span key={user} className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                          user === 'Anda' 
                            ? 'bg-blue-100 border-blue-200 text-blue-700' 
                            : 'bg-gray-100 border-gray-200 text-gray-700'
                        }`}>
                          {user === 'Anda' ? 'ANDA' : user}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-6 bg-white/50 backdrop-blur-sm self-center px-4 py-1.5 rounded-full border border-gray-200/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${ping < 60 ? 'bg-green-500 animate-pulse' : ping < 150 ? 'bg-yellow-500' : 'bg-red-500'} `}></div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Latensi Jaringan: <span className="font-mono text-gray-700 ml-1">{ping}ms</span></span>
                </div>
                <div className="h-3 w-px bg-gray-300"></div>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Status: </span>
                   <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${ping < 60 ? 'text-green-600' : ping < 150 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {ping < 60 ? 'Stabil' : ping < 150 ? 'Koneksi Cukup' : 'Tidak Stabil / Peringatan'}
                   </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Riwayat Penawaran Card (Left) */}
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col h-full ring-1 ring-black/5">
            <div className="py-3 text-center border-b border-gray-50 bg-[#fcfcfc]">
              <h2 className="text-lg font-bold text-[#337ab7]">Riwayat Penawaran</h2>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-0 h-[320px]">
              {bids.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-gray-300 flex-1 justify-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 opacity-50">
                    <Timer size={24} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Menunggu Penawaran Pertama</span>
                  <span className="text-xl font-black mt-1 text-gray-400">{formatCurrency(bidLimit)}</span>
                  <span className="text-[8px] mt-0.5 opacity-40 italic font-bold">HARGA PEMBUKAAN / LIMIT PENAWARAN</span>
                </div>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Penawaran Tertinggi (Frozen / Sticky at top) */}
                  <div className="w-full flex-shrink-0">
                    <div className="bg-[#337ab7] text-white rounded-[4px] py-3 px-6 shadow-md flex flex-col items-center mb-4 transform hover:scale-[1.01] transition-transform">
                      <span className="text-[9px] font-bold uppercase mb-1.5 opacity-90 tracking-widest">Penawaran Tertinggi</span>
                      <span className="text-2xl font-black tracking-tight">
                        {formatCurrency(bids[0].amount)} {bids[0].user === 'Anda' && <span className="text-lg font-normal opacity-70 ml-1.5">(Anda)</span>}
                      </span>
                    </div>
                  </div>

                  {/* Header for history list */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Riwayat Penawaran Sebelumnya</span>
                    <div className="h-px flex-1 bg-gray-100"></div>
                  </div>

                  {/* Riwayat Penawaran Sebelumnya (Scrollable) */}
                  <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[220px]">
                    {bids.slice(1).map((bid) => {
                      return (
                        <React.Fragment key={bid.id}>
                          <div className="py-2 border-b border-gray-50 last:border-b-0 flex flex-col items-center group transition-colors hover:bg-gray-50/50">
                            <div className="flex items-center gap-2">
                              <span className="text-[#337ab7] font-black text-base opacity-70 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(bid.amount)}
                              </span>
                              {bid.phase > 0 && (
                                <span className={`text-[7px] font-black text-white px-1.5 py-0.5 rounded shadow-sm uppercase ${bid.phase === 2 ? 'bg-red-600' : 'bg-orange-600'}`}>
                                  EXT {bid.phase}
                                </span>
                              )}
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-tighter ${bid.user === 'Anda' ? 'text-blue-500' : 'text-gray-400'}`}>
                              {bid.user === 'Anda' ? 'Penawaran Anda' : bid.user}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-[#fcfcfc] border-t border-gray-50 flex items-center gap-2 text-[10px] text-gray-400 font-bold italic">
               <div className="flex flex-col">
                 <span className="font-normal opacity-60 text-[10px]">Estimasi Waktu Server</span>
                 <span className="text-[#337ab7] text-xs font-black">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} <span className="font-normal text-gray-300 ml-1">15 May 2023</span></span>
               </div>
            </div>
          </div>

          {/* Penawaran Anda Card (Right) */}
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col h-full p-6 space-y-4 ring-1 ring-black/5">
            <div className="text-center">
              <h2 className="text-lg font-bold text-[#337ab7]">Penawaran Anda</h2>
            </div>

            {/* Last User Bid Display (Prominent) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${!userLastBidAmount ? 'text-gray-400' : bids[0]?.user === 'Anda' ? 'text-blue-600' : 'text-red-500 animate-pulse'}`}>
                  {!userLastBidAmount ? 'Anda belum melakukan penawaran' : bids[0]?.user === 'Anda' ? 'penawaran anda tertinggi' : 'Penawaran Anda Kalah!'}
                </span>
                <div className={`h-px flex-1 ${bids[0]?.user === 'Anda' ? 'bg-blue-100' : 'bg-red-100'}`}></div>
              </div>
              <div className={`flex border-2 rounded-[4px] overflow-hidden transition-all duration-300 ${bids[0]?.user === 'Anda' ? 'border-blue-50 bg-blue-50/30' : 'border-red-100 bg-red-50/50 shadow-[0_0_10px_rgba(239,68,68,0.08)]'}`}>
                <div className={`px-4 flex items-center justify-center border-r-2 transition-colors ${bids[0]?.user === 'Anda' ? 'bg-blue-100 border-blue-50' : 'bg-red-100 border-red-100'}`}>
                  <span className={`font-bold text-xl ${bids[0]?.user === 'Anda' ? 'text-blue-300' : 'text-red-300'}`}>Rp.</span>
                </div>
                <div className={`flex-1 px-4 py-2 text-3xl font-black tracking-tighter text-right transition-colors ${bids[0]?.user === 'Anda' ? 'text-blue-600' : 'text-red-600'}`}>
                  {userLastBidAmount ? userLastBidAmount.toLocaleString('id-ID') : '-'}
                </div>
              </div>
            </div>

            {/* Current Input (Minimal Bid) */}
            <div className="space-y-2">
               <div className="flex items-center gap-2 px-1">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Minimal Penawaran (Isi Bid Anda)</span>
                <div className="h-px flex-1 bg-gray-100"></div>
              </div>
              <div className="flex border-2 border-gray-100 rounded-[4px] overflow-hidden focus-within:border-blue-300 transition-colors">
                <div className="bg-[#f5f5f5] px-4 flex items-center justify-center border-r-2 border-gray-100">
                  <span className="font-bold text-gray-400 text-xl">Rp.</span>
                </div>
                <input 
                  type="text" 
                  value={myBidAmount === 0 ? '' : myBidAmount.toLocaleString('id-ID')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.replace(/\./g, '')) || 0;
                    setMyBidAmount(val);
                  }}
                  disabled={isUserBlockedFromBidding}
                  placeholder="0"
                  className={`flex-1 px-4 py-2 text-3xl font-black outline-none tracking-tighter text-right w-full ${isUserBlockedFromBidding ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-[#555]'}`}
                />
              </div>

            </div>

            {/* Operation Controls (10x, Kurang, Tambah) */}
            <div className="flex justify-center items-center gap-3">
              <button 
                onClick={() => adjustBid(-10)} 
                disabled={isUserBlockedFromBidding}
                className={`bg-[#d9534f] text-white px-3 py-1.5 rounded-[4px] text-[10px] font-bold shadow transition-colors ${isUserBlockedFromBidding ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 border-gray-200 grayscale' : 'hover:bg-[#c9302c]'}`}
                title="Kurangi 10x kelipatan"
              >
                - 10x
              </button>
              <button 
                onClick={() => adjustBid(-1)} 
                disabled={isUserBlockedFromBidding}
                className={`flex-1 bg-[#d9534f] text-white py-2.5 rounded-[4px] text-[12px] font-bold uppercase tracking-widest shadow-md transition-colors ${isUserBlockedFromBidding ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 border-gray-200 grayscale' : 'hover:bg-[#c9302c]'}`}
              >
                Kurang
              </button>
              <button 
                onClick={() => adjustBid(1)} 
                disabled={isUserBlockedFromBidding}
                className={`flex-1 bg-[#5cb85c] text-white py-2.5 rounded-[4px] text-[12px] font-bold uppercase tracking-widest shadow-md transition-colors ${isUserBlockedFromBidding ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 border-gray-200 grayscale' : 'hover:bg-[#449d44]'}`}
              >
                Tambah
              </button>
              <button 
                onClick={() => adjustBid(10)} 
                disabled={isUserBlockedFromBidding}
                className={`bg-[#5cb85c] text-white px-3 py-1.5 rounded-[4px] text-[10px] font-bold shadow transition-colors ${isUserBlockedFromBidding ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 border-gray-200 grayscale' : 'hover:bg-[#449d44]'}`}
                title="Tambah 10x kelipatan"
              >
                + 10x
              </button>
            </div>

            {/* Authorization PIN Bar */}
            <div className="flex flex-col gap-1 w-full pt-2">
              <div className="flex items-center gap-0 w-full">
                <div className="bg-[#fcf8e3] border-[1.5px] border-r-0 border-[#faebcc] text-[#8a6d3b] px-4 py-2 text-[10px] font-bold whitespace-nowrap rounded-l-[4px] uppercase tracking-wide">
                  PIN
                </div>
                <input 
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={isUserBlockedFromBidding}
                  placeholder={isUserBlockedFromBidding ? "Ditutup" : "Isi PIN (123)"}
                  className={`flex-1 border-[1.5px] ${pinError ? 'border-red-500 bg-red-50' : 'border-[#faebcc] bg-white'} px-4 py-2 text-sm font-mono outline-none rounded-r-[4px] focus:border-[#e6db55] transition-colors ${isUserBlockedFromBidding ? 'bg-gray-50 cursor-not-allowed opacity-60' : ''}`}
                />
              </div>
              {pinError && <p className="text-red-500 text-[9px] font-bold italic ml-1">PIN SALAH!</p>}
            </div>

            {/* Primary Action Button */}
            <button 
              onClick={submitBid}
              disabled={isUserBlockedFromBidding}
              className={`w-full py-4 rounded-[4px] text-sm font-black uppercase tracking-[0.2em] shadow-lg transition-all active:transform active:scale-[0.99] ${
                isUserBlockedFromBidding 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-200 shadow-none' 
                  : 'bg-[#337ab7] text-white hover:bg-[#286090]'
              }`}
            >
              {timeLeft <= 0 
                ? 'Penawaran Ditutup' 
                : (extendedPhase > 0 && !allowedBidders.includes('Anda'))
                  ? 'Tidak Berhak Menawar' 
                  : 'Kirim Penawaran (BID)'}
            </button>
          </div>
        </div>

        {/* Detailed Info Expansion (Accordion) */}
        <div className="mt-6 bg-[#b5d65c] rounded-[4px] shadow-sm ring-1 ring-black/5">
          <div 
            className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-black/5 transition-colors"
            onClick={() => setIsLotDetailsOpen(!isLotDetailsOpen)}
          >
            <h3 className="font-bold text-white uppercase text-sm tracking-[0.2em]">Data Lot Lelang</h3>
            {isLotDetailsOpen ? <ChevronUp className="text-white" size={20} /> : <ChevronDown className="text-white" size={20} />}
          </div>
            <AnimatePresence>
            {isLotDetailsOpen && (
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden bg-white mx-1 mb-1 rounded-sm"
              >
                <div className="p-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-8 gap-y-4 text-xs">
                   <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[#337ab7] font-black uppercase tracking-widest text-[8px]">Kode Lelang</span>
                        <div className="flex items-center justify-between border-b border-gray-50 pb-0.5">
                          <span className="text-gray-600 font-black text-sm">1RVFPJ</span>
                          <button className="border border-[#337ab7] text-[#337ab7] px-2 py-1 rounded-sm font-bold text-[8px] uppercase tracking-widest hover:bg-[#337ab7] hover:text-white transition-all text-[8px]">
                            Detail
                          </button>
                        </div>
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                         <span className="text-[#337ab7] font-black uppercase tracking-widest text-[8px]">Uraian Lot Lelang</span>
                         <span className="text-gray-500 font-medium leading-tight text-[11px]">1 bidang tanah dengan total luas 68.000 m2 di Kab. Klaten.</span>
                      </div>
                      <div className="flex flex-col gap-1">
                         <span className="text-[#337ab7] font-black uppercase tracking-widest text-[8px]">Mulai Penawaran</span>
                         <span className="text-gray-500 italic font-mono bg-gray-50 px-2 py-0.5 rounded-sm w-fit text-[10px]">2023-08-08 13:00:00 WIB</span>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals for Confirmation & Success */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-blue-50 text-[#337ab7] rounded-full flex items-center justify-center mx-auto">
                   <HelpCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Konfirmasi Penawaran</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Apakah Anda yakin ingin mengirim penawaran sebesar <br/>
                  <span className="text-2xl font-black text-[#337ab7] block mt-2">{formatCurrency(pendingBidAmount)}</span>
                </p>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-100 rounded text-sm font-bold text-gray-400 hover:bg-gray-50 transition-colors uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmBid}
                    disabled={timeLeft <= 0}
                    className={`flex-1 px-6 py-3 rounded text-sm font-black transition-all shadow-lg uppercase tracking-widest ${
                      timeLeft <= 0 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-[#337ab7] text-white hover:bg-[#286090]'
                    }`}
                  >
                    {timeLeft <= 0 ? 'Selesai' : 'Kirim'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Low Bid Warning Modal */}
        {showLowBidModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden border border-red-100"
            >
              <div className="bg-red-500 py-4 px-6 text-white flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <HelpCircle size={24} className="text-white" />
                </div>
                <h3 className="font-black uppercase tracking-wider text-sm">Peringatan Penawaran</h3>
              </div>
              <div className="p-8 text-center space-y-6">
                <div className="space-y-3">
                  <p className="text-gray-600 font-bold leading-relaxed">
                    Maaf, penawaran Anda <br/>
                    <span className="text-red-600 text-xl font-black">{formatCurrency(pendingBidAmount)}</span>
                  </p>
                  <div className="h-px bg-gray-100 w-12 mx-auto"></div>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-wider text-[#1a3a63] leading-relaxed">
                    BERADA DI BAWAH NILAI TERTINGGI SAAT INI, SEHINGGA PENAWARAN ANDA TIDAK AKAN TER-RECORD PADA DAFTAR PENAWARAN
                  </p>
                </div>
                
                <button 
                  onClick={() => setShowLowBidModal(false)}
                  className="w-full bg-[#f8f9fa] border-2 border-gray-200 text-gray-800 py-4 rounded-md font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white hover:border-red-600 transition-all text-xs"
                >
                  OK, SAYA MENGERTI
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Success Recorded Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden border border-emerald-100"
            >
              <div className="bg-[#449d44] py-4 px-6 text-white flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bell size={24} className="text-white" />
                </div>
                <h3 className="font-black uppercase tracking-wider text-sm">Penawaran Berhasil</h3>
              </div>
              <div className="p-8 text-center space-y-6">
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-emerald-50 text-[#449d44] rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    >
                      <Check size={32} />
                    </motion.div>
                  </div>
                  <p className="text-gray-600 font-bold leading-relaxed px-4 text-sm uppercase tracking-tight">
                    Penawaran anda <span className="text-[#449d44] font-black">{formatCurrency(pendingBidAmount)}</span> berhasil ter-record pada daftar penawaran lelang
                  </p>
                </div>
                
                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full bg-[#f8f9fa] border-2 border-gray-200 text-gray-800 py-3.5 rounded-md font-black uppercase tracking-[0.2em] hover:bg-[#449d44] hover:text-white hover:border-[#357ebd] transition-all text-xs"
                >
                  OK
                </button>
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: 0 }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-20 bg-[#1a3a63] text-white/50 text-[10px] py-12 px-8 text-center font-bold tracking-[0.4em] uppercase border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <p>© 2026 DIREKTORAT JENDERAL KEKAYAAN NEGARA / REPUBLIK INDONESIA</p>
          <div className="h-px bg-white/10 w-24 mx-auto"></div>
          <p className="opacity-30 tracking-widest">SISTEM INTEGRASI PENAWARAN LELANG ELEKTRONIK (SIMULASI UJI COBA)</p>
        </div>
      </footer>
    </div>
  );
}


