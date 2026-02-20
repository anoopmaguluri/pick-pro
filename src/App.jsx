import React, { useState, useEffect, useMemo, useRef } from "react";
import { set, update, ref, get, increment } from "firebase/database";
import { db, ensureFirebaseSession } from "./services/firebase";
import { motion, AnimatePresence } from "framer-motion";

// Components
import Modal from "./components/common/Modal";
import TournamentHub from "./components/modules/tournament/TournamentHub";
import TournamentView from "./components/modules/tournament/TournamentView";
import ErrorBoundary from "./components/common/ErrorBoundary";

// Hooks & Utils
import { useTournaments } from "./hooks/useTournaments";
import { useActiveTournament } from "./hooks/useActiveTournament";
import { useScoring } from "./hooks/useScoring";
import { useHaptic } from "./hooks/useHaptic";
import { buildRoundRobin, buildKnockouts, qualifyCount } from "./utils/gameLogic";
import { calculateStandings } from "./utils/standingsCalculator";
import { buildPlayersPreview, leaderboardRowsFromEncoded, computeTournamentPlayerStats, playerKeyForName } from "./utils/leaderboard";

import TournamentWorker from "./workers/tournamentBuilder.worker.js?worker";
import StandingsWorker from "./workers/standings.worker.js?worker";

