import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove } from "firebase/database";
import { 
  Trophy, Users, LayoutGrid, Lock, Unlock, Plus, Trash2, Zap, 
  UsersRound, Check, AlertTriangle, Swords, ShieldAlert, SplitSquareHorizontal, 
  Crown, ChevronLeft, CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- PREMIUM UI HELPERS ---
const avatarGradients = [
  "from-pink-500 to-rose-600", "from-violet-500 to-indigo-600", "from-blue-400 to-cyan-600",
  "from-teal-400 to-emerald-600", "from-amber-400 to-orange-600", "from-red-500 to-red-700",
  "from-fuchsia-500 to-purple-700", "from-sky-400 to-blue-700", "from-lime-400 to-green-700",
  "from-yellow-400 to-amber-600", "from-emerald-400 to-teal-700", "from-cyan-400 to-sky-600",
  "from-purple-500 to-pink-600", "from-rose-400 to-red-600", "from-orange-500 to-red-600"
];

const getGradient = (name) => {
  if (!name) return avatarGradients[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash) + (name.charCodeAt(0) * 13);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
};

const PlayerAvatar = ({ name, className = "" }) => (
  <div className={`relative flex items-center justify-center rounded-full text-white font-black bg-gradient-to-br ${getGradient(name)} ${className} shadow-[0_0_10px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.3)] ring-1 ring-white/20`}>
    <span className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] z-10">{name.charAt(0).toUpperCase()}</span>
    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
  </div>
);

