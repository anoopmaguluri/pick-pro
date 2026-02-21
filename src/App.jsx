import React, { useState, useEffect, useMemo, useRef } from "react";
import { ensureFirebaseSession } from "./services/firebase";
import {
  createTournament as createTournamentRecord,
  patchTournament,
  finalizeTournament,
  deleteTournament as deleteTournamentRecord,
  updateTournamentPlayers,
  addPlayerToRoster,
  setKnockoutMatch
} from "./services/db";
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
import { buildPlayersPreview, leaderboardRowsFromEncoded } from "./utils/leaderboard";
import { DEFAULT_WIN_TARGET, normalizeWinTarget } from "./utils/scoringRules";

import TournamentWorker from "./workers/tournamentBuilder.worker.js?worker";
import StandingsWorker from "./workers/standings.worker.js?worker";

const MotionDiv = motion.div;

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
  const [pointsToWin, setPointsToWin] = useState(DEFAULT_WIN_TARGET);

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
    if (!rawData) return { matches: [], knockouts: [], teams: [], pointsToWin: DEFAULT_WIN_TARGET };
    const normalize = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return Object.values(val).filter(Boolean);
    };
    return {
      ...rawData,
      pointsToWin: normalizeWinTarget(rawData.pointsToWin),
      matches: normalize(rawData.matches),
      knockouts: normalize(rawData.knockouts),
      teams: normalize(rawData.teams)
    };
  }, [rawData]);

  useEffect(() => {
    if (!activeTournamentId) {
      setPointsToWin(DEFAULT_WIN_TARGET);
      return;
    }
    setPointsToWin(normalizeWinTarget(data?.pointsToWin));
  }, [activeTournamentId, data?.pointsToWin]);

  // Passing activeTournamentId and derived data to hooks
  // Note: useScoring internally manages localScores ref
  const { adjustScore, confirmMatch, confirmKnockout, optimisticScores } = useScoring(activeTournamentId, data, isAdmin);

  const renderData = useMemo(() => {
    if (!data) return data;
    const keys = Object.keys(optimisticScores || {});
    if (!keys.length) return data;

    const next = {
      ...data,
      matches: Array.isArray(data.matches) ? [...data.matches] : [],
      knockouts: Array.isArray(data.knockouts) ? [...data.knockouts] : [],
    };

    keys.forEach((key) => {
      const match = key.match(/^([mk])-(\d+)-([AB])$/);
      if (!match) return;
      const scope = match[1] === "k" ? "knockouts" : "matches";
      const idx = Number(match[2]);
      const team = match[3];
      const score = optimisticScores[key];

      const list = scope === "knockouts" ? next.knockouts : next.matches;
      const existing = list[idx];
      if (!existing || !Number.isFinite(score)) return;

      const scoreField = team === "A" ? "sA" : "sB";
      list[idx] = {
        ...existing,
        [scoreField]: Math.max(0, Math.trunc(score)),
      };
    });

    return next;
  }, [data, optimisticScores]);

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
    // Tournament is considered complete only when a winner is persisted,
    // or the knockout grand final is completed.
    if (data?.winner) return true;
    const final = data?.knockouts?.find((k) => k.id === "final");
    return Boolean(final?.done);
  }, [data?.winner, data?.knockouts]);

  const tournamentWinner = useMemo(() => {
    if (data?.winner) return data.winner;
    const final = data?.knockouts?.find((k) => k.id === "final");
    if (!final?.done) return null;
    return final.sA > final.sB ? final.tA.name : final.tB.name;
  }, [data?.winner, data?.knockouts]);

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
        await setKnockoutMatch(activeTournamentId, finalIdx, {
          ...final,
          tA: sf1Winner,
          tB: sf2Winner,
          pending: false,
        });
      } catch (error) {
        console.error("Failed to auto-seed grand final", error);
      }
    })();
  }, [data?.knockouts, activeTournamentId]);

  // Write winner + status:done to Firebase when tournament ends
  useEffect(() => {
    if (!isTournamentOver || !activeTournamentId || data?.winner || !tournamentWinner) return;

    void (async () => {
      try {
        await ensureFirebaseSession();
        await finalizeTournament(activeTournamentId, tournamentWinner);
      } catch (error) {
        console.error("Failed to finalize tournament winner", error);
      }
    })();
  }, [isTournamentOver, tournamentWinner, activeTournamentId, data?.winner]);


  // --- HANDLERS ---
  const buildMetaPlayerSummary = (players) => {
    return buildPlayersPreview(players);
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;
    const now = Date.now();
    const id = `t_${now}`;

    try {
      await ensureFirebaseSession();

      // Write base shell to both RTDB and Firestore via abstraction
      const metaSummary = {
        name: newTourneyName,
        createdAt: now,
        status: "draft",
        pointsToWin: DEFAULT_WIN_TARGET,
        draftPlayers: [],
        playersPreview: [],
        playerCount: 0,
      };

      const fullData = {
        name: newTourneyName,
        createdAt: now,
        status: "draft",
        pointsToWin: DEFAULT_WIN_TARGET,
        draftPlayers: [],
        matches: [],
        knockouts: [],
        events: []
      };

      await createTournamentRecord(id, fullData, metaSummary);
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

  const deleteTournamentHandler = async (id) => {
    try {
      await ensureFirebaseSession();
      // Abstracted deletion handles meta and data in both systems
      await deleteTournamentRecord(id);
    } catch (error) {
      console.error("Tournament delete cleanup failed", error);
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
        await addPlayerToRoster(newRoster);
      }

      const newDraft = [...(data.draftPlayers || []), name];
      const summary = buildMetaPlayerSummary(newDraft);

      await updateTournamentPlayers(activeTournamentId, newDraft, summary);
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
      await updateTournamentPlayers(activeTournamentId, newDraft, summary);
    } catch (error) {
      console.error("Failed to toggle draft player", error);
      return;
    }

    triggerHaptic(20);
  };

  const handlePointsToWinChange = async (targetPoints) => {
    const nextPoints = normalizeWinTarget(targetPoints);
    setPointsToWin(nextPoints);

    if (!activeTournamentId || data?.status !== "draft") return;

    try {
      await ensureFirebaseSession();
      await patchTournament(activeTournamentId, { pointsToWin: nextPoints }, { pointsToWin: nextPoints });
    } catch (error) {
      console.error("Failed to update points target", error);
      showAlert("Error", "Could not update points target right now.");
    }
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
      const resolvedPointsToWin = normalizeWinTarget(pointsToWin);

      // Write full heavy tree to data via abstraction
      const metaSummary = buildMetaPlayerSummary(previewData.players || []);
      const completeData = {
        ...previewData,
        status: "active",
        pointsToWin: resolvedPointsToWin,
        knockouts: previewData.knockouts || []
      };
      await patchTournament(activeTournamentId, completeData, {
        status: "active",
        format: previewData.format,
        pointsToWin: resolvedPointsToWin,
        ...metaSummary,
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
    const resolvedPointsToWin = normalizeWinTarget(pointsToWin);

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

      const metaSummary = buildMetaPlayerSummary(draftedPlayers);

      const payload = {
        status: "active",
        format: "fixed",
        pointsToWin: resolvedPointsToWin,
        teams: teams,
        matches: newMatches,
        knockouts: knockouts
      };
      await patchTournament(activeTournamentId, payload, {
        status: "active",
        format: "fixed",
        pointsToWin: resolvedPointsToWin,
        ...metaSummary
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
      await Promise.all(knockouts.map((k, idx) => setKnockoutMatch(activeTournamentId, idx, k)));

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
          <MotionDiv
            key="tournament-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TournamentView
              data={renderData}
              roster={roster}
              isAdmin={isAdmin}
              setIsAdmin={setIsAdmin}
              setActiveTournamentId={setActiveTournamentId}
              // Format
              matchFormat={matchFormat}
              setMatchFormat={setMatchFormat}
              pointsToWin={pointsToWin}
              setPointsToWin={handlePointsToWinChange}
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
          </MotionDiv>
        ) : (
          <MotionDiv
            key="tournament-hub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TournamentHub
              tournaments={tournaments}
              setActiveTournamentId={setActiveTournamentId}
              createTournament={handleCreateTournament}
              deleteTournament={deleteTournamentHandler}
              newTourneyName={newTourneyName}
              setNewTourneyName={setNewTourneyName}
              globalLeaderboard={globalLeaderboard}
              isAdmin={isAdmin}
              setIsAdmin={setIsAdmin}
              hubTab={hubTab}
              setHubTab={setHubTab}
            />
          </MotionDiv>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}

export default App;
