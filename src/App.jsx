import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import {
  Trophy,
  Users,
  LayoutGrid,
  Lock,
  Unlock,
  RotateCcw,
  Plus,
  Trash2,
  Zap,
  UsersRound, // Fixed: Replaced UserGroup with UsersRound
  Check,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matches');
  const [isAdmin, setIsAdmin] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [newPlayer, setNewPlayer] = useState('');

  const [showResetModal, setShowResetModal] = useState(false);
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
    if (hapticsEnabled && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  };

  const hapticStyles = {
    light: 30,
    medium: 60,
    success: [50, 30, 50],
    warning: 100,
    heavy: [100, 50, 100],
  };

  // --- Setup Actions ---
  const addPlayer = (e) => {
    e?.preventDefault();
    if (!newPlayer.trim()) return;
    triggerHaptic(hapticStyles.success);
    const players = data?.players || [];
    set(ref(db, 'tournament/players'), [...players, newPlayer.trim()]);
    setNewPlayer('');
  };

  const removePlayer = (index) => {
    triggerHaptic(hapticStyles.medium);
    const players = [...data.players];
    players.splice(index, 1);
    set(ref(db, 'tournament/players'), players);
  };

  const startAutoTournament = () => {
    const players = data?.players || [];
    if (players.length < 4 || players.length % 2 !== 0) {
      alert('Need even number of players (min 4)');
      return;
    }
    triggerHaptic(hapticStyles.heavy);
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const teams = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      teams.push({ id: i / 2, name: `${shuffled[i]} & ${shuffled[i + 1]}` });
    }
    finalizeTournament(teams);
  };

  const handleManualSelect = (player) => {
    triggerHaptic(hapticStyles.light);
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(selectedPlayers.filter((p) => p !== player));
      return;
    }
    if (selectedPlayers.length === 1) {
      triggerHaptic(hapticStyles.success);
      const newTeam = {
        id: manualTeams.length,
        name: `${selectedPlayers[0]} & ${player}`,
      };
      setManualTeams([...manualTeams, newTeam]);
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers([player]);
    }
  };

  const finalizeTournament = (teams) => {
    triggerHaptic(hapticStyles.heavy);
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `${i}-${j}`,
          tA: teams[i],
          tB: teams[j],
          sA: 0,
          sB: 0,
          done: false,
        });
      }
    }
    update(ref(db, 'tournament/'), { teams, matches, status: 'active' });
    setIsManualMode(false);
  };

  const confirmReset = async () => {
    triggerHaptic(hapticStyles.heavy);
    await remove(ref(db, 'tournament/'));
    setShowResetModal(false);
    setIsManualMode(false);
    setManualTeams([]);
  };

  const updateScore = (mIdx, team, val) => {
    if (!isAdmin) return;
    triggerHaptic(hapticStyles.light);
    const score = parseInt(val) || 0;
    const currentMatch = data.matches[mIdx];
    const sA = team === 'A' ? score : currentMatch.sA;
    const sB = team === 'B' ? score : currentMatch.sB;
    const updates = {};
    updates[`tournament/matches/${mIdx}/${team === 'A' ? 'sA' : 'sB'}`] = score;
    const isDone = (sA >= 11 || sB >= 11) && Math.abs(sA - sB) >= 2;
    if (isDone) triggerHaptic(hapticStyles.success);
    updates[`tournament/matches/${mIdx}/done`] = isDone;
    update(ref(db), updates);
  };

  const standings = useMemo(() => {
    if (!data?.teams) return [];
    const stats = data.teams.map((t) => ({ ...t, p: 0, w: 0, l: 0, pts: 0 }));
    data.matches
      ?.filter((m) => m.done)
      .forEach((m) => {
        const tA = stats.find((s) => s.id === m.tA.id);
        const tB = stats.find((s) => s.id === m.tB.id);
        if (tA && tB) {
          tA.p++;
          tB.p++;
          if (m.sA > m.sB) {
            tA.w++;
            tA.pts += 2;
            tB.l++;
          } else {
            tB.w++;
            tB.pts += 2;
            tA.l++;
          }
        }
      });
    return stats.sort((a, b) => b.pts - a.pts);
  }, [data]);

  if (loading) return <div className="h-screen bg-[#031123]" />;

  const isSetupMode = !data || data.status !== 'active';
  const availablePlayers = (data?.players || []).filter(
    (p) => !manualTeams.some((t) => t.name.includes(p))
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#031123] text-white font-sans overflow-x-hidden selection:bg-[#FFCB2B]/30">
      {/* RESET MODAL */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-[#0a1f3d] border border-white/10 p-8 rounded-[3rem] w-full text-center shadow-2xl"
            >
              <RotateCcw size={40} className="mx-auto mb-6 text-red-500" />
              <h2 className="text-2xl font-black mb-2 tracking-tighter">
                Reset App?
              </h2>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    triggerHaptic(hapticStyles.light);
                    setShowResetModal(false);
                  }}
                  className="flex-1 bg-white/5 py-4 rounded-2xl font-bold"
                >
                  Back
                </button>
                <button
                  onClick={confirmReset}
                  className="flex-1 bg-red-600 py-4 rounded-2xl font-bold shadow-lg"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-6 flex justify-between items-center sticky top-0 bg-[#031123]/90 backdrop-blur-2xl z-50 border-b border-white/5">
        <h1 className="text-2xl font-black italic tracking-tighter">
          P-PRO <span className="text-[#FFCB2B]">OS</span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              triggerHaptic(hapticStyles.light);
              setHapticsEnabled(!hapticsEnabled);
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5"
          >
            {hapticsEnabled ? (
              <Volume2 size={18} className="text-[#FFCB2B]" />
            ) : (
              <VolumeX size={18} className="opacity-20" />
            )}
          </button>
          <button
            onClick={() => {
              triggerHaptic(hapticStyles.warning);
              setIsAdmin(!isAdmin);
            }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              isAdmin ? 'bg-orange-500 shadow-lg' : 'bg-white/5'
            }`}
          >
            {isAdmin ? (
              <Unlock size={18} />
            ) : (
              <Lock size={18} className="opacity-20" />
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                triggerHaptic(hapticStyles.warning);
                setShowResetModal(true);
              }}
              className="w-10 h-10 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="p-6 pb-32">
        {isSetupMode ? (
          <div className="space-y-6">
            {!isManualMode ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
                  <form onSubmit={addPlayer} className="flex gap-2 mb-6">
                    <input
                      value={newPlayer}
                      onChange={(e) => setNewPlayer(e.target.value)}
                      placeholder="Player Name..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#FFCB2B] transition-all"
                    />
                    <button
                      type="submit"
                      className="bg-[#FFCB2B] text-black w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                    >
                      <Plus />
                    </button>
                  </form>
                  <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {(data?.players || []).map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/5 text-xs font-bold"
                      >
                        {p}{' '}
                        <button
                          onClick={() => removePlayer(i)}
                          className="text-white/20"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startAutoTournament}
                    className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center"
                  >
                    <Zap className="text-[#FFCB2B] mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      Auto Shuffle
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(hapticStyles.medium);
                      setIsManualMode(true);
                    }}
                    className="bg-white/5 border border-white/10 p-6 rounded-[2.2rem] flex flex-col items-center"
                  >
                    <UsersRound className="text-[#FFCB2B] mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      Manual Build
                    </p>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="space-y-6"
              >
                <header className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">
                    Team Draft
                  </h3>
                  <button
                    onClick={() => {
                      triggerHaptic(hapticStyles.light);
                      setIsManualMode(false);
                    }}
                    className="text-[#FFCB2B] font-black uppercase text-[10px]"
                  >
                    Cancel
                  </button>
                </header>
                <div className="flex flex-wrap gap-2">
                  {availablePlayers.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleManualSelect(p)}
                      className={`px-5 py-4 rounded-2xl border transition-all font-black text-[11px] ${
                        selectedPlayers.includes(p)
                          ? 'bg-[#FFCB2B] text-black border-[#FFCB2B] scale-105'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="space-y-2 mt-8">
                  {manualTeams.map((t, i) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-white/10 p-4 rounded-2xl flex justify-between items-center border-l-4 border-l-[#FFCB2B]"
                    >
                      <span className="text-xs font-black uppercase italic tracking-tighter">
                        {t.name}
                      </span>
                      <Check className="text-green-500" size={16} />
                    </div>
                  ))}
                </div>
                {availablePlayers.length === 0 && manualTeams.length > 0 && (
                  <button
                    onClick={() => finalizeTournament(manualTeams)}
                    className="w-full bg-[#FFCB2B] text-black py-6 rounded-[2.5rem] font-black uppercase shadow-2xl active:scale-95 transition-all"
                  >
                    Generate Fixtures
                  </button>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'matches' ? (
              <motion.div
                key="fixtures"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {data.matches.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`p-6 rounded-[2.5rem] bg-white/5 border border-white/10 ${
                      m.done ? 'opacity-30 grayscale' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight">
                        {m.tA.name}
                      </p>
                      <div className="flex items-center gap-2 bg-black/60 p-1 rounded-2xl border border-white/5">
                        <input
                          type="number"
                          disabled={!isAdmin}
                          value={m.sA}
                          onChange={(e) =>
                            updateScore(idx, 'A', e.target.value)
                          }
                          className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none"
                        />
                        <div className="h-4 w-px bg-white/10" />
                        <input
                          type="number"
                          disabled={!isAdmin}
                          value={m.sB}
                          onChange={(e) =>
                            updateScore(idx, 'B', e.target.value)
                          }
                          className="w-12 h-12 bg-transparent text-center text-xl font-black text-[#FFCB2B] outline-none"
                        />
                      </div>
                      <p className="w-1/3 text-center text-[10px] font-black uppercase tracking-tighter leading-tight">
                        {m.tB.name}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl"
              >
                <table className="w-full">
                  <thead className="bg-white/5 text-[9px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="p-6 text-left">Team</th>
                      <th className="p-6">W</th>
                      <th className="p-6 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((t, i) => (
                      <tr
                        key={t.id}
                        className="border-b border-white/5 last:border-0 font-black"
                      >
                        <td className="p-6 text-xs uppercase italic tracking-tighter">
                          {t.name}
                        </td>
                        <td className="p-6 text-center text-green-400">
                          {t.w}
                        </td>
                        <td className="p-6 text-right text-lg text-[#FFCB2B]">
                          {t.pts}
                        </td>
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
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] bg-black/40 backdrop-blur-3xl rounded-full p-2 flex border border-white/10 shadow-2xl z-40">
          <div
            className="absolute h-[calc(100%-16px)] w-[calc(50%-8px)] bg-[#FFCB2B] rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{
              transform: `translateX(${
                activeTab === 'matches' ? '0' : '100%'
              })`,
            }}
          />
          <button
            onClick={() => {
              triggerHaptic(hapticStyles.light);
              setActiveTab('matches');
            }}
            className={`relative z-10 flex-1 py-4 flex items-center justify-center gap-2 transition-colors duration-500 ${
              activeTab === 'matches'
                ? 'text-black font-black'
                : 'text-slate-500 uppercase text-[10px]'
            }`}
          >
            <LayoutGrid size={20} />
            {activeTab === 'matches' && 'Fixtures'}
          </button>
          <button
            onClick={() => {
              triggerHaptic(hapticStyles.light);
              setActiveTab('standings');
            }}
            className={`relative z-10 flex-1 py-4 flex items-center justify-center gap-2 transition-colors duration-500 ${
              activeTab === 'standings'
                ? 'text-black font-black'
                : 'text-slate-500 uppercase text-[10px]'
            }`}
          >
            <Users size={20} />
            {activeTab === 'standings' && 'Leaderboard'}
          </button>
        </nav>
      )}
    </div>
  );
}
