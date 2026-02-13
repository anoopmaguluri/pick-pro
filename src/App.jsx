import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove } from "firebase/database";
import { 
  Trophy, Users, LayoutGrid, Lock, Unlock, RotateCcw, 
  Plus, Trash2, Zap, UsersRound, Check, AlertTriangle, Swords, ShieldAlert, SplitSquareHorizontal, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- PREMIUM UI HELPERS ---
const avatarGradients = [
  "from-pink-500 to-rose-600",
  "from-violet-500 to-indigo-600",
  "from-blue-400 to-cyan-600",
  "from-teal-400 to-emerald-600",
  "from-amber-400 to-orange-600"
];

const getGradient = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
};

const PlayerAvatar = ({ name, className = "" }) => (
  <div className={`flex items-center justify-center rounded-full text-white font-black shadow-lg bg-gradient-to-br ${getGradient(name)} ${className}`}>
    {name.charAt(0).toUpperCase()}
  </div>
);

const SpectatorScore = ({ score }) => (
  <motion.div
    key={score}
    initial={{ scale: 1.8, color: '#4ade80', textShadow: '0px 0px 20px rgba(74,222,128,1)' }}
    animate={{ scale: 1, color: '#FFCA28', textShadow: '0px 0px 0px rgba(255,202,40,0)' }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    className="w-12 h-12 flex items-center justify-center text-xl font-black text-[#FFCA28]"
  >
    {score}
  </motion.div>
);

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newPlayer, setNewPlayer] = useState('');
  
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isDestructive: true });
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [manualTeams, setManualTeams] = useState([]);
  
  const [showPoolSelector, setShowPoolSelector] = useState(false);
  const [pendingTeams, setPendingTeams] = useState([]);
  const [dismissCelebration, setDismissCelebration] = useState(false);

  useEffect(() => {
    const tourneyRef = ref(db, 'tournament/');
    return onValue(tourneyRef, (snapshot) => {
      setData(snapshot.val());
      setLoading(false);
    });
  }, []);

  const triggerHaptic = (pattern) => {
    if (window.navigator?.vibrate) window.navigator.vibrate(pattern);
  };

  const showAlert = (title, message, confirmAction = null, confirmText = 'Confirm', isDestructive = true) => {
    setModal({ show: true, title, message, onConfirm: confirmAction, confirmText, isDestructive });
  };

  const handleScreenSwipe = (event, info) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold && activeTab === 'matches') {
      triggerHaptic(30); setActiveTab('standings');
    } else if (info.offset.x > swipeThreshold && activeTab === 'standings') {
      triggerHaptic(30); setActiveTab('matches');
    }
  };

  const addPlayer = (e) => {
    e?.preventDefault();
    if (!newPlayer.trim()) return;
    triggerHaptic(50);
    const players = data?.players || [];
    set(ref(db, 'tournament/players'), [...players, newPlayer.trim()]);
    setNewPlayer('');
  };

  const removePlayer = (index) => {
    triggerHaptic(60);
    const players = [...data.players];
    players.splice(index, 1);
    set(ref(db, 'tournament/players'), players);
  };

  const promptAutoTournament = () => {
    const players = data?.players || [];
    if (players.length < 4) return showAlert("Invalid Roster", "Need at least 4 players.");
    
    triggerHaptic(30);
    showAlert(
      "Generate Teams?",
      `Are you ready to randomly shuffle all ${players.length} players and create the fixtures?`,
      () => { setModal({ show: false }); executeAutoTournament(); },
      "Start League", false
    );
  };

  const executeAutoTournament = () => {
    const players = data?.players || [];
    triggerHaptic([100, 50, 100]);

    if (players.length % 2 !== 0) {
      const matches = [];
      const shuffled = [...players].sort(() => 0.5 - Math.random());
      let matchId = 0;
      for (let i = 0; i < shuffled.length - 3; i++) {
        for (let j = i + 1; j < shuffled.length - 2; j++) {
          for (let k = j + 1; k < shuffled.length - 1; k++) {
            for (let l = k + 1; l < shuffled.length; l++) {
              if (matchId > (players.length * 2)) break; 
              matches.push({
                id: matchId++,
                tA: { name: `${shuffled[i]} & ${shuffled[j]}`, p1: shuffled[i], p2: shuffled[j] },
                tB: { name: `${shuffled[k]} & ${shuffled[l]}`, p1: shuffled[k], p2: shuffled[l] },
                sA: 0, sB: 0, done: false
              });
            }
          }
        }
      }
      update(ref(db, 'tournament/'), { format: 'mixer', pools: 1, players, matches: matches.sort(() => 0.5 - Math.random()), status: 'active' });
    } else {
      const shuffled = [...players].sort(() => 0.5 - Math.random());
      const teams = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        teams.push({ id: i / 2, name: `${shuffled[i]} & ${shuffled[i + 1]}`, p1: shuffled[i], p2: shuffled[i+1] });
      }
      handleFormatSelection(teams);
    }
  };

  const handleManualSelect = (player) => {
    triggerHaptic(30);
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== player));
      return;
    }
    if (selectedPlayers.length === 1) {
      triggerHaptic([50, 30, 50]);
      setManualTeams([...manualTeams, { id: manualTeams.length, name: `${selectedPlayers[0]} & ${player}`, p1: selectedPlayers[0], p2: player }]);
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers([player]);
    }
  };

  const handleFormatSelection = (teamsToProcess) => {
    if (teamsToProcess.length >= 8) {
      setPendingTeams(teamsToProcess);
      setShowPoolSelector(true);
    } else {
      finalizeFixedTeams(teamsToProcess, 1);
    }
  };

  const finalizeFixedTeams = (teams, poolCount = 1) => {
    const matches = [];
    let matchId = 0;

    if (poolCount === 2) {
      const shuffled = [...teams].sort(() => 0.5 - Math.random());
      shuffled.forEach((t, i) => { t.pool = i % 2 === 0 ? 'A' : 'B'; });
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          if (shuffled[i].pool === shuffled[j].pool) {
            matches.push({ id: matchId++, tA: shuffled[i], tB: shuffled[j], sA: 0, sB: 0, done: false, pool: shuffled[i].pool });
          }
        }
      }
      update(ref(db, 'tournament/'), { format: 'fixed', pools: 2, teams: shuffled, matches: matches.sort(() => 0.5 - Math.random()), status: 'active' });
    } else {
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({ id: matchId++, tA: teams[i], tB: teams[j], sA: 0, sB: 0, done: false });
        }
      }
      update(ref(db, 'tournament/'), { format: 'fixed', pools: 1, teams, matches: matches.sort(() => 0.5 - Math.random()), status: 'active' });
    }
    
    setIsManualMode(false);
    setManualTeams([]);
    setShowPoolSelector(false);
    setPendingTeams([]);
    setDismissCelebration(false);
  };

  const updateScore = (mIdx, team, val) => {
    if (!isAdmin) return;
    triggerHaptic(30);

    const cleanStr = val.replace(/[^0-9]/g, ''); 
    const score = cleanStr === "" ? 0 : parseInt(cleanStr); 
    
    const updates = {};
    updates[`tournament/matches/${mIdx}/${team === 'A' ? 'sA' : 'sB'}`] = score;
    updates[`tournament/matches/${mIdx}/done`] = false; 
    
    update(ref(db), updates);
  };

  const confirmMatch = (mIdx) => {
    triggerHaptic([100, 50, 100]);
    update(ref(db), { [`tournament/matches/${mIdx}/done`]: true });
  };

  const updateKnockoutScore = (idx, team, val) => {
    if (!isAdmin) return;
    triggerHaptic(30);

    const cleanStr = val.replace(/[^0-9]/g, ''); 
    const score = cleanStr === "" ? 0 : parseInt(cleanStr); 

    const newKnockouts = [...data.knockouts];
    newKnockouts[idx][team === 'A' ? 'sA' : 'sB'] = score;
    newKnockouts[idx].done = false;
    
    set(ref(db, 'tournament/knockouts'), newKnockouts);
  };

  const confirmKnockout = (idx) => {
    const newKnockouts = [...data.knockouts];
    newKnockouts[idx].done = true;

    if (newKnockouts[idx].id === 'final') triggerHaptic([200, 100, 200, 100, 500, 100, 800]); 
    else triggerHaptic([100, 50, 100]);

    if ((data.format === 'fixed' || data.pools === 2) && newKnockouts.length === 2) {
      if (newKnockouts[0].done && newKnockouts[1].done) {
        const winner1 = newKnockouts[0].sA > newKnockouts[0].sB ? newKnockouts[0].tA : newKnockouts[0].tB;
        const winner2 = newKnockouts[1].sA > newKnockouts[1].sB ? newKnockouts[1].tA : newKnockouts[1].tB;
        newKnockouts.push({
          id: 'final', type: '🏆 GRAND FINAL',
          tA: winner1, tB: winner2, sA: 0, sB: 0, done: false
        });
        triggerHaptic([100, 100, 200, 200]); 
      }
    }
    set(ref(db, 'tournament/knockouts'), newKnockouts);
  };

  // --- MATHEMATICAL PROBABILITY ENGINE & FORM TRACKER ---
  const standings = useMemo(() => {
    if (!data?.matches) return [];
    let stats = [];

    if (data.format === 'mixer') {
      let playerStats = {};
      data.players.forEach(p => { playerStats[p] = { name: p, p: 0, w: 0, pts: 0, pd: 0, rem: 0, form: [] }; });
      data.matches.forEach(m => {
        if (m.done) {
          const updatePlayer = (pName, isA) => {
            if (!playerStats[pName]) return;
            playerStats[pName].p++;
            const myScore = isA ? m.sA : m.sB;
            const oppScore = isA ? m.sB : m.sA;
            playerStats[pName].pd += (myScore - oppScore);
            if (myScore > oppScore) { playerStats[pName].w++; playerStats[pName].pts += 2; playerStats[pName].form.push('W'); }
            else { playerStats[pName].form.push('L'); }
          };
          updatePlayer(m.tA.p1, true); updatePlayer(m.tA.p2, true);
          updatePlayer(m.tB.p1, false); updatePlayer(m.tB.p2, false);
        } else {
          const updateRem = (pName) => { if (playerStats[pName]) playerStats[pName].rem++; };
          updateRem(m.tA.p1); updateRem(m.tA.p2);
          updateRem(m.tB.p1); updateRem(m.tB.p2);
        }
      });
      stats = Object.values(playerStats);
    } else {
      if (!data.teams) return [];
      stats = data.teams.map(t => ({ ...t, p: 0, w: 0, pts: 0, pd: 0, rem: 0, form: [] }));
      data.matches.forEach(m => {
        const tA = stats.find(s => s.name === m.tA.name);
        const tB = stats.find(s => s.name === m.tB.name);
        if (tA && tB) {
          if (m.done) {
            tA.p++; tB.p++;
            tA.pd += (m.sA - m.sB); tB.pd += (m.sB - m.sA);
            if (m.sA > m.sB) { 
              tA.w++; tA.pts += 2; tA.form.push('W'); tB.form.push('L'); 
            } else { 
              tB.w++; tB.pts += 2; tB.form.push('W'); tA.form.push('L'); 
            }
          } else {
            tA.rem++; tB.rem++;
          }
        }
      });
    }

    stats.sort((a, b) => b.pts - a.pts || b.pd - a.pd);

    const determineStatus = (poolStats, qCount) => {
      const totalTeams = poolStats.length;
      poolStats.forEach(t => { 
        t.maxPts = t.pts + (t.rem * 2); 
        t.form = t.form.slice(-4); // Keep only last 4 games for UI space
      });
      const allDone = poolStats.every(t => t.rem === 0);
      
      poolStats.forEach((t, i) => {
        if (allDone) {
          t.status = i < qCount ? 'Q' : 'E';
        } else {
          const betterTeamsCount = poolStats.filter(other => other.pts > t.maxPts).length;
          if (betterTeamsCount >= qCount) t.status = 'E';
          else {
            const worseTeamsCount = poolStats.filter(other => other.maxPts < t.pts).length;
            if (worseTeamsCount >= (totalTeams - qCount)) t.status = 'Q';
            else t.status = 'pending';
          }
        }
      });
    };

    if (data.pools === 2) {
      determineStatus(stats.filter(t => t.pool === 'A'), 2);
      determineStatus(stats.filter(t => t.pool === 'B'), 2);
    } else {
      determineStatus(stats, stats.length <= 4 ? 2 : 4); 
    }

    return stats;
  }, [data]);

  const finalMatch = data?.knockouts?.find(k => k.id === 'final');
  const isTournamentOver = data?.knockouts?.length > 0 ? finalMatch?.done : false; 
  const tournamentWinner = isTournamentOver ? (finalMatch.sA > finalMatch.sB ? finalMatch.tA.name : finalMatch.tB.name) : null;
  const isGroupStageLocked = data?.knockouts?.length > 0;

  const needsKnockouts = data?.format === 'mixer' || standings.length > 2;
  const allMatchesDone = data?.matches?.length > 0 && data.matches.every(m => m.done);
  
  let knockoutButtonText = "Advance Top 4 to Finals";
  let isKnockoutReady = false;
  
  if (needsKnockouts) {
    if (data?.format === 'mixer') {
      isKnockoutReady = standings.length >= 4 && allMatchesDone;
    } else if (data?.pools === 2) {
      const poolA = standings.filter(t => t.pool === 'A');
      const poolB = standings.filter(t => t.pool === 'B');
      isKnockoutReady = poolA.length >= 2 && poolB.length >= 2 && allMatchesDone;
      knockoutButtonText = "Advance Top 2 from each Group";
    } else {
      const qCount = standings.length <= 4 ? 2 : 4;
      isKnockoutReady = standings.length >= qCount && allMatchesDone;
      if (qCount === 2) knockoutButtonText = "Advance Top 2 to Finals";
    }
  }

  const generateKnockouts = () => {
    if (!isKnockoutReady) return showAlert("Wait", "Finish all matches first.");
    triggerHaptic([100, 100, 100, 100]);
    let knockouts = [];

    if (data.format === 'mixer') {
      const top4 = standings.slice(0, 4);
      knockouts.push({
        id: 'final', type: '🏆 GRAND FINAL',
        tA: { name: `${top4[0].name} & ${top4[3].name}`, p1: top4[0].name, p2: top4[3].name },
        tB: { name: `${top4[1].name} & ${top4[2].name}`, p1: top4[1].name, p2: top4[2].name },
        sA: 0, sB: 0, done: false
      });
    } else if (data.pools === 2) {
      const poolA = standings.filter(t => t.pool === 'A');
      const poolB = standings.filter(t => t.pool === 'B');
      knockouts.push({ id: 'sf1', type: 'Semi-Final 1 (A1 vs B2)', tA: poolA[0], tB: poolB[1], sA: 0, sB: 0, done: false });
      knockouts.push({ id: 'sf2', type: 'Semi-Final 2 (B1 vs A2)', tA: poolB[0], tB: poolA[1], sA: 0, sB: 0, done: false });
    } else {
      if (standings.length <= 4) {
        knockouts.push({ id: 'final', type: '🏆 GRAND FINAL', tA: standings[0], tB: standings[1], sA: 0, sB: 0, done: false });
      } else {
        knockouts.push({ id: 'sf1', type: 'Semi-Final 1 (1st vs 4th)', tA: standings[0], tB: standings[3], sA: 0, sB: 0, done: false });
        knockouts.push({ id: 'sf2', type: 'Semi-Final 2 (2nd vs 3rd)', tA: standings[1], tB: standings[2], sA: 0, sB: 0, done: false });
      }
    }
    set(ref(db, 'tournament/knockouts'), knockouts);
    setActiveTab('matches');
  };

  // --- REBUILT LIVE SHUFFLING TABLE ---
  const renderTable = (tableStandings, title = null) => (
    <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl mb-8">
      {title && <div className="bg-gradient-to-r from-[#FFCA28]/20 to-transparent p-3 pl-6 text-[#FFCA28] font-black uppercase text-[10px] tracking-widest border-b border-white/10">{title}</div>}
      
      {/* Table Header */}
      <div className="grid grid-cols-[1fr_2rem_2rem_2.5rem] gap-2 p-4 pb-2 border-b border-white/5 bg-black/20 text-[9px] font-black text-slate-500 uppercase px-6">
        <div>{data.format === 'mixer' ? 'Player' : 'Team'}</div>
        <div className="text-center">W</div>
        <div className="text-center text-[#FFCA28]">Pts</div>
        <div className="text-right">PD</div>
      </div>

      {/* Shuffling Rows using layout */}
      <div className="relative">
        <AnimatePresence>
          {tableStandings.map((t, i) => {
            const isQ = t.status === 'Q';
            const isE = t.status === 'E';
            const rowClass = isQ ? 'bg-green-500/10' : (isE ? 'opacity-40 grayscale' : (i === 0 ? 'bg-gradient-to-r from-[#FFCA28]/10 to-transparent' : 'bg-transparent'));
            const badgeClass = isQ ? 'bg-green-500 text-[#031123] shadow-[0_0_10px_rgba(74,222,128,0.4)]' : (isE ? 'bg-red-500/80 text-white' : 'bg-white/10 text-white border border-white/10');
            const badgeText = isQ ? 'Q' : (isE ? 'E' : (i + 1));
            
            return (
              <motion.div 
                layout 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                key={t.name} 
                className={`grid grid-cols-[1fr_2rem_2rem_2.5rem] gap-2 p-4 items-center border-b border-white/5 last:border-0 transition-colors px-6 ${rowClass}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`min-w-[20px] h-5 px-1 rounded flex items-center justify-center text-[8px] font-black ${badgeClass}`}>
                    {badgeText}
                  </span>
                  
                  {/* Dynamic Avatars & Form */}
                  <div className="flex flex-col">
                    <span className="text-xs uppercase italic font-black tracking-tighter truncate text-white">{t.name}</span>
                    <div className="flex gap-1 mt-1">
                      {t.form.length > 0 ? t.form.map((res, fIdx) => (
                        <div key={fIdx} className={`w-1.5 h-1.5 rounded-full ${res === 'W' ? 'bg-green-400' : 'bg-red-500'}`} />
                      )) : <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">No Games</span>}
                    </div>
                  </div>
                </div>

                <div className="text-center text-sm font-bold text-slate-300">{t.w}</div>
                <div className="text-center text-lg font-black text-[#FFCA28] drop-shadow-md">{t.pts}</div>
                <div className="text-right text-xs font-mono font-bold text-slate-400">{t.pd > 0 ? `+${t.pd}` : t.pd}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );

  if (loading) return <div className="h-screen bg-[#031123]" />;

  const isSetupMode = !data || data.status !== 'active';
  const availablePlayers = (data?.players || []).filter(p => !manualTeams.some(t => t.name.includes(p)));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0B1E36] via-[#031123] to-[#010812] text-white font-sans selection:bg-[#FFCA28]/30 relative">
      
      {/* CHAMPIONS CELEBRATION */}
      <AnimatePresence>
        {isTournamentOver && !dismissCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 bg-[#031123]/95 backdrop-blur-3xl">
            <motion.div animate={{ scale: [0.9, 1.1, 1], rotate: [0, -5, 5, 0] }} transition={{ duration: 1, ease: "easeOut" }} className="text-[#FFCA28] mb-8 relative">
              <div className="absolute inset-0 blur-3xl bg-[#FFCA28]/40 rounded-full animate-pulse"></div>
              <Crown size={100} className="relative z-10 drop-shadow-[0_0_30px_rgba(255,202,40,0.8)]" />
            </motion.div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FFCA28]/60 mb-2">Tournament Champions</h2>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-4xl font-black italic uppercase tracking-tighter text-center mb-12 text-white drop-shadow-2xl">
              {tournamentWinner}
            </motion.h1>
            <motion.button whileTap={{ scale: 0.9 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} onClick={() => { triggerHaptic(30); setDismissCelebration(true); }} className="px-10 py-4 rounded-full bg-white/10 font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-colors border border-white/20">
              View Final Board
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.show && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#051A2E] border border-white/10 p-8 rounded-[3rem] w-full text-center shadow-2xl shadow-[#FFCA28]/10">
              <AlertTriangle size={48} className="mx-auto mb-4 text-[#FFCA28]" />
              <h2 className="text-xl font-black mb-2 uppercase italic text-white">{modal.title}</h2>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">{modal.message}</p>
              <div className="flex gap-4">
                <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 bg-white/5 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-white">Cancel</button>
                {modal.onConfirm && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={modal.onConfirm} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg ${modal.isDestructive ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123]'}`}>
                    {modal.confirmText}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-6 flex justify-between items-center sticky top-0 bg-gradient-to-b from-[#031123] to-[#031123]/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img 
            src="/p-pro-s.png" 
            alt="P-PRO Logo" 
            className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,202,40,0.3)]" 
          />
          <h1 className="text-2xl font-black italic tracking-tighter uppercase drop-shadow-md text-white mt-0.5">
            P-PRO <span className="text-[#FFCA28]">OS</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isAdmin ? 'bg-gradient-to-tr from-[#F57C00] to-[#FFCA28] shadow-[0_0_15px_rgba(245,124,0,0.5)] text-[#031123]' : 'bg-white/5 opacity-40 text-white'}`}>
            {isAdmin ? <Unlock size={18}/> : <Lock size={18}/>}
          </motion.button>
          {isAdmin && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => showAlert("Reset Data", "Wipe the current tournament?", () => { remove(ref(db, 'tournament/')); setModal({show:false}); setDismissCelebration(false); }, "Reset", true)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center">
              <RotateCcw size={18}/>
            </motion.button>
          )}
        </div>
      </header>

      <main className="p-6 pb-32 h-full overflow-y-auto overflow-x-hidden">
        {isSetupMode ? (
          <div className="space-y-6">
            {!isManualMode ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {data?.players?.length > 0 ? (
                  <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 p-6 rounded-[2.5rem] shadow-xl">
                    <form onSubmit={addPlayer} className="flex gap-2 mb-6">
                      <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} placeholder="Player Name..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#FFCA28] text-white" />
                      <motion.button whileTap={{ scale: 0.9 }} type="submit" className="bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] w-14 h-14 rounded-2xl flex items-center justify-center"><Plus/></motion.button>
                    </form>
                    <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                      {data.players.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/5 pl-2 pr-4 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-tighter">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar name={p} className="w-6 h-6 text-[8px]" />
                            {p}
                          </div>
                          <button onClick={() => removePlayer(i)} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-white/10 rounded-[2.5rem] p-10 text-center flex flex-col items-center">
                    <UsersRound size={48} className="text-white/20 mb-4" />
                    <h3 className="font-black uppercase tracking-widest text-white/50 text-sm mb-6">No Players Drafted</h3>
                    <form onSubmit={addPlayer} className="flex gap-2 w-full">
                      <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} placeholder="Add first player..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#FFCA28] text-white" />
                      <motion.button whileTap={{ scale: 0.9 }} type="submit" className="bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] w-14 h-14 rounded-2xl flex items-center justify-center"><Plus/></motion.button>
                    </form>
                  </div>
                )}

                {data?.players?.length >= 4 && (
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={promptAutoTournament} className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center hover:bg-white/10 transition-colors">
                      <Zap className="text-[#FFCA28] mb-2 drop-shadow-md" />
                      <p className="text-[10px] font-black uppercase text-white">Auto</p>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => { triggerHaptic(60); setIsManualMode(true); }} className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center hover:bg-white/10 transition-colors">
                      <UsersRound className="text-[#FFCA28] mb-2 drop-shadow-md" />
                      <p className="text-[10px] font-black uppercase text-white">Manual</p>
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                <header className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Manual Selection</h3>
                  <button onClick={() => setIsManualMode(false)} className="text-[#FFCA28] font-black uppercase text-[10px]">Cancel</button>
                </header>
                <div className="flex flex-wrap gap-2">
                  {availablePlayers.map((p, i) => (
                    <motion.button whileTap={{ scale: 0.95 }} key={i} onClick={() => handleManualSelect(p)} className={`flex items-center gap-2 pl-2 pr-5 py-2 rounded-full border transition-all font-black text-[11px] uppercase shadow-lg ${selectedPlayers.includes(p) ? 'bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] border-transparent' : 'bg-white/5 border-white/10 text-white'}`}>
                      <PlayerAvatar name={p} className="w-8 h-8 text-[10px]" />
                      {p}
                    </motion.button>
                  ))}
                </div>
                {availablePlayers.length < 2 && manualTeams.length > 0 && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleFormatSelection(manualTeams)} className="w-full bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] py-6 rounded-[2.5rem] font-black uppercase shadow-[0_10px_30px_rgba(245,124,0,0.3)]">Start Matches</motion.button>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <motion.div drag="x" dragDirectionLock onDragEnd={handleScreenSwipe} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.1} className="touch-pan-y min-h-full">
            <AnimatePresence mode="wait">
              {activeTab === 'matches' ? (
                <motion.div key="fixtures" initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="space-y-4">
                  
                  {/* KNOCKOUT RENDERER */}
                  {data?.knockouts && (
                    <div className="mb-10 space-y-4">
                      <h3 className="flex items-center justify-center gap-2 text-[#FFCA28] font-black uppercase tracking-widest text-xs mb-6 mt-2 drop-shadow-md"><Trophy size={14}/> Knockout Stage</h3>
                      {data.knockouts.map((m, idx) => {
                        const isWinnerHighlight = m.id === 'final' && m.done;
                        const cardClass = isWinnerHighlight ? 'bg-gradient-to-br from-[#FFCA28]/20 to-[#F57C00]/10 border-2 border-[#FFCA28] shadow-[0_0_40px_rgba(255,202,40,0.3)] z-10 scale-[1.02]' : (m.done ? 'opacity-40 grayscale bg-white/5 border border-white/10' : 'bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 shadow-xl');
                        const canFinalize = (m.sA >= 11 || m.sB >= 11) && Math.abs(m.sA - m.sB) >= 2 && !m.done;

                        return (
                          <div key={m.id} className={`relative p-6 rounded-[2.5rem] transition-all duration-500 pt-8 ${cardClass}`}>
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1 rounded-b-xl text-[8px] font-black uppercase tracking-widest whitespace-nowrap shadow-md ${isWinnerHighlight ? 'bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123]' : 'bg-white/10 text-white border border-t-0 border-white/10'}`}>
                              {m.type}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              
                              {/* Team A (Avatars + Name) */}
                              <div className="w-1/3 flex flex-col items-center gap-2">
                                <div className="flex">
                                  <PlayerAvatar name={m.tA.p1} className="w-10 h-10 text-[12px] z-10 border-2 border-[#031123]" />
                                  {m.tA.p2 && <PlayerAvatar name={m.tA.p2} className="w-10 h-10 text-[12px] -ml-4 z-0 border-2 border-[#031123]" />}
                                </div>
                                <p className="text-center text-[9px] font-black uppercase tracking-tighter leading-tight text-white line-clamp-2">{m.tA.name}</p>
                              </div>

                              {/* Scores */}
                              <div className={`flex items-center gap-2 bg-black/60 p-1 rounded-2xl border ${isWinnerHighlight ? 'border-[#FFCA28]' : 'border-white/10'}`}>
                                {isAdmin && (!isTournamentOver || m.id === 'final') ? (
                                  <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sA === 0 ? "" : m.sA} placeholder="0" onChange={e => updateKnockoutScore(idx, 'A', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCA28] outline-none" />
                                ) : <SpectatorScore score={m.sA} />}
                                <div className={`h-4 w-px ${isWinnerHighlight ? 'bg-[#FFCA28]' : 'bg-white/20'}`} />
                                {isAdmin && (!isTournamentOver || m.id === 'final') ? (
                                  <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sB === 0 ? "" : m.sB} placeholder="0" onChange={e => updateKnockoutScore(idx, 'B', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCA28] outline-none" />
                                ) : <SpectatorScore score={m.sB} />}
                              </div>

                              {/* Team B */}
                              <div className="w-1/3 flex flex-col items-center gap-2">
                                <div className="flex">
                                  <PlayerAvatar name={m.tB.p1} className="w-10 h-10 text-[12px] z-10 border-2 border-[#031123]" />
                                  {m.tB.p2 && <PlayerAvatar name={m.tB.p2} className="w-10 h-10 text-[12px] -ml-4 z-0 border-2 border-[#031123]" />}
                                </div>
                                <p className="text-center text-[9px] font-black uppercase tracking-tighter leading-tight text-white line-clamp-2">{m.tB.name}</p>
                              </div>
                            </div>
                            
                            {isAdmin && canFinalize && (
                              <motion.button whileTap={{ scale: 0.95 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onClick={() => confirmKnockout(idx)} className="w-full mt-5 bg-gradient-to-r from-green-400 to-emerald-600 text-[#031123] py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                                <Check size={14} className="inline mr-1 mb-0.5"/> Finalize Match
                              </motion.button>
                            )}
                          </div>
                        )
                      })}
                      <div className="w-full h-px bg-white/10 my-8"></div>
                    </div>
                  )}

                  {/* ADVANCE BUTTON */}
                  {isAdmin && !data?.knockouts && needsKnockouts && isKnockoutReady && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={generateKnockouts} className="w-full bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] py-5 rounded-[2rem] font-black uppercase shadow-[0_10px_30px_rgba(245,124,0,0.3)] mb-6 flex items-center justify-center gap-2 transition-transform">
                      <Swords size={18}/> {knockoutButtonText}
                    </motion.button>
                  )}

                  {/* PENDING WARNING */}
                  {isAdmin && !data?.knockouts && needsKnockouts && !isKnockoutReady && data?.matches?.length > 0 && (
                    <div className="w-full bg-white/5 text-slate-400 py-4 rounded-[2rem] font-bold uppercase text-[10px] tracking-widest text-center mb-6 flex items-center justify-center gap-2 border border-white/5">
                      <ShieldAlert size={14}/> Complete matches to advance
                    </div>
                  )}

                  {/* GROUP STAGE RENDERER */}
                  <motion.div layout className="space-y-4">
                    {(data?.matches || []).map((m, idx) => {
                      const lockGroupStage = isTournamentOver || isGroupStageLocked;
                      const canFinalize = (m.sA >= 11 || m.sB >= 11) && Math.abs(m.sA - m.sB) >= 2 && !m.done;

                      return (
                      <motion.div layout key={m.id} className={`relative p-6 rounded-[2.5rem] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 transition-all ${m.done ? 'opacity-30' : 'shadow-xl'}`}>
                        {data.pools === 2 && (
                          <div className="absolute top-0 right-0 bg-gradient-to-bl from-[#F57C00] to-[#FFCA28] text-[#031123] px-3 py-1 rounded-bl-xl rounded-tr-[2.5rem] text-[8px] font-black uppercase tracking-widest shadow-md">Pool {m.pool}</div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          
                          {/* Team A (Avatars) */}
                          <div className="w-1/3 flex flex-col items-center gap-2">
                            <div className="flex">
                              <PlayerAvatar name={m.tA.p1} className="w-9 h-9 text-[10px] z-10 border-2 border-[#031123]" />
                              {m.tA.p2 && <PlayerAvatar name={m.tA.p2} className="w-9 h-9 text-[10px] -ml-3 z-0 border-2 border-[#031123]" />}
                            </div>
                            <p className="text-center text-[9px] font-black uppercase tracking-tighter leading-tight text-slate-300 line-clamp-2">{m.tA.name}</p>
                          </div>
                          
                          {/* Scores */}
                          <div className="flex items-center gap-2 bg-black/60 p-1 rounded-2xl border border-white/10 mt-2">
                            {isAdmin && !lockGroupStage ? <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sA === 0 ? "" : m.sA} placeholder="0" onChange={e => updateScore(idx, 'A', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCA28] outline-none placeholder:text-white/20" /> : <SpectatorScore score={m.sA} />}
                            <div className="h-4 w-px bg-white/20" />
                            {isAdmin && !lockGroupStage ? <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sB === 0 ? "" : m.sB} placeholder="0" onChange={e => updateScore(idx, 'B', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCA28] outline-none placeholder:text-white/20" /> : <SpectatorScore score={m.sB} />}
                          </div>

                          {/* Team B (Avatars) */}
                          <div className="w-1/3 flex flex-col items-center gap-2">
                            <div className="flex">
                              <PlayerAvatar name={m.tB.p1} className="w-9 h-9 text-[10px] z-10 border-2 border-[#031123]" />
                              {m.tB.p2 && <PlayerAvatar name={m.tB.p2} className="w-9 h-9 text-[10px] -ml-3 z-0 border-2 border-[#031123]" />}
                            </div>
                            <p className="text-center text-[9px] font-black uppercase tracking-tighter leading-tight text-slate-300 line-clamp-2">{m.tB.name}</p>
                          </div>
                        </div>

                        {isAdmin && canFinalize && (
                          <motion.button whileTap={{ scale: 0.95 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onClick={() => confirmMatch(idx)} className="w-full mt-5 bg-gradient-to-r from-green-400 to-emerald-600 text-[#031123] py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                            <Check size={14} className="inline mr-1 mb-0.5"/> Finalize Match
                          </motion.button>
                        )}
                      </motion.div>
                    )})}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div key="table" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}} className="space-y-6">
                  {data?.pools === 2 ? (
                    <>
                      {renderTable(standings.filter(t => t.pool === 'A'), 'Group A')}
                      {renderTable(standings.filter(t => t.pool === 'B'), 'Group B')}
                    </>
                  ) : renderTable(standings)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {!isSetupMode && (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] bg-[#031123]/90 backdrop-blur-3xl rounded-full p-2 flex border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
          <motion.div className="absolute top-2 bottom-2 w-[calc(50%-8px)] bg-gradient-to-r from-[#FFCA28] to-[#F57C00] rounded-full z-0 shadow-md" animate={{ x: activeTab === 'matches' ? '0%' : '100%' }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
          <motion.div className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.x > 30) { triggerHaptic(30); setActiveTab('standings'); } else if (info.offset.x < -30) { triggerHaptic(30); setActiveTab('matches'); } }} onTap={(e, info) => { if (info.point.x > window.innerWidth / 2) { triggerHaptic(30); setActiveTab('standings'); } else { triggerHaptic(30); setActiveTab('matches'); } }} />
          <div className="relative z-10 flex-1 py-4 flex items-center justify-center gap-2 pointer-events-none transition-colors duration-500">
            <LayoutGrid size={20} className={activeTab === 'matches' ? 'text-[#031123]' : 'text-slate-500'} />
            {activeTab === 'matches' && <span className="text-[#031123] font-black uppercase text-[10px] tracking-widest drop-shadow-sm">Fixtures</span>}
          </div>
          <div className="relative z-10 flex-1 py-4 flex items-center justify-center gap-2 pointer-events-none transition-colors duration-500">
            <Users size={20} className={activeTab === 'standings' ? 'text-[#031123]' : 'text-slate-500'} />
            {activeTab === 'standings' && <span className="text-[#031123] font-black uppercase text-[10px] tracking-widest drop-shadow-sm">Table</span>}
          </div>
        </nav>
      )}
    </div>
  );
}