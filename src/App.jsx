import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove } from "firebase/database";
import { 
  Trophy, Users, LayoutGrid, Lock, Unlock, RotateCcw, 
  Plus, Trash2, Zap, UsersRound, Check, AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newPlayer, setNewPlayer] = useState('');
  
  // Modal States
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [manualTeams, setManualTeams] = useState([]);

  useEffect(() => {
    const tourneyRef = ref(db, 'tournament/');
    return onValue(tourneyRef, (snapshot) => {
      setData(snapshot.val());
      setLoading(false);
    });
  }, []);

  // --- Haptic Engine ---
  const triggerHaptic = (pattern) => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  };

  const showAlert = (title, message, confirmAction = null) => {
    setModal({ show: true, title, message, onConfirm: confirmAction });
  };

  // --- Logic Functions ---
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
    if (players.length < 4 || players.length % 2 !== 0) {
      showAlert("Invalid Roster", "You need an even number of players (minimum 4) to start.");
      return;
    }
    triggerHaptic([100, 50, 100]);
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const teams = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      teams.push({ id: i / 2, name: `${shuffled[i]} & ${shuffled[i + 1]}` });
    }
    finalizeTournament(teams);
  };

  const handleManualSelect = (player) => {
    triggerHaptic(30);
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== player));
      return;
    }
    if (selectedPlayers.length === 1) {
      triggerHaptic([50, 30, 50]);
      const newTeam = { id: manualTeams.length, name: `${selectedPlayers[0]} & ${player}` };
      setManualTeams([...manualTeams, newTeam]);
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers([player]);
    }
  };

  const finalizeTournament = (teams) => {
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({ id: `${i}-${j}`, tA: teams[i], tB: teams[j], sA: 0, sB: 0, done: false });
      }
    }
    update(ref(db, 'tournament/'), { teams, matches, status: 'active' });
    setIsManualMode(false);
    setManualTeams([]);
  };

  const updateScore = (mIdx, team, val) => {
    if (!isAdmin) return;
    triggerHaptic(30);
    const score = parseInt(val);
    if (isNaN(score)) return;

    const currentMatch = data.matches[mIdx];
    const sA = team === 'A' ? score : currentMatch.sA;
    const sB = team === 'B' ? score : currentMatch.sB;
    
    const updates = {};
    updates[`tournament/matches/${mIdx}/${team === 'A' ? 'sA' : 'sB'}`] = score;
    
    // Pickleball Win Condition: 11 points AND lead by 2
    const isDone = (sA >= 11 || sB >= 11) && Math.abs(sA - sB) >= 2;
    if (isDone) triggerHaptic([100, 50, 100]);
    updates[`tournament/matches/${mIdx}/done`] = isDone;
    
    update(ref(db), updates);
  };

  const standings = useMemo(() => {
    if (!data?.teams) return [];
    const stats = data.teams.map(t => ({ ...t, p: 0, w: 0, l: 0, pts: 0, pd: 0 }));
    data.matches?.filter(m => m.done).forEach(m => {
      const tA = stats.find(s => s.id === m.tA.id);
      const tB = stats.find(s => s.id === m.tB.id);
      if (tA && tB) {
        tA.p++; tB.p++;
        tA.pd += (m.sA - m.sB);
        tB.pd += (m.sB - m.sA);
        if (m.sA > m.sB) { tA.w++; tA.pts += 2; } 
        else { tB.w++; tB.pts += 2; }
      }
    });
    // Sort by Points, then by Point Difference (PD)
    return stats.sort((a, b) => b.pts - a.pts || b.pd - a.pd);
  }, [data]);

  if (loading) return <div className="h-screen bg-[#031123]" />;

  const isSetupMode = !data || data.status !== 'active';
  const availablePlayers = (data?.players || []).filter(p => !manualTeams.some(t => t.name.includes(p)));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#031123] text-white font-sans selection:bg-[#FFCB2B]/30">
      
      {/* MODAL SYSTEM */}
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
      </AnimatePresence>

      <header className="p-6 flex justify-between items-center sticky top-0 bg-[#031123]/95 backdrop-blur-xl z-50 border-b border-white/5">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase">P-PRO <span className="text-[#FFCB2B]">OS</span></h1>
        <div className="flex gap-2">
          <button onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isAdmin ? 'bg-orange-500' : 'bg-white/5 opacity-30'}`}>
            {isAdmin ? <Unlock size={18}/> : <Lock size={18}/>}
          </button>
          {isAdmin && (
            <button onClick={() => showAlert("Reset Data", "This will wipe the current tournament.", () => { remove(ref(db, 'tournament/')); setModal({show:false}); })} className="w-10 h-10 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center">
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
                {availablePlayers.length === 0 && manualTeams.length > 0 && (
                  <button onClick={() => finalizeTournament(manualTeams)} className="w-full bg-[#FFCB2B] text-black py-6 rounded-[2.5rem] font-black uppercase shadow-2xl">Start Matches</button>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'matches' ? (
              <motion.div key="fixtures" initial={{opacity:0, y: 20}} animate={{opacity:1, y: 0}} className="space-y-4">
                {data.matches.map((m, idx) => (
                  <div key={m.id} className={`p-6 rounded-[2.5rem] bg-white/5 border border-white/10 transition-all ${m.done ? 'opacity-30' : 'shadow-lg'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight">{m.tA.name}</p>
                      <div className="flex items-center gap-2 bg-black/60 p-1 rounded-2xl border border-white/5">
                        <input 
                          type="number" 
                          pattern="\d*" 
                          inputMode="numeric"
                          disabled={!isAdmin} 
                          value={m.sA} 
                          onChange={e => updateScore(idx, 'A', e.target.value)} 
                          className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none" 
                        />
                        <div className="h-4 w-px bg-white/10" />
                        <input 
                          type="number" 
                          pattern="\d*" 
                          inputMode="numeric"
                          disabled={!isAdmin} 
                          value={m.sB} 
                          onChange={e => updateScore(idx, 'B', e.target.value)} 
                          className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none" 
                        />
                      </div>
                      <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight">{m.tB.name}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div key="table" initial={{opacity:0, y: 20}} animate={{opacity:1, y: 0}} className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full">
                  <thead className="bg-white/5 text-[9px] font-black text-slate-500 uppercase">
                    <tr><th className="p-6 text-left">Team</th><th className="p-6">Pts</th><th className="p-6 text-right">PD</th></tr>
                  </thead>
                  <tbody>
                    {standings.map((t, i) => (
                      <tr key={t.id} className={`border-b border-white/5 last:border-0 font-black ${i === 0 ? 'bg-[#FFCB2B]/5' : ''}`}>
                        <td className="p-6 text-xs uppercase italic tracking-tighter">{t.name}</td>
                        <td className="p-6 text-center text-[#FFCB2B] font-bold text-lg">{t.pts}</td>
                        <td className="p-6 text-right text-xs text-slate-400">{t.pd > 0 ? `+${t.pd}` : t.pd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <Users size={20} />{activeTab === 'standings' && "Leaderboard"}
          </button>
        </nav>
      )}
    </div>
  );
}