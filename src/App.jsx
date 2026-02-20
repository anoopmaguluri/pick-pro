import React, { useState, useEffect, useMemo, useRef } from "react";
import { set, update, remove, ref } from "firebase/database";
import { db } from "./services/firebase";
import { motion, AnimatePresence } from "framer-motion";

// Components
import Modal from "./components/common/Modal";
import TournamentHub from "./components/modules/tournament/TournamentHub";
import TournamentView from "./components/modules/tournament/TournamentView";
import ErrorBoundary from "./components/common/ErrorBoundary";

// Hooks & Utils
import { useTournaments } from "./hooks/useTournaments";
import { useScoring } from "./hooks/useScoring";
import { useHaptic } from "./hooks/useHaptic";
import { processMatches, determineStatus, buildPairedTeams, buildRoundRobin, buildSinglesRoundRobin, buildMixerDoubles, buildKnockouts, qualifyCount, intelligentSort } from "./utils/gameLogic";
import { prepareAutoTournamentResult } from "./utils/tournamentBuilder";

function App() {
  const { tournaments, roster, loading } = useTournaments();
  const { trigger: triggerHaptic } = useHaptic();

  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTournamentId, setActiveTournamentId] = useState(null);

  // Auto-clear active tournament if it doesn't exist anymore
  useEffect(() => {
    if (activeTournamentId && tournaments && !tournaments[activeTournamentId]) {
      setActiveTournamentId(null);
    }
  }, [activeTournamentId, tournaments]);

  // Setup State
  const [newTourneyName, setNewTourneyName] = useState("");
  const [newPlayer, setNewPlayer] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTeams, setManualTeams] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [matchFormat, setMatchFormat] = useState("doubles"); // "singles" | "doubles"

  // UI State
  const [hubTab, setHubTab] = useState("events");
  const [dismissCelebration, setDismissCelebration] = useState(false);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
    isDestructive: false,
    confirmText: "Confirm", // Added default
  });

  const data = activeTournamentId ? tournaments[activeTournamentId] : null;

  // Passing activeTournamentId and derived data to hooks
  // Note: useScoring internally manages localScores ref
  const { adjustScore, confirmMatch, confirmKnockout } = useScoring(activeTournamentId, data, isAdmin);

  const showAlert = (title, message, onConfirm = null, isDestructive = false, confirmText = "Confirm") => {
    setModal({
      show: true,
      title,
      message,
      onConfirm: onConfirm
        ? () => {
          onConfirm();
          setModal((m) => ({ ...m, show: false }));
        }
        : null,
      isDestructive,
      confirmText,
    });
  };

  // --- STATS CALCULATION ---
  // --- STATS CALCULATION ---
  const standings = useMemo(() => {
    if (!data) return [];

    // Check if tournament is fully complete (all scheduled matches done)
    const allMatchesDone = data.matches && data.matches.length > 0 && data.matches.every(m => m.done);

    // ── FIXED TEAMS (even players + doubles) ──────────────────────────────────
    if ((data.format === "pairs" || data.format === "fixed") && data.teams) {
      const teamStats = {};
      data.teams.forEach((t) => {
        teamStats[t.name] = { name: t.name, p1: t.p1, p2: t.p2, p: 0, w: 0, l: 0, pd: 0, pf: 0, pa: 0, form: [] };
      });

      if (data.matches) {
        data.matches.forEach((m) => {
          if (m.done) {
            const aWon = m.sA > m.sB;
            const updateT = (name, won, pd) => {
              if (teamStats[name]) {
                teamStats[name].p++;
                if (won) teamStats[name].w++; else teamStats[name].l++;
                teamStats[name].pd += pd;
                teamStats[name].form.push(won ? "W" : "L");
              }
            };
            updateT(m.tA.name, aWon, m.sA - m.sB);
            updateT(m.tB.name, !aWon, m.sB - m.sA);
          }
        });
      }

      const sortedTeams = intelligentSort(Object.values(teamStats), data.matches);
      const qCount = qualifyCount(sortedTeams.length);
      // For fixed teams (N teams), each team plays N-1 matches
      determineStatus(sortedTeams, qCount, sortedTeams.length - 1, allMatchesDone);
      return sortedTeams;
    }

    // ── INDIVIDUAL / SINGLES / MIXER ─────────────────────────────────────────
    const stats = {};
    const players = data.players || data.draftPlayers || [];
    players.forEach((p) => {
      stats[p] = { name: p, p1: p, p2: null, p: 0, w: 0, l: 0, pd: 0, pf: 0, pa: 0, form: [] };
    });

    if (data.matches) processMatches(data.matches, stats);

    const sorted = intelligentSort(Object.values(stats), data.matches);

    const qCount = qualifyCount(sorted.length);

    // For mixer-doubles and singles, determine how many matches each player plays
    // (may vary, use scheduled match count per player from the fixture list)
    let matchesPerPlayer = sorted.length - 1; // default: round-robin
    if (data.format === "mixer" && data.matches) {
      const matchCounts = {};
      data.matches.forEach((m) => {
        [m.tA.p1, m.tA.p2, m.tB.p1, m.tB.p2].forEach((p) => {
          if (p) matchCounts[p] = (matchCounts[p] || 0) + 1;
        });
      });
      const counts = Object.values(matchCounts);
      matchesPerPlayer = counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : sorted.length - 1;
    }

    determineStatus(sorted, qCount, matchesPerPlayer, allMatchesDone);
    return sorted;
  }, [data]);

  const globalLeaderboard = useMemo(() => {
    const globStats = {};
    Object.values(tournaments || {}).forEach((t) => {
      if (!t) return;
      if (t.matches) {
        processMatches(t.matches, globStats);
      }
      if (t.knockouts) {
        processMatches(t.knockouts, globStats);
      }
    });

    return Object.values(globStats)
      .map((s) => ({
        ...s,
        winRate: s.p > 0 ? (s.w / s.p) : 0,
        winRateStr: s.p > 0 ? Math.round((s.w / s.p) * 100) : 0,
        rating: (3.5 + (s.w * 0.1 + s.pd * 0.01)).toFixed(2)
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 50);

  }, [tournaments]);

  const isTournamentOver = useMemo(() => {
    if (!data?.knockouts) return false;
    const final = data.knockouts.find((k) => k.id === "final");
    return Boolean(final?.done);
  }, [data]);

  const tournamentWinner = useMemo(() => {
    if (!isTournamentOver) return null;
    const final = data.knockouts.find((k) => k.id === "final");
    if (!final) return null;
    return final.sA > final.sB ? final.tA.name : final.tB.name;
  }, [isTournamentOver, data]);

  // Auto-seed Grand Final when both semi-finals are done
  useEffect(() => {
    if (!data?.knockouts || !activeTournamentId) return;
    const sf1 = data.knockouts.find((k) => k.id === "sf1");
    const sf2 = data.knockouts.find((k) => k.id === "sf2");
    const final = data.knockouts.find((k) => k.id === "final");
    if (!sf1?.done || !sf2?.done || !final?.pending) return;

    const sf1Winner = sf1.sA > sf1.sB ? sf1.tA : sf1.tB;
    const sf2Winner = sf2.sA > sf2.sB ? sf2.tA : sf2.tB;
    const updated = data.knockouts.map((k) =>
      k.id === "final" ? { ...k, tA: sf1Winner, tB: sf2Winner, pending: false } : k
    );
    set(ref(db, `tournaments/${activeTournamentId}/knockouts`), updated);
  }, [data?.knockouts, activeTournamentId]);

  // Write winner + status:done to Firebase when tournament ends
  useEffect(() => {
    if (!isTournamentOver || !activeTournamentId || data?.winner) return;
    update(ref(db, `tournaments/${activeTournamentId}`), {
      winner: tournamentWinner,
      status: "done",
    });
  }, [isTournamentOver, tournamentWinner, activeTournamentId, data?.winner]);


  // --- HANDLERS ---

  const createTournament = (e) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;
    const id = `t_${Date.now()}`;
    set(ref(db, `tournaments/${id}`), {
      id,
      name: newTourneyName,
      createdAt: Date.now(),
      status: "draft",
      draftPlayers: [],
    });
    setNewTourneyName("");
    setActiveTournamentId(id); // Switch to the new event
    setHubTab("events"); // Ensure hub is on history when coming back
    triggerHaptic(50);
  };

  const deleteTournament = (id) => {
    remove(ref(db, `tournaments/${id}`));
    triggerHaptic(100);
  };

  const addPlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.trim()) return;
    const name = newPlayer.trim();
    if (data.draftPlayers?.includes(name)) {
      showAlert("Warning", "Player already in draft.");
      return;
    }

    if (!roster.includes(name)) {
      const newRoster = [...roster, name].sort();
      set(ref(db, "roster"), newRoster);
    }

    const newDraft = [...(data.draftPlayers || []), name];
    update(ref(db, `tournaments/${activeTournamentId}`), {
      draftPlayers: newDraft
    });
    setNewPlayer("");
    triggerHaptic(50);
  };

  const toggleDraftPlayer = (name, isAdding) => {
    let newDraft = [...(data.draftPlayers || [])];
    if (isAdding) {
      if (!newDraft.includes(name)) newDraft.push(name);
    } else {
      newDraft = newDraft.filter(p => p !== name);
    }
    update(ref(db, `tournaments/${activeTournamentId}`), { draftPlayers: newDraft });
    triggerHaptic(20);
  };

  /* 
   * Prepares the tournament data but does NOT commit to Firebase yet.
   * Returns: { format, teams, matches, players }
   */
  const prepareAutoTournament = (fmt) => {
    return prepareAutoTournamentResult(fmt, data.draftPlayers);
  };

  /* 
   * Commits the prepared data to Firebase.
   */
  const commitAutoTournament = (previewData) => {
    set(ref(db, `tournaments/${activeTournamentId}`), {
      ...data,
      status: "active",
      ...previewData,
      knockouts: [],
    });
    triggerHaptic([100, 100, 200]);
  };



  const handleManualSelect = (p) => {
    if (selectedPlayers.includes(p)) setSelectedPlayers(s => s.filter(x => x !== p));
    else setSelectedPlayers(s => [...s, p]);
    triggerHaptic(20);
  };

  const removeManualTeam = (index) => {
    setManualTeams(t => t.filter((_, i) => i !== index));
    triggerHaptic(50);
  };


  // Watch for manual team completion
  useEffect(() => {
    if (selectedPlayers.length === 2) {
      const tName = `${selectedPlayers[0]} & ${selectedPlayers[1]}`;
      setManualTeams(prev => [
        ...prev,
        {
          name: tName,
          p1: selectedPlayers[0],
          p2: selectedPlayers[1],
        },
      ]);
      setSelectedPlayers([]);
      triggerHaptic(50);
    }
  }, [selectedPlayers, triggerHaptic]); // Added dependency to fix lint warnings

  const handleFormatSelection = (teams) => {
    const newMatches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        newMatches.push({
          id: `m_${i}_${j}`,
          tA: teams[i],
          tB: teams[j],
          sA: 0, sB: 0
        });
      }
    }
    set(ref(db, `tournaments/${activeTournamentId}`), {
      ...data,
      status: "active",
      format: "fixed",
      teams: teams,
      matches: newMatches,
      knockouts: []
    });
    triggerHaptic(100);
  };

  const generateKnockouts = () => {
    if (!standings || standings.length < 2) return;

    const numTeams = standings.length;
    const qCount = qualifyCount(numTeams);

    if (standings.length < qCount) {
      showAlert("Error", `Need at least ${qCount} teams to generate knockouts.`);
      return;
    }
    const isMixer = data?.format === "mixer";
    const knockouts = buildKnockouts(standings.slice(0, qCount), qCount, isMixer);
    set(ref(db, `tournaments/${activeTournamentId}/knockouts`), knockouts);
    triggerHaptic([50, 50, 100]);
  };


  const handleStandingsLongPress = () => {
    if (!isAdmin) return;
    showAlert("Info", "Editing standings is locked.");
  };

  if (loading) return (
    <div className="h-[100dvh] bg-[#030712] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20" style={{ background: "rgba(99,102,241,0.2)" }} />
      <div className="absolute bottom-32 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20" style={{ background: "rgba(236,72,153,0.1)" }} />

      <div className="relative z-10">
        <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-6 mx-auto" />
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Syncing Data</h2>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <Modal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        isDestructive={modal.isDestructive}
        onCancel={() => setModal({ ...modal, show: false })}
      />

      <AnimatePresence mode="wait" initial={false}>
        {activeTournamentId ? (
          <motion.div
            key="tournament-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TournamentView
              data={data}
              roster={roster}
              isAdmin={isAdmin}
              setIsAdmin={setIsAdmin}
              setActiveTournamentId={setActiveTournamentId}
              // Format
              matchFormat={matchFormat}
              setMatchFormat={setMatchFormat}
              // Setup
              newPlayer={newPlayer}
              setNewPlayer={setNewPlayer}
              addPlayer={addPlayer}
              toggleDraftPlayer={toggleDraftPlayer}
              prepareAutoTournament={prepareAutoTournament}
              commitAutoTournament={commitAutoTournament}
              isManualMode={isManualMode}
              setIsManualMode={setIsManualMode}
              manualTeams={manualTeams}
              handleManualSelect={handleManualSelect}
              removeManualTeam={removeManualTeam}
              handleFormatSelection={handleFormatSelection}
              selectedPlayers={selectedPlayers}
              // Match
              adjustScore={adjustScore}
              confirmMatch={confirmMatch}
              confirmKnockout={confirmKnockout}
              generateKnockouts={generateKnockouts}
              // Standings
              standings={standings}
              handleStandingsLongPress={handleStandingsLongPress}
              // Celebration
              dismissCelebration={dismissCelebration}
              setDismissCelebration={setDismissCelebration}
              isTournamentOver={isTournamentOver}
              tournamentWinner={tournamentWinner}
            />
          </motion.div>
        ) : (
          <motion.div
            key="tournament-hub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TournamentHub
              tournaments={tournaments}
              activeTournamentId={activeTournamentId}
              setActiveTournamentId={setActiveTournamentId}
              createTournament={createTournament}
              deleteTournament={deleteTournament}
              newTourneyName={newTourneyName}
              setNewTourneyName={setNewTourneyName}
              globalLeaderboard={globalLeaderboard}
              isAdmin={isAdmin}
              setIsAdmin={setIsAdmin}
              hubTab={hubTab}
              setHubTab={setHubTab}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}

export default App;
