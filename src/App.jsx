import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove } from "firebase/database";
import { 
  Trophy, Users, LayoutGrid, Lock, Unlock, RotateCcw, 
  Plus, Trash2, Zap, UsersRound, Check, AlertTriangle, Swords, ShieldAlert, SplitSquareHorizontal, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newPlayer, setNewPlayer] = useState('');
  
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null });
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

  const showAlert = (title, message, confirmAction = null) => {
    setModal({ show: true, title, message, onConfirm: confirmAction });
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

  const startAutoTournament = () => {
    const players = data?.players || [];
    if (players.length < 4) return showAlert("Invalid Roster", "Need at least 4 players.");
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

  // --- TYPO-SAFE SCORING LOGIC ---
  const updateScore = (mIdx, team, val) => {
    if (!isAdmin) return;
    triggerHaptic(30);

    const cleanStr = val.replace(/[^0-9]/g, ''); 
    const score = cleanStr === "" ? 0 : parseInt(cleanStr); 
    
    // Updates the score but resets 'done' to false if editing
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
    newKnockouts[idx].done = false; // Reset to false if editing
    
    set(ref(db, 'tournament/knockouts'), newKnockouts);
  };

  const confirmKnockout = (idx) => {
    const newKnockouts = [...data.knockouts];
    newKnockouts[idx].done = true;

    if (newKnockouts[idx].id === 'final') triggerHaptic([200, 100, 200, 100, 500, 100, 800]); 
    else triggerHaptic([100, 50, 100]);

    // Auto-Generate Grand Final
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

  const standings = useMemo(() => {
    if (!data?.matches) return [];
    let stats = [];

    if (data.format === 'mixer') {
      let playerStats = {};
      data.players.forEach(p => { playerStats[p] = { name: p, p: 0, w: 0, pts: 0, pd: 0, rem: 0 }; });
      data.matches.forEach(m => {
        if (m.done) {
          const updatePlayer = (pName, isA) => {
            if (!playerStats[pName]) return;
            playerStats[pName].p++;
            const myScore = isA ? m.sA : m.sB;
            const oppScore = isA ? m.sB : m.sA;
            playerStats[pName].pd += (myScore - oppScore);
            if (myScore > oppScore) { playerStats[pName].w++; playerStats[pName].pts += 2; }
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
      stats = data.teams.map(t => ({ ...t, p: 0, w: 0, pts: 0, pd: 0, rem: 0 }));
      data.matches.forEach(m => {
        const tA = stats.find(s => s.name === m.tA.name);
        const tB = stats.find(s => s.name === m.tB.name);
        if (tA && tB) {
          if (m.done) {
            tA.p++; tB.p++;
            tA.pd += (m.sA - m.sB); tB.pd += (m.sB - m.sA);
            if (m.sA > m.sB) { tA.w++; tA.pts += 2; } else { tB.w++; tB.pts += 2; }
          } else {
            tA.rem++; tB.rem++;
          }
        }
      });
    }

    stats.sort((a, b) => b.pts - a.pts || b.pd - a.pd);

    const determineStatus = (poolStats, qCount) => {
      const totalTeams = poolStats.length;
      poolStats.forEach(t => { t.maxPts = t.pts + (t.rem * 2); });
      const allDone = poolStats.every(t => t.rem === 0);
      
      poolStats.forEach((t, i) => {
        if (allDone) {
          t.status = i < qCount ? 'Q' : 'E';
        } else {
          const betterTeamsCount = poolStats.filter(other => other.pts > t.maxPts).length;
          if (betterTeamsCount >= qCount) {
            t.status = 'E';
          } else {
            const worseTeamsCount = poolStats.filter(other => other.maxPts < t.pts).length;
            if (worseTeamsCount >= (totalTeams - qCount)) {
              t.status = 'Q';
            } else {
              t.status = 'pending';
            }
          }
        }
      });
    };

    if (data.pools === 2) {
      determineStatus(stats.filter(t => t.pool === 'A'), 2);
      determineStatus(stats.filter(t => t.pool === 'B'), 2);
    } else {
      determineStatus(stats, stats.length === 4 ? 2 : 4);
    }

    return stats;
  }, [data]);

  const finalMatch = data?.knockouts?.find(k => k.id === 'final');
  const isTournamentOver = finalMatch?.done;
  const tournamentWinner = isTournamentOver ? (finalMatch.sA > finalMatch.sB ? finalMatch.tA.name : finalMatch.tB.name) : null;
  const isGroupStageLocked = data?.knockouts?.length > 0;

  const allMatchesDone = data?.matches?.length > 0 && data.matches.every(m => m.done);
  
  let knockoutButtonText = "Advance Top 4 to Finals";
  let isKnockoutReady = false;
  
  if (data?.format === 'mixer') {
    isKnockoutReady = standings.length >= 4 && allMatchesDone;
  } else if (data?.pools === 2) {
    const poolA = standings.filter(t => t.pool === 'A');
    const poolB = standings.filter(t => t.pool === 'B');
    isKnockoutReady = poolA.length >= 2 && poolB.length >= 2 && allMatchesDone;
    knockoutButtonText = "Advance Top 2 from each Group";
  } else {
    const qCount = standings.length === 4 ? 2 : 4;
    isKnockoutReady = standings.length >= qCount && allMatchesDone;
    if (qCount === 2) knockoutButtonText = "Advance Top 2 to Finals";
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
      if (standings.length === 4) {
        knockouts.push({ id: 'final', type: '🏆 GRAND FINAL', tA: standings[0], tB: standings[1], sA: 0, sB: 0, done: false });
      } else {
        knockouts.push({ id: 'sf1', type: 'Semi-Final 1 (1st vs 4th)', tA: standings[0], tB: standings[3], sA: 0, sB: 0, done: false });
        knockouts.push({ id: 'sf2', type: 'Semi-Final 2 (2nd vs 3rd)', tA: standings[1], tB: standings[2], sA: 0, sB: 0, done: false });
      }
    }
    set(ref(db, 'tournament/knockouts'), knockouts);
    setActiveTab('matches');
  };

  const renderTable = (tableStandings, title = null) => (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl mb-6">
      {title && <div className="bg-[#FFCB2B]/10 p-3 text-center text-[#FFCB2B] font-black uppercase text-[10px] tracking-widest">{title}</div>}
      <table className="w-full">
        <thead className="bg-white/5 text-[9px] font-black text-slate-500 uppercase">
          <tr>
            <th className="p-5 text-left pl-6">{data.format === 'mixer' ? 'Player' : 'Team'}</th>
            <th className="p-5 text-center">W</th>
            <th className="p-5 text-center text-[#FFCB2B]">Pts</th>
            <th className="p-5 text-right pr-6">PD</th>
          </tr>
        </thead>
        <tbody>
          {tableStandings.map((t, i) => {
            const rowClass = t.status === 'Q' ? 'bg-green-500/10' : (t.status === 'E' ? 'opacity-40 grayscale' : (i === 0 ? 'bg-[#FFCB2B]/5' : ''));
            const badgeClass = t.status === 'Q' ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]' : (t.status === 'E' ? 'bg-red-500 text-white' : 'bg-white/10 text-white');
            const badgeText = t.status === 'Q' ? 'Q' : (t.status === 'E' ? 'E' : (i + 1));

            return (
              <tr key={t.name} className={`border-b border-white/5 last:border-0 font-black transition-all ${rowClass}`}>
                <td className="p-5 pl-6 flex items-center gap-3">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[8px] transition-colors ${badgeClass}`}>
                    {badgeText}
                  </span>
                  <span className="text-xs uppercase italic tracking-tighter truncate max-w-[90px]">{t.name}</span>
                </td>
                <td className="p-5 text-center text-white">{t.w}</td>
                <td className="p-5 text-center text-[#FFCB2B] font-bold text-lg">{t.pts}</td>
                <td className="p-5 text-right pr-6 text-xs text-slate-400 font-mono tracking-tighter">{t.pd > 0 ? `+${t.pd}` : t.pd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (loading) return <div className="h-screen bg-[#031123]" />;

  const isSetupMode = !data || data.status !== 'active';
  const availablePlayers = (data?.players || []).filter(p => !manualTeams.some(t => t.name.includes(p)));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#031123] text-white font-sans selection:bg-[#FFCB2B]/30 relative">
      
      {/* CHAMPIONS CELEBRATION */}
      <AnimatePresence>
        {isTournamentOver && !dismissCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 bg-[#031123]/95 backdrop-blur-3xl">
            <motion.div animate={{ scale: [0.9, 1.1, 1], rotate: [0, -5, 5, 0] }} transition={{ duration: 1, ease: "easeOut" }} className="text-[#FFCB2B] mb-8 relative">
              <div className="absolute inset-0 blur-3xl bg-yellow-500/40 rounded-full animate-pulse"></div>
              <Crown size={100} className="relative z-10 drop-shadow-[0_0_30px_rgba(255,203,43,0.8)]" />
            </motion.div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Tournament Champions</h2>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-4xl font-black italic uppercase tracking-tighter text-center mb-12 text-white drop-shadow-2xl">
              {tournamentWinner}
            </motion.h1>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} onClick={() => { triggerHaptic(30); setDismissCelebration(true); }} className="px-10 py-4 rounded-full bg-white/10 font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-colors border border-white/20">
              View Final Board
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.show && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a1f3d] border border-white/10 p-8 rounded-[3rem] w-full text-center">
              <AlertTriangle size={48} className="mx-auto mb-4 text-[#FFCB2B]" />
              <h2 className="text-xl font-black mb-2 uppercase italic">{modal.title}</h2>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">{modal.message}</p>
              <div className="flex gap-4">
                <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 bg-white/5 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Close</button>
                {modal.onConfirm && (
                  <button onClick={modal.onConfirm} className="flex-1 bg-red-600 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg">Confirm</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showPoolSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a1f3d] border border-white/10 p-8 rounded-[3rem] w-full text-center shadow-2xl">
              <SplitSquareHorizontal size={48} className="mx-auto mb-4 text-[#FFCB2B]" />
              <h2 className="text-xl font-black mb-2 uppercase italic tracking-tighter leading-none">Huge Turnout!</h2>
              <p className="text-slate-400 text-xs mb-8">You have {pendingTeams.length} teams. How would you like to structure the league?</p>
              <div className="space-y-4">
                <button onClick={() => finalizeFixedTeams(pendingTeams, 2)} className="w-full bg-[#FFCB2B] text-black py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">2 Pools (Group A & B)</button>
                <button onClick={() => finalizeFixedTeams(pendingTeams, 1)} className="w-full bg-white/5 py-5 rounded-2xl font-bold uppercase text-[10px] tracking-widest">1 Massive Pool</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-6 flex justify-between items-center sticky top-0 bg-[#031123]/95 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase">P-PRO <span className="text-[#FFCB2B]">OS</span></h1>
        <div className="flex gap-2">
          <button onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isAdmin ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-white/5 opacity-30'}`}>
            {isAdmin ? <Unlock size={18}/> : <Lock size={18}/>}
          </button>
          {isAdmin && (
            <button onClick={() => showAlert("Reset Data", "Wipe the current tournament?", () => { remove(ref(db, 'tournament/')); setModal({show:false}); setDismissCelebration(false); })} className="w-10 h-10 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center">
              <RotateCcw size={18}/>
            </button>
          )}
        </div>
      </header>

      <main className="p-6 pb-32 h-full overflow-y-auto">
        {isSetupMode ? (
          <div className="space-y-6">
            {!isManualMode ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
                  <form onSubmit={addPlayer} className="flex gap-2 mb-6">
                    <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} placeholder="Player Name..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#FFCB2B]" />
                    <button type="submit" className="bg-[#FFCB2B] text-black w-14 h-14 rounded-2xl flex items-center justify-center"><Plus/></button>
                  </form>
                  <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {(data?.players || []).map((p, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-tighter">
                        {p} <button onClick={() => removePlayer(i)} className="text-white/20"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={startAutoTournament} className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center">
                    <Zap className="text-[#FFCB2B] mb-2" />
                    <p className="text-[10px] font-black uppercase">Auto</p>
                  </button>
                  <button onClick={() => { triggerHaptic(60); setIsManualMode(true); }} className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center">
                    <UsersRound className="text-[#FFCB2B] mb-2" />
                    <p className="text-[10px] font-black uppercase">Manual</p>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                <header className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Manual Selection</h3>
                  <button onClick={() => setIsManualMode(false)} className="text-[#FFCB2B] font-black uppercase text-[10px]">Cancel</button>
                </header>
                <div className="flex flex-wrap gap-2">
                  {availablePlayers.map((p, i) => (
                    <button key={i} onClick={() => handleManualSelect(p)} className={`px-5 py-4 rounded-2xl border transition-all font-black text-[11px] uppercase ${selectedPlayers.includes(p) ? 'bg-[#FFCB2B] text-black border-[#FFCB2B]' : 'bg-white/5 border-white/10'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                {availablePlayers.length < 2 && manualTeams.length > 0 && (
                  <button onClick={() => handleFormatSelection(manualTeams)} className="w-full bg-[#FFCB2B] text-black py-6 rounded-[2.5rem] font-black uppercase shadow-2xl">Start Matches</button>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'matches' ? (
              <motion.div key="fixtures" initial={{opacity:0, y: 20}} animate={{opacity:1, y: 0}} className="space-y-4">
                
                {data?.knockouts && (
                  <div className="mb-10 space-y-4">
                    <h3 className="flex items-center justify-center gap-2 text-[#FFCB2B] font-black uppercase tracking-widest text-xs mb-6 mt-2">
                      <Trophy size={14}/> Knockout Stage
                    </h3>
                    {data.knockouts.map((m, idx) => {
                      const isWinnerHighlight = m.id === 'final' && m.done;
                      const cardClass = isWinnerHighlight 
                        ? 'bg-gradient-to-br from-[#FFCB2B]/30 to-black/60 border-2 border-[#FFCB2B] shadow-[0_0_50px_rgba(255,203,43,0.5)] z-10 scale-[1.02]' 
                        : (m.done ? 'opacity-40 grayscale bg-white/5 border border-white/10' : 'bg-gradient-to-br from-[#FFCB2B]/20 to-transparent border border-[#FFCB2B]/30 shadow-lg');
                      
                      const canFinalize = (m.sA >= 11 || m.sB >= 11) && Math.abs(m.sA - m.sB) >= 2 && !m.done;

                      return (
                        <div key={m.id} className={`relative p-6 rounded-[2.5rem] transition-all duration-500 pt-8 ${cardClass}`}>
                          <div className={`absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1 rounded-b-xl text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${isWinnerHighlight ? 'bg-[#FFCB2B] text-black' : 'bg-white/10 text-white'}`}>
                            {m.type}
                          </div>
                          <div className="flex items-center justify-between gap-4 mt-2">
                            <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight text-white">{m.tA.name}</p>
                            <div className={`flex items-center gap-2 bg-black/60 p-1 rounded-2xl border ${isWinnerHighlight ? 'border-[#FFCB2B]' : 'border-[#FFCB2B]/30'}`}>
                              <input type="text" inputMode="numeric" disabled={!isAdmin || isTournamentOver} value={m.sA === 0 && isAdmin ? "" : m.sA} placeholder="0" onChange={e => updateKnockoutScore(idx, 'A', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none" />
                              <div className={`h-4 w-px ${isWinnerHighlight ? 'bg-[#FFCB2B]' : 'bg-[#FFCB2B]/50'}`} />
                              <input type="text" inputMode="numeric" disabled={!isAdmin || isTournamentOver} value={m.sB === 0 && isAdmin ? "" : m.sB} placeholder="0" onChange={e => updateKnockoutScore(idx, 'B', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none" />
                            </div>
                            <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight text-white">{m.tB.name}</p>
                          </div>
                          
                          {/* TYPO-SAFE BUTTON */}
                          {isAdmin && canFinalize && (
                            <motion.button initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onClick={() => confirmKnockout(idx)} className="w-full mt-5 bg-green-500/20 text-green-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border border-green-500/30">
                              <Check size={14} className="inline mr-1 mb-0.5"/> Finalize Match
                            </motion.button>
                          )}
                        </div>
                      )
                    })}
                    <div className="w-full h-px bg-white/10 my-8"></div>
                  </div>
                )}

                {isAdmin && !data?.knockouts && isKnockoutReady && (
                  <button onClick={generateKnockouts} className="w-full bg-gradient-to-r from-orange-500 to-[#FFCB2B] text-black py-5 rounded-[2rem] font-black uppercase shadow-2xl mb-6 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <Swords size={18}/> {knockoutButtonText}
                  </button>
                )}

                {isAdmin && !data?.knockouts && !isKnockoutReady && data?.matches?.length > 0 && (
                  <div className="w-full bg-white/5 text-slate-400 py-4 rounded-[2rem] font-bold uppercase text-[10px] tracking-widest text-center mb-6 flex items-center justify-center gap-2 border border-white/5">
                    <ShieldAlert size={14}/> Complete all matches to advance
                  </div>
                )}

                {(data?.matches || []).map((m, idx) => {
                  const lockGroupStage = isTournamentOver || isGroupStageLocked;
                  const canFinalize = (m.sA >= 11 || m.sB >= 11) && Math.abs(m.sA - m.sB) >= 2 && !m.done;

                  return (
                  <div key={m.id} className={`relative p-6 rounded-[2.5rem] bg-white/5 border border-white/10 transition-all ${m.done ? 'opacity-30' : 'shadow-lg'}`}>
                    {data.pools === 2 && (
                       <div className="absolute top-0 right-0 bg-[#FFCB2B]/10 text-[#FFCB2B] px-3 py-1 rounded-bl-xl rounded-tr-[2.5rem] text-[8px] font-black uppercase tracking-widest">
                         Pool {m.pool}
                       </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight text-slate-300">
                        <span className="text-white">{m.tA.p1}</span><br/>&<br/><span className="text-white">{m.tA.p2}</span>
                      </p>
                      <div className="flex items-center gap-2 bg-black/60 p-1 rounded-2xl border border-white/5 mt-2">
                        <input type="text" inputMode="numeric" disabled={!isAdmin || lockGroupStage} value={m.sA === 0 && isAdmin ? "" : m.sA} placeholder="0" onChange={e => updateScore(idx, 'A', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none" />
                        <div className="h-4 w-px bg-white/10" />
                        <input type="text" inputMode="numeric" disabled={!isAdmin || lockGroupStage} value={m.sB === 0 && isAdmin ? "" : m.sB} placeholder="0" onChange={e => updateScore(idx, 'B', e.target.value)} className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none" />
                      </div>
                      <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight text-slate-300">
                         <span className="text-white">{m.tB.p1}</span><br/>&<br/><span className="text-white">{m.tB.p2}</span>
                      </p>
                    </div>

                    {/* TYPO-SAFE BUTTON */}
                    {isAdmin && canFinalize && (
                      <motion.button initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onClick={() => confirmMatch(idx)} className="w-full mt-5 bg-green-500/20 text-green-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border border-green-500/30">
                        <Check size={14} className="inline mr-1 mb-0.5"/> Finalize Match
                      </motion.button>
                    )}
                  </div>
                )})}
              </motion.div>
            ) : (
              <motion.div key="table" initial={{opacity:0, y: 20}} animate={{opacity:1, y: 0}} className="space-y-6">
                {data?.pools === 2 ? (
                  <>
                    {renderTable(standings.filter(t => t.pool === 'A'), 'Group A')}
                    {renderTable(standings.filter(t => t.pool === 'B'), 'Group B')}
                  </>
                ) : (
                  renderTable(standings)
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {!isSetupMode && (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] bg-black/60 backdrop-blur-3xl rounded-full p-2 flex border border-white/10 shadow-2xl z-40">
          <div className="absolute h-[calc(100%-16px)] w-[calc(50%-8px)] bg-[#FFCB2B] rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
               style={{ transform: `translateX(${activeTab === 'matches' ? '0' : '100%'})` }} />
          <button onClick={() => { triggerHaptic(30); setActiveTab('matches'); }} className={`relative z-10 flex-1 py-4 flex items-center justify-center gap-2 transition-colors duration-500 ${activeTab === 'matches' ? 'text-black font-black' : 'text-slate-500 uppercase text-[10px]'}`}>
            <LayoutGrid size={20} />{activeTab === 'matches' && "Fixtures"}
          </button>
          <button onClick={() => { triggerHaptic(30); setActiveTab('standings'); }} className={`relative z-10 flex-1 py-4 flex items-center justify-center gap-2 transition-colors duration-500 ${activeTab === 'standings' ? 'text-black font-black' : 'text-slate-500 uppercase text-[10px]'}`}>
            <Users size={20} />{activeTab === 'standings' && "Table"}
          </button>
        </nav>
      )}
    </div>
  );
}