const SpectatorScore = ({ score }) => (
  <motion.div key={score} initial={{ scale: 1.8, color: '#4ade80', textShadow: '0px 0px 20px rgba(74,222,128,1)' }} animate={{ scale: 1, color: '#FFCA28', textShadow: '0px 0px 0px rgba(255,202,40,0)' }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-12 h-12 flex items-center justify-center text-xl font-black text-[#FFCA28]">
    {score}
  </motion.div>
);

export default function App() {
  // --- NEW MULTI-TOURNAMENT STATE ---
  const [tournaments, setTournaments] = useState({});
  const [roster, setRoster] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);
  const [newTourneyName, setNewTourneyName] = useState('');
  
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

  // Active Data Pointer
  const data = activeTournamentId ? tournaments[activeTournamentId] : null;

  useEffect(() => {
    const dbRef = ref(db);
    return onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      setTournaments(val?.tournaments || {});
      setRoster(val?.roster || []);
      setLoading(false);
    });
  }, []);

  const triggerHaptic = (pattern) => {
    if (window.navigator?.vibrate) window.navigator.vibrate(pattern);
  };

  const showAlert = (title, message, confirmAction = null, confirmText = 'Confirm', isDestructive = true) => {
    setModal({ show: true, title, message, onConfirm: confirmAction, confirmText, isDestructive });
  };

  // --- DASHBOARD ACTIONS ---
  const createTournament = (e) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;
    triggerHaptic([50, 50]);
    const id = Date.now().toString();
    set(ref(db, `tournaments/${id}`), {
      id,
      name: newTourneyName.trim(),
      status: 'draft',
      createdAt: Date.now(),
      draftPlayers: []
    });
    setNewTourneyName('');
    setActiveTournamentId(id);
    setActiveTab('matches');
    setDismissCelebration(false);
  };

  const deleteTournament = (id) => {
    showAlert("Delete Tournament?", "This will permanently delete this tournament and its history.", () => {
      remove(ref(db, `tournaments/${id}`));
      if (activeTournamentId === id) setActiveTournamentId(null);
      setModal({ show: false });
    }, "Delete", true);
  };

  // --- TOURNAMENT ACTIONS ---
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
    const pName = newPlayer.trim();
    if (!pName) return;

    const currentDraft = data?.draftPlayers || [];
    if (currentDraft.some(p => p.toLowerCase() === pName.toLowerCase())) {
      triggerHaptic([50, 50, 100]); 
      return showAlert("Duplicate Player", `"${pName}" is already in the draft. Add a last initial if it's a different person.`, () => setModal({ show: false }), "Got it", false);
    }

    triggerHaptic(50);
    const updates = {};
    updates[`tournaments/${activeTournamentId}/draftPlayers`] = [...currentDraft, pName];
    if (!roster.some(p => p.toLowerCase() === pName.toLowerCase())) updates['roster'] = [...roster, pName];
    
    update(ref(db), updates);
    setNewPlayer('');
  };

  const toggleDraftPlayer = (pName, isDrafting) => {
    triggerHaptic(40);
    const currentDraft = data?.draftPlayers || [];
    let newDraft = isDrafting ? [...currentDraft, pName] : currentDraft.filter(p => p !== pName);
    update(ref(db, `tournaments/${activeTournamentId}`), { draftPlayers: newDraft });
  };

  const promptAutoTournament = () => {
    const activePlayers = data?.draftPlayers || [];
    if (activePlayers.length < 4) return showAlert("Invalid Roster", "Need at least 4 players.");
    
    triggerHaptic(30);
    showAlert("Generate Teams?", `Ready to auto-generate fixtures for ${activePlayers.length} players?`, () => { setModal({ show: false }); executeAutoTournament(); }, "Start League", false);
  };

  const executeAutoTournament = () => {
    const activePlayers = data?.draftPlayers || [];
    triggerHaptic([100, 50, 100]);

    if (activePlayers.length % 2 !== 0) {
      const matches = [];
      let matchId = 0;
      let playCounts = {};
      activePlayers.forEach(p => playCounts[p] = 0);
      const totalMatches = activePlayers.length; 

      for (let m = 0; m < totalMatches; m++) {
        let availablePlayers = [...activePlayers].sort(() => 0.5 - Math.random());
        availablePlayers.sort((a, b) => playCounts[a] - playCounts[b]);
        const selected = availablePlayers.slice(0, 4);
        selected.forEach(p => playCounts[p]++);
        const court = selected.sort(() => 0.5 - Math.random());
        
        matches.push({
          id: matchId++,
          tA: { name: `${court[0]} & ${court[1]}`, p1: court[0], p2: court[1] },
          tB: { name: `${court[2]} & ${court[3]}`, p1: court[2], p2: court[3] },
          sA: 0, sB: 0, done: false
        });
      }
      update(ref(db, `tournaments/${activeTournamentId}`), { format: 'mixer', pools: 1, players: activePlayers, matches, status: 'active' });
    } else {
      const shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
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
    const activePlayers = data?.draftPlayers || [];

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
      update(ref(db, `tournaments/${activeTournamentId}`), { format: 'fixed', pools: 2, players: activePlayers, teams: shuffled, matches: matches.sort(() => 0.5 - Math.random()), status: 'active' });
    } else {
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({ id: matchId++, tA: teams[i], tB: teams[j], sA: 0, sB: 0, done: false });
        }
      }
      update(ref(db, `tournaments/${activeTournamentId}`), { format: 'fixed', pools: 1, players: activePlayers, teams, matches: matches.sort(() => 0.5 - Math.random()), status: 'active' });
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
    updates[`tournaments/${activeTournamentId}/matches/${mIdx}/${team === 'A' ? 'sA' : 'sB'}`] = score;
    updates[`tournaments/${activeTournamentId}/matches/${mIdx}/done`] = false; 
    update(ref(db), updates);
  };

  const confirmMatch = (mIdx) => {
    triggerHaptic([100, 50, 100]);
    update(ref(db), { [`tournaments/${activeTournamentId}/matches/${mIdx}/done`]: true });
  };

  const updateKnockoutScore = (idx, team, val) => {
    if (!isAdmin) return;
    triggerHaptic(30);
    const cleanStr = val.replace(/[^0-9]/g, ''); 
    const score = cleanStr === "" ? 0 : parseInt(cleanStr); 
    const newKnockouts = [...data.knockouts];
    newKnockouts[idx][team === 'A' ? 'sA' : 'sB'] = score;
    newKnockouts[idx].done = false;
    set(ref(db, `tournaments/${activeTournamentId}/knockouts`), newKnockouts);
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
        newKnockouts.push({ id: 'final', type: '🏆 GRAND FINAL', tA: winner1, tB: winner2, sA: 0, sB: 0, done: false });
        triggerHaptic([100, 100, 200, 200]); 
      }
    }
    set(ref(db, `tournaments/${activeTournamentId}/knockouts`), newKnockouts);
  };

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
            if (m.sA > m.sB) { tA.w++; tA.pts += 2; tA.form.push('W'); tB.form.push('L'); } 
            else { tB.w++; tB.pts += 2; tB.form.push('W'); tA.form.push('L'); }
          } else {
            tA.rem++; tB.rem++;
          }
        }
      });
    }

    stats.sort((a, b) => b.pts - a.pts || b.pd - a.pd);

    const determineStatus = (poolStats, qCount) => {
      const totalTeams = poolStats.length;
      poolStats.forEach(t => { t.maxPts = t.pts + (t.rem * 2); t.form = t.form.slice(-4); });
      const allDone = poolStats.every(t => t.rem === 0);
      
      poolStats.forEach((t, i) => {
        if (allDone) { t.status = i < qCount ? 'Q' : 'E'; } 
        else {
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
  const needsKnockouts = data?.format === 'mixer' || standings.length > 2;
  const allMatchesDone = data?.matches?.length > 0 && data.matches.every(m => m.done);
  
  const isTournamentOver = data?.knockouts?.length > 0 ? finalMatch?.done : (!needsKnockouts && allMatchesDone); 
  const tournamentWinner = isTournamentOver ? (data?.knockouts?.length > 0 ? (finalMatch.sA > finalMatch.sB ? finalMatch.tA.name : finalMatch.tB.name) : standings[0]?.name) : null;
  const isGroupStageLocked = data?.knockouts?.length > 0;

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
      knockouts.push({ id: 'final', type: '🏆 GRAND FINAL', tA: { name: `${top4[0].name} & ${top4[3].name}`, p1: top4[0].name, p2: top4[3].name }, tB: { name: `${top4[1].name} & ${top4[2].name}`, p1: top4[1].name, p2: top4[2].name }, sA: 0, sB: 0, done: false });
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
    set(ref(db, `tournaments/${activeTournamentId}/knockouts`), knockouts);
    setActiveTab('matches');
  };

  const renderTable = (tableStandings, title = null) => (
    <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl mb-8">
      {title && <div className="bg-gradient-to-r from-[#FFCA28]/20 to-transparent p-3 pl-6 text-[#FFCA28] font-black uppercase text-[10px] tracking-widest border-b border-white/10">{title}</div>}
      <div className="flex items-center px-4 sm:px-6 py-3 border-b border-white/5 bg-black/20 text-[9px] font-black text-slate-500 uppercase">
        <div className="flex-1 pr-2 pl-1">Team</div>
        <div className="w-8 text-center">P</div>
        <div className="w-8 text-center">W</div>
        <div className="w-12 text-center text-[#FFCA28]">Pts</div>
        <div className="w-10 text-right">PD</div>
      </div>
      <div className="relative">
        <AnimatePresence>
          {tableStandings.map((t, i) => {
            const isQ = t.status === 'Q';
            const isE = t.status === 'E';
            const rowClass = isQ ? 'bg-green-500/10' : (isE ? 'opacity-40 grayscale' : (i === 0 ? 'bg-gradient-to-r from-[#FFCA28]/10 to-transparent' : 'bg-transparent'));
            const badgeText = isQ ? 'Q' : (isE ? 'E' : (i + 1));
            return (
              <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key={t.name} className={`flex items-center px-4 sm:px-6 py-4 border-b border-white/5 last:border-0 transition-colors ${rowClass}`}>
                <div className="flex-1 flex items-center gap-2.5 overflow-hidden pr-2">
                  {isQ || isE ? (
                    <span className={`w-5 h-5 rounded-[4px] flex items-center justify-center text-[9px] font-black shrink-0 ${isQ ? 'bg-green-500 text-[#031123] shadow-[0_0_10px_rgba(74,222,128,0.4)]' : 'bg-red-500/80 text-white'}`}>{badgeText}</span>
                  ) : <span className="w-5 text-center text-[11px] font-black text-slate-500 shrink-0">{badgeText}</span>}
                  
                  <div className="flex -space-x-2 shrink-0">
                    {t.p1 ? (
                      <><PlayerAvatar name={t.p1} className="w-7 h-7 text-[9px] z-10 shadow-[2px_0_8px_rgba(0,0,0,0.6)]" />{t.p2 && <PlayerAvatar name={t.p2} className="w-7 h-7 text-[9px] z-0" />}</>
                    ) : <PlayerAvatar name={t.name} className="w-7 h-7 text-[9px]" />}
                  </div>

                  <div className="flex flex-col justify-center min-w-0 py-1">
                    <span className="text-[11px] sm:text-xs uppercase italic font-black tracking-tighter text-white leading-[1.1] line-clamp-2 whitespace-normal break-words">{t.name}</span>
                    <div className="flex gap-1 mt-1.5">
                      {t.form.length > 0 ? t.form.map((res, fIdx) => <div key={fIdx} className={`w-1.5 h-1.5 rounded-full ${res === 'W' ? 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-red-500'}`} />) : <><div className="w-1.5 h-1.5 rounded-full bg-white/10" /><div className="w-1.5 h-1.5 rounded-full bg-white/10" /><div className="w-1.5 h-1.5 rounded-full bg-white/10" /></>}
                    </div>
                  </div>
                </div>
                <div className="w-8 text-center text-sm font-bold text-slate-400">{t.p}</div>
                <div className="w-8 text-center text-sm font-bold text-slate-300">{t.w}</div>
                <div className="w-12 text-center text-xl font-black text-[#FFCA28] drop-shadow-md">{t.pts}</div>
                <div className="w-10 text-right text-xs font-mono font-bold text-slate-400">{t.pd > 0 ? `+${t.pd}` : t.pd}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );

  if (loading) return <div className="h-[100dvh] bg-[#031123]" />;

  // ==========================================
  // VIEW 1: THE TOURNAMENT DASHBOARD (HUB)
  // ==========================================
  if (!activeTournamentId) {
    const sortedTournaments = Object.values(tournaments).sort((a, b) => b.createdAt - a.createdAt);

    return (
      <div className="max-w-md mx-auto h-[100dvh] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0B1E36] via-[#031123] to-[#010812] text-white font-sans selection:bg-[#FFCA28]/30 relative">
        <header className="flex-none p-4 flex justify-between items-center z-50 border-b border-white/5 bg-gradient-to-b from-[#031123] to-[#031123]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <img src="/p-pro-s.png" alt="P-PRO Logo" className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,202,40,0.3)]" />
            <h1 className="text-2xl font-black italic tracking-tighter uppercase drop-shadow-md text-white mt-0.5">P-PRO <span className="text-[#FFCA28]">OS</span></h1>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isAdmin ? 'bg-gradient-to-tr from-[#F57C00] to-[#FFCA28] shadow-[0_0_15px_rgba(245,124,0,0.5)] text-[#031123]' : 'bg-white/5 opacity-40 text-white'}`}>
            {isAdmin ? <Unlock size={18}/> : <Lock size={18}/>}
          </motion.button>
        </header>

        <main className="flex-1 p-6 overflow-y-auto space-y-8">
          {/* Create New Block */}
          <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 p-6 rounded-[2.5rem] shadow-xl">
            <h3 className="text-[10px] font-black uppercase text-[#FFCA28] tracking-widest mb-4 flex items-center gap-2"><Zap size={14}/> Start New Event</h3>
            <form onSubmit={createTournament} className="flex gap-2">
              <input value={newTourneyName} onChange={e => setNewTourneyName(e.target.value)} placeholder="Tournament Name..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#FFCA28] text-white" />
              <motion.button whileTap={{ scale: 0.9 }} type="submit" className="bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] w-14 h-14 rounded-2xl flex items-center justify-center"><Plus/></motion.button>
            </form>
          </div>

          {/* History List */}
          <div>
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4 px-2">Recent Tournaments</h3>
            <div className="space-y-4">
              {sortedTournaments.length === 0 ? (
                <div className="py-10 text-center text-white/30 text-xs font-bold uppercase tracking-widest border border-dashed border-white/10 rounded-[2rem]">No History Found</div>
              ) : (
                sortedTournaments.map(t => {
                  const isFinished = t.knockouts?.find(k => k.id === 'final')?.done || (t.matches && t.matches.every(m => m.done) && t.status !== 'draft');
                  const tChamp = isFinished ? (t.knockouts?.length > 0 ? (t.knockouts.find(k=>k.id==='final').sA > t.knockouts.find(k=>k.id==='final').sB ? t.knockouts.find(k=>k.id==='final').tA.name : t.knockouts.find(k=>k.id==='final').tB.name) : "Completed") : null;

                  return (
                    <motion.div whileTap={{ scale: 0.98 }} key={t.id} className="relative bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 p-5 rounded-[2rem] shadow-xl flex items-center justify-between group cursor-pointer" onClick={() => { triggerHaptic(30); setActiveTournamentId(t.id); }}>
                      <div className="flex flex-col gap-1">
                        <h4 className="text-lg font-black italic tracking-tighter uppercase text-white">{t.name}</h4>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                          <span className="flex items-center gap-1"><CalendarDays size={12}/> {new Date(t.createdAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><UsersRound size={12}/> {t.players?.length || t.draftPlayers?.length || 0} Players</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {tChamp ? (
                          <div className="flex flex-col items-end">
                            <Crown size={18} className="text-[#FFCA28] mb-1" />
                            <span className="text-[8px] text-[#FFCA28] font-black uppercase tracking-widest bg-[#FFCA28]/10 px-2 py-1 rounded-full">{tChamp.substring(0, 10)}{tChamp.length > 10 ? '...' : ''}</span>
                          </div>
                        ) : (
                          <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'draft' ? 'bg-white/10 text-white' : 'bg-green-500/20 text-green-400'}`}>
                            {t.status === 'draft' ? 'Setup' : 'Live'}
                          </div>
                        )}
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }} className="p-2 text-white/20 hover:text-red-500 bg-black/40 rounded-xl transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: THE ACTIVE TOURNAMENT
  // ==========================================
  const isSetupMode = !data || data.status !== 'active';
  const draftPlayers = data?.draftPlayers || [];
  const benchedPlayers = roster.filter(p => !draftPlayers.some(dp => dp.toLowerCase() === p.toLowerCase()));
  const availablePlayersForManual = draftPlayers.filter(p => !manualTeams.some(team => team.name.includes(p)));

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0B1E36] via-[#031123] to-[#010812] text-white font-sans selection:bg-[#FFCA28]/30 relative">
      
      <AnimatePresence>
        {isTournamentOver && !dismissCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 bg-[#031123]/95 backdrop-blur-3xl">
            <motion.div animate={{ scale: [0.9, 1.1, 1], rotate: [0, -5, 5, 0] }} transition={{ duration: 1, ease: "easeOut" }} className="text-[#FFCA28] mb-8 relative">
              <div className="absolute inset-0 blur-3xl bg-[#FFCA28]/40 rounded-full animate-pulse"></div>
              <Crown size={100} className="relative z-10 drop-shadow-[0_0_30px_rgba(255,202,40,0.8)]" />
            </motion.div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FFCA28]/60 mb-2">Tournament Champions</h2>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-4xl font-black italic uppercase tracking-tighter text-center mb-12 text-white drop-shadow-2xl">{tournamentWinner}</motion.h1>
            <motion.button whileTap={{ scale: 0.9 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} onClick={() => { triggerHaptic(30); setDismissCelebration(true); }} className="px-10 py-4 rounded-full bg-white/10 font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-colors border border-white/20">View Final Board</motion.button>
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

      {/* ACTIVE TOURNAMENT HEADER */}
      <header className="flex-none p-4 flex justify-between items-center z-50 border-b border-white/5 bg-gradient-to-b from-[#031123] to-[#031123]/80 backdrop-blur-xl">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { triggerHaptic(50); setActiveTournamentId(null); }} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white">
          <ChevronLeft size={20}/>
        </motion.button>
        <div className="flex flex-col items-center">
           <h1 className="text-sm font-black italic tracking-tighter uppercase text-white leading-tight">{data?.name || "Tournament"}</h1>
           <span className="text-[8px] text-[#FFCA28] font-bold uppercase tracking-widest">Live Event</span>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isAdmin ? 'bg-gradient-to-tr from-[#F57C00] to-[#FFCA28] shadow-[0_0_15px_rgba(245,124,0,0.5)] text-[#031123]' : 'bg-white/5 opacity-40 text-white'}`}>
          {isAdmin ? <Unlock size={18}/> : <Lock size={18}/>}
        </motion.button>
      </header>

      <main className="flex-1 p-6 pb-32 overflow-y-auto overflow-x-hidden">
        {isSetupMode ? (
          <div className="space-y-6">
            {!isManualMode ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {/* ACTIVE DRAFT SECTION */}
                <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 p-6 rounded-[2.5rem] shadow-xl">
                  <h3 className="text-[10px] font-black uppercase text-[#FFCA28] tracking-widest mb-4">Draft New Player</h3>
                  <form onSubmit={addPlayer} className="flex gap-2 mb-6">
                    <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} placeholder="Type a name..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#FFCA28] text-white" />
                    <motion.button whileTap={{ scale: 0.9 }} type="submit" className="bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] w-14 h-14 rounded-2xl flex items-center justify-center"><Plus/></motion.button>
                  </form>
                  
                  {draftPlayers.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                      {draftPlayers.map((p, i) => (
                        <motion.div layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={p} className="flex justify-between items-center bg-white/5 pl-2 pr-4 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-tighter">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar name={p} className="w-6 h-6 text-[8px]" />
                            <span className="truncate max-w-[60px]">{p}</span>
                          </div>
                          <button onClick={() => toggleDraftPlayer(p, false)} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-white/30 text-xs font-bold uppercase tracking-widest border border-dashed border-white/10 rounded-2xl">
                      Draft is empty
                    </div>
                  )}
                </div>

                {/* THE BENCH (AVAILABLE ROSTER) */}
                {benchedPlayers.length > 0 && (
                  <div className="mt-8 bg-black/20 p-5 rounded-[2rem] border border-white/5">
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4 flex items-center gap-2">
                      <UsersRound size={12} /> The Bench (Tap to Draft)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {benchedPlayers.map(p => (
                        <motion.button layout whileTap={{ scale: 0.9 }} key={p} onClick={() => toggleDraftPlayer(p, true)} className="flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors shadow-lg">
                          <PlayerAvatar name={p} className="w-5 h-5 text-[8px] grayscale opacity-60" />
                          <span className="text-[10px] font-black uppercase tracking-tight">{p}</span>
                          <Plus size={12} className="ml-1 opacity-40" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* START BUTTONS */}
                {draftPlayers.length >= 4 && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={promptAutoTournament} className="bg-gradient-to-r from-[#FFCA28]/10 to-transparent border border-[#FFCA28]/20 p-6 rounded-[2.2rem] flex flex-col items-center hover:bg-white/10 transition-colors">
                      <Zap className="text-[#FFCA28] mb-2 drop-shadow-md" />
                      <p className="text-[10px] font-black uppercase text-[#FFCA28]">Auto Draft</p>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => { triggerHaptic(60); setIsManualMode(true); }} className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center hover:bg-white/10 transition-colors">
                      <UsersRound className="text-white/50 mb-2 drop-shadow-md" />
                      <p className="text-[10px] font-black uppercase text-white">Manual Teams</p>
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
                  {availablePlayersForManual.map((p, i) => (
                    <motion.button whileTap={{ scale: 0.95 }} key={i} onClick={() => handleManualSelect(p)} className={`flex items-center gap-2 pl-2 pr-5 py-2 rounded-full border transition-all font-black text-[11px] uppercase shadow-lg ${selectedPlayers.includes(p) ? 'bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] border-transparent' : 'bg-white/5 border-white/10 text-white'}`}>
                      <PlayerAvatar name={p} className="w-8 h-8 text-[10px]" />
                      {p}
                    </motion.button>
                  ))}
                </div>
                {availablePlayersForManual.length < 2 && manualTeams.length > 0 && (
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
                  
                  {data?.knockouts && (
                    <div className="mb-10 space-y-4">
                      <h3 className="flex items-center justify-center gap-2 text-[#FFCA28] font-black uppercase tracking-widest text-xs mb-6 mt-2 drop-shadow-md"><Trophy size={14}/> Knockout Stage</h3>
                      {data.knockouts.map((m, idx) => {
                        const isWinnerHighlight = m.id === 'final' && m.done;
                        const cardClass = isWinnerHighlight ? 'bg-gradient-to-br from-[#FFCA28]/20 to-[#F57C00]/10 border-2 border-[#FFCA28] shadow-[0_0_40px_rgba(255,202,40,0.3)] z-10 scale-[1.02]' : (m.done ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 shadow-xl');
                        const canFinalize = (m.sA >= 11 || m.sB >= 11) && Math.abs(m.sA - m.sB) >= 2 && !m.done;
                        const aWon = m.done && m.sA > m.sB;
                        const bWon = m.done && m.sB > m.sA;

                        return (
                          <div key={m.id} className={`relative p-6 rounded-[2.5rem] transition-all duration-500 pt-8 ${cardClass}`}>
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1 rounded-b-xl text-[8px] font-black uppercase tracking-widest whitespace-nowrap shadow-md ${isWinnerHighlight ? 'bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123]' : 'bg-white/10 text-white border border-t-0 border-white/10'}`}>
                              {m.type}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <div className={`w-1/3 flex flex-col items-center gap-2 relative transition-all ${m.done && !aWon ? 'opacity-40 grayscale scale-95' : ''}`}>
                                {isWinnerHighlight && aWon && <Crown size={24} className="text-[#FFCA28] absolute -top-8 drop-shadow-md" />}
                                <div className="flex -space-x-2">
                                  <PlayerAvatar name={m.tA.p1} className="w-10 h-10 text-[12px] z-10 shadow-[2px_0_8px_rgba(0,0,0,0.6)]" />
                                  {m.tA.p2 && <PlayerAvatar name={m.tA.p2} className="w-10 h-10 text-[12px] z-0" />}
                                </div>
                                <p className="text-center text-[9px] font-black uppercase tracking-tighter leading-tight text-white line-clamp-2">{m.tA.name}</p>
                              </div>
                              <div className={`flex items-center gap-2 bg-black/60 p-1 rounded-2xl border ${isWinnerHighlight ? 'border-[#FFCA28]' : 'border-white/10'}`}>
                                {isAdmin && (!isTournamentOver || m.id === 'final') ? (
                                  <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sA === 0 ? "" : m.sA} placeholder="0" onChange={e => updateKnockoutScore(idx, 'A', e.target.value)} className={`w-12 h-12 bg-transparent text-center text-xl font-black outline-none ${m.done && !aWon ? 'text-white/40' : 'text-[#FFCA28]'}`} />
                                ) : <SpectatorScore score={m.sA} />}
                                <div className={`h-4 w-px ${isWinnerHighlight ? 'bg-[#FFCA28]' : 'bg-white/20'}`} />
                                {isAdmin && (!isTournamentOver || m.id === 'final') ? (
                                  <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sB === 0 ? "" : m.sB} placeholder="0" onChange={e => updateKnockoutScore(idx, 'B', e.target.value)} className={`w-12 h-12 bg-transparent text-center text-xl font-black outline-none ${m.done && !bWon ? 'text-white/40' : 'text-[#FFCA28]'}`} />
                                ) : <SpectatorScore score={m.sB} />}
                              </div>
                              <div className={`w-1/3 flex flex-col items-center gap-2 relative transition-all ${m.done && !bWon ? 'opacity-40 grayscale scale-95' : ''}`}>
                                {isWinnerHighlight && bWon && <Crown size={24} className="text-[#FFCA28] absolute -top-8 drop-shadow-md" />}
                                <div className="flex -space-x-2">
                                  <PlayerAvatar name={m.tB.p1} className="w-10 h-10 text-[12px] z-10 shadow-[2px_0_8px_rgba(0,0,0,0.6)]" />
                                  {m.tB.p2 && <PlayerAvatar name={m.tB.p2} className="w-10 h-10 text-[12px] z-0" />}
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

                  {isAdmin && !data?.knockouts && needsKnockouts && isKnockoutReady && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={generateKnockouts} className="w-full bg-gradient-to-r from-[#FFCA28] to-[#F57C00] text-[#031123] py-5 rounded-[2rem] font-black uppercase shadow-[0_10px_30px_rgba(245,124,0,0.3)] mb-6 flex items-center justify-center gap-2 transition-transform">
                      <Swords size={18}/> {knockoutButtonText}
                    </motion.button>
                  )}

                  {isAdmin && !data?.knockouts && needsKnockouts && !isKnockoutReady && data?.matches?.length > 0 && (
                    <div className="w-full bg-white/5 text-slate-400 py-4 rounded-[2rem] font-bold uppercase text-[10px] tracking-widest text-center mb-6 flex items-center justify-center gap-2 border border-white/5">
                      <ShieldAlert size={14}/> Complete matches to advance
                    </div>
                  )}

                  <motion.div layout className="space-y-4">
                    {(data?.matches || []).map((m, idx) => {
                      const lockGroupStage = isTournamentOver || isGroupStageLocked;
                      const canFinalize = (m.sA >= 11 || m.sB >= 11) && Math.abs(m.sA - m.sB) >= 2 && !m.done;
                      const aWon = m.done && m.sA > m.sB;
                      const bWon = m.done && m.sB > m.sA;

                      return (
                      <motion.div layout key={m.id} className={`relative p-6 rounded-[2.5rem] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 transition-all ${m.done ? 'bg-white/5 border-white/10' : 'shadow-xl'}`}>
                        {data.pools === 2 && (
                          <div className="absolute top-0 right-0 bg-gradient-to-bl from-[#F57C00] to-[#FFCA28] text-[#031123] px-3 py-1 rounded-bl-xl rounded-tr-[2.5rem] text-[8px] font-black uppercase tracking-widest shadow-md">Pool {m.pool}</div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <div className={`w-1/3 flex flex-col items-center gap-2 transition-all ${m.done && !aWon ? 'opacity-40 grayscale scale-95' : ''}`}>
                            <div className="flex -space-x-2">
                              <PlayerAvatar name={m.tA.p1} className="w-9 h-9 text-[10px] z-10 shadow-[2px_0_8px_rgba(0,0,0,0.6)]" />
                              {m.tA.p2 && <PlayerAvatar name={m.tA.p2} className="w-9 h-9 text-[10px] z-0" />}
                            </div>
                            <p className="text-center text-[9px] font-black uppercase tracking-tighter leading-tight text-slate-300 line-clamp-2">{m.tA.name}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 bg-black/60 p-1 rounded-2xl border border-white/10 mt-2">
                            {isAdmin && !lockGroupStage ? <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sA === 0 ? "" : m.sA} placeholder="0" onChange={e => updateScore(idx, 'A', e.target.value)} className={`w-12 h-12 bg-transparent text-center text-xl font-black outline-none placeholder:text-white/20 ${m.done && !aWon ? 'text-white/40' : 'text-[#FFCA28]'}`} /> : <SpectatorScore score={m.sA} />}
                            <div className="h-4 w-px bg-white/20" />
                            {isAdmin && !lockGroupStage ? <input type="text" inputMode="numeric" disabled={!isAdmin} value={m.sB === 0 ? "" : m.sB} placeholder="0" onChange={e => updateScore(idx, 'B', e.target.value)} className={`w-12 h-12 bg-transparent text-center text-xl font-black outline-none placeholder:text-white/20 ${m.done && !bWon ? 'text-white/40' : 'text-[#FFCA28]'}`} /> : <SpectatorScore score={m.sB} />}
                          </div>

                          <div className={`w-1/3 flex flex-col items-center gap-2 transition-all ${m.done && !bWon ? 'opacity-40 grayscale scale-95' : ''}`}>
                            <div className="flex -space-x-2">
                              <PlayerAvatar name={m.tB.p1} className="w-9 h-9 text-[10px] z-10 shadow-[2px_0_8px_rgba(0,0,0,0.6)]" />
                              {m.tB.p2 && <PlayerAvatar name={m.tB.p2} className="w-9 h-9 text-[10px] z-0" />}
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