function App() {
  const { tournaments, leaderboardData, roster } = useTournaments();
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

  useEffect(() => {
    ensureFirebaseSession().catch((error) => {
      console.error("Anonymous auth bootstrap failed", error);
    });
  }, []);
  const [standings, setStandings] = useState([]);
  const standingsWorkerRef = useRef(null);
  const standingsRequestIdRef = useRef(0);
  const latestTournamentDataRef = useRef(null);

  const isTournamentActive = activeTournamentId && tournaments[activeTournamentId];
  const { tournamentData: rawData } = useActiveTournament(activeTournamentId, !!isTournamentActive);

  // Normalize data structures to ensure matches/knockouts are always arrays
  // Firebase often converts arrays to objects if keys are missing or stringy.
  const data = useMemo(() => {
    if (!rawData) return { matches: [], knockouts: [], teams: [] };
    const normalize = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return Object.values(val).filter(Boolean);
    };
    return {
      ...rawData,
      matches: normalize(rawData.matches),
      knockouts: normalize(rawData.knockouts),
      teams: normalize(rawData.teams)
    };
  }, [rawData]);

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

  useEffect(() => {
    const worker = new StandingsWorker();
    standingsWorkerRef.current = worker;

    worker.onmessage = (event) => {
      const payload = event.data || {};
      if (payload.requestId !== standingsRequestIdRef.current) return;

      if (payload.status === "success") {
        setStandings(Array.isArray(payload.standings) ? payload.standings : []);
      } else {
        console.error("Standings worker error:", payload.error);
        setStandings(calculateStandings(latestTournamentDataRef.current));
      }
    };

    worker.onerror = (error) => {
      console.error("Standings worker crashed:", error);
      setStandings(calculateStandings(latestTournamentDataRef.current));
    };

    return () => {
      worker.terminate();
      standingsWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    latestTournamentDataRef.current = data;
    const requestId = ++standingsRequestIdRef.current;

    if (!data) {
      setStandings([]);
      return;
    }

    if (!standingsWorkerRef.current) {
      setStandings(calculateStandings(data));
      return;
    }

    standingsWorkerRef.current.postMessage({ requestId, data });
  }, [data]);

  const globalLeaderboard = useMemo(() => {
    return leaderboardRowsFromEncoded(leaderboardData);
  }, [leaderboardData]);

  const isTournamentOver = useMemo(() => {
    if (!data?.knockouts || data.knockouts.length === 0) {
      // If no knockouts, check if pool matches exist and are all done
      const matches = data?.matches || [];
      return matches.length > 0 && matches.every(m => m.done);
    }
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
    const finalIdx = data.knockouts.findIndex((k) => k.id === "final");
    if (finalIdx < 0) return;
    const final = data.knockouts[finalIdx];
    if (!sf1?.done || !sf2?.done || !final?.pending) return;

    const sf1Winner = sf1.sA > sf1.sB ? sf1.tA : sf1.tB;
    const sf2Winner = sf2.sA > sf2.sB ? sf2.tA : sf2.tB;
    void (async () => {
      try {
        await ensureFirebaseSession();
        await update(ref(db), {
          [`tournament_data/${activeTournamentId}/knockouts/${finalIdx}/tA`]: sf1Winner,
          [`tournament_data/${activeTournamentId}/knockouts/${finalIdx}/tB`]: sf2Winner,
          [`tournament_data/${activeTournamentId}/knockouts/${finalIdx}/pending`]: false,
        });
      } catch (error) {
        console.error("Failed to auto-seed grand final", error);
      }
    })();
  }, [data?.knockouts, activeTournamentId]);

  // Write winner + status:done to Firebase when tournament ends
  useEffect(() => {
    if (!isTournamentOver || !activeTournamentId || data?.winner) return;

    // Update both meta and data
    void (async () => {
      try {
        await ensureFirebaseSession();
        await Promise.all([
          update(ref(db, `tournaments_meta/${activeTournamentId}`), {
            winner: tournamentWinner,
            status: "done",
          }),
          update(ref(db, `tournament_data/${activeTournamentId}`), {
            winner: tournamentWinner,
            status: "done",
          }),
        ]);
      } catch (error) {
        console.error("Failed to finalize tournament winner", error);
      }
    })();
  }, [isTournamentOver, tournamentWinner, activeTournamentId, data?.winner]);


  // --- HANDLERS ---
  const buildMetaPlayerSummary = (players) => {
    return buildPlayersPreview(players);
  };

  const createTournament = async (e) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;
    const id = `t_${Date.now()}`;

    try {
      await ensureFirebaseSession();

      // Write lightweight shell to meta
      await set(ref(db, `tournaments_meta/${id}`), {
        id,
        name: newTourneyName,
        createdAt: Date.now(),
        status: "draft",
        draftPlayers: [],
        playersPreview: [],
        playerCount: 0,
      });

      // Write base shell to data
      await set(ref(db, `tournament_data/${id}`), {
        id,
        name: newTourneyName,
        createdAt: Date.now(),
        status: "draft",
        draftPlayers: [],
        matches: [],
        knockouts: [],
        events: [] // Event stream for scoring
      });
    } catch (error) {
      console.error("Failed to create tournament", error);
      showAlert("Error", "Could not create tournament right now.");
      return;
    }

    setNewTourneyName("");
    setActiveTournamentId(id); // Switch to the new event
    setHubTab("events"); // Ensure hub is on history when coming back
    triggerHaptic(50);
  };

  const deleteTournament = async (id) => {
    const updates = {
      [`tournaments_meta/${id}`]: null,
      [`tournament_data/${id}`]: null,
      [`leaderboard_applied/${id}`]: null,
    };

    try {
      await ensureFirebaseSession();
      const snapshot = await get(ref(db, `tournament_data/${id}`));
      const tournamentData = snapshot.val();
      if (tournamentData) {
        const stats = computeTournamentPlayerStats(tournamentData);
        Object.values(stats).forEach((s) => {
          const key = playerKeyForName(s.name);
          if (!key) return;

          const base = `leaderboard_global/${key}`;
          updates[`${base}/name`] = s.name;
          updates[`${base}/p`] = increment(-s.p);
          updates[`${base}/w`] = increment(-s.w);
          updates[`${base}/l`] = increment(-s.l);
          updates[`${base}/pd`] = increment(-s.pd);
          updates[`${base}/pf`] = increment(-s.pf);
          updates[`${base}/pa`] = increment(-s.pa);
        });
      }

      await update(ref(db), updates);
    } catch (error) {
      console.error("Tournament delete cleanup failed", error);
      await update(ref(db), {
        [`tournaments_meta/${id}`]: null,
        [`tournament_data/${id}`]: null,
      });
    }

    triggerHaptic(100);
  };

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.trim()) return;
    const name = newPlayer.trim();
    if (data.draftPlayers?.includes(name)) {
      showAlert("Warning", "Player already in draft.");
      return;
    }

    try {
      await ensureFirebaseSession();

      if (!roster.includes(name)) {
        const newRoster = [...roster, name].sort();
        await set(ref(db, "roster"), newRoster);
      }

      const newDraft = [...(data.draftPlayers || []), name];
      const summary = buildMetaPlayerSummary(newDraft);
      await Promise.all([
        update(ref(db, `tournaments_meta/${activeTournamentId}`), {
          draftPlayers: newDraft,
          ...summary,
        }),
        update(ref(db, `tournament_data/${activeTournamentId}`), { draftPlayers: newDraft }),
      ]);
    } catch (error) {
      console.error("Failed to add player", error);
      showAlert("Error", "Could not add player right now.");
      return;
    }

    setNewPlayer("");
    triggerHaptic(50);
  };

  const toggleDraftPlayer = async (name, isAdding) => {
    let newDraft = [...(data.draftPlayers || [])];
    if (isAdding) {
      if (!newDraft.includes(name)) newDraft.push(name);
    } else {
      newDraft = newDraft.filter(p => p !== name);
    }
    const summary = buildMetaPlayerSummary(newDraft);
    try {
      await ensureFirebaseSession();
      await Promise.all([
        update(ref(db, `tournaments_meta/${activeTournamentId}`), {
          draftPlayers: newDraft,
          ...summary,
        }),
        update(ref(db, `tournament_data/${activeTournamentId}`), { draftPlayers: newDraft }),
      ]);
    } catch (error) {
      console.error("Failed to toggle draft player", error);
      return;
    }

    triggerHaptic(20);
  };

  /* 
   * Prepares the tournament data asynchronously using a Web Worker.
   * Returns a Promise resolving to: { format, teams, matches, players }
   */
  const prepareAutoTournament = (fmt) => {
    return new Promise((resolve, reject) => {
      const worker = new TournamentWorker();
      worker.onmessage = (e) => {
        if (e.data.status === 'success') {
          resolve(e.data.data);
        } else {
          reject(new Error(e.data.error));
        }
        worker.terminate();
      };
      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };
      worker.postMessage({ action: "PREPARE_TOURNAMENT", fmt, draftPlayers: data.draftPlayers });
    });
  };

  /* 
   * Commits the prepared data to Firebase.
   */
  const commitAutoTournament = async (previewData) => {
    try {
      await ensureFirebaseSession();

      // Write full heavy tree to data
      await update(ref(db, `tournament_data/${activeTournamentId}`), {
        status: "active",
        ...previewData,
        knockouts: previewData.knockouts || [],
      });

      // Write only metadata to meta
      const summary = buildMetaPlayerSummary(previewData.players || []);
      await update(ref(db, `tournaments_meta/${activeTournamentId}`), {
        status: "active",
        format: previewData.format,
        ...summary,
      });

      triggerHaptic([100, 100, 200]);
    } catch (error) {
      console.error("Failed to start auto tournament", error);
      showAlert("Error", "Could not start tournament right now.");
    }
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

  const handleFormatSelection = async (teams) => {
    if (!Array.isArray(teams) || teams.length === 0) {
      showAlert("Error", "Add at least one team before starting.");
      return;
    }

    const hasInvalidTeam = teams.some((t) => !t?.p1 || !t?.p2);
    if (hasInvalidTeam) {
      showAlert("Error", "Manual doubles requires complete 2-player teams.");
      return;
    }

    const assignedPlayers = new Set();
    teams.forEach((t) => {
      assignedPlayers.add(t.p1);
      assignedPlayers.add(t.p2);
    });
    const draftedPlayers = data?.draftPlayers || [];
    const allDraftedAssigned = draftedPlayers.every((p) => assignedPlayers.has(p));
    if (!allDraftedAssigned || assignedPlayers.size !== draftedPlayers.length) {
      showAlert("Error", "Pair all drafted players before starting manual doubles.");
      return;
    }

    let newMatches = [];
    let knockouts = [];

    if (teams.length === 2) {
      // 2 Teams only? Skip round robin, go straight to Grand Final
      knockouts = [{
        id: "final",
        type: "🏆 GRAND FINAL",
        tA: teams[0],
        tB: teams[1],
        sA: 0, sB: 0,
        done: false
      }];
    } else {
      const maxGamesPerTeam = draftedPlayers.length >= 9 ? 3 : null;
      newMatches = buildRoundRobin(teams, maxGamesPerTeam);
    }
    try {
      await ensureFirebaseSession();

      // Write massive tree to data
      await update(ref(db, `tournament_data/${activeTournamentId}`), {
        status: "active",
        format: "fixed",
        teams: teams,
        matches: newMatches,
        knockouts: knockouts
      });

      // Write just meta flag to meta
      const summary = buildMetaPlayerSummary(draftedPlayers);
      await update(ref(db, `tournaments_meta/${activeTournamentId}`), {
        status: "active",
        format: "fixed",
        ...summary,
      });

      triggerHaptic(100);
    } catch (error) {
      console.error("Failed to start manual tournament", error);
      showAlert("Error", "Could not start manual tournament right now.");
    }
  };

  const generateKnockouts = async () => {
    if (!standings || standings.length < 2) return;

    const numTeams = standings.length;
    const qCount = qualifyCount(numTeams);

    if (standings.length < qCount) {
      showAlert("Error", `Need at least ${qCount} teams to generate knockouts.`);
      return;
    }
    const isMixer = data?.format === "mixer";
    const knockouts = buildKnockouts(standings.slice(0, qCount), qCount, isMixer);
    try {
      await ensureFirebaseSession();
      await set(ref(db, `tournament_data/${activeTournamentId}/knockouts`), knockouts);
      triggerHaptic([50, 50, 100]);
    } catch (error) {
      console.error("Failed to generate knockouts", error);
      showAlert("Error", "Could not generate knockouts right now.");
    }
  };


  const handleStandingsLongPress = () => {
    if (!isAdmin) return;
    showAlert("Info", "Editing standings is locked.");
  };

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
