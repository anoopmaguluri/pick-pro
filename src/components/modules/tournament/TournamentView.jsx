import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    Lock,
    Unlock,
    TrendingUp,
    Swords,
    Crown,
    Sparkles,
} from "lucide-react";
import { useHaptic } from "../../../hooks/useHaptic";
import { qualifyCount } from "../../../utils/gameLogic";
import Setup from "./Setup";
import MatchList from "../matches/MatchList";
import StandingsTable from "../standings/StandingsTable";
import LiquidButton from "../../common/LiquidButton";
import LiquidTabBar from "../../common/LiquidTabBar";

// ─── Confetti Particle ────────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#FFCA28", "#F57C00", "#4ADE80", "#818CF8", "#F472B6", "#38BDF8"];
function ConfettiRain() {
    const count = 55;
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: count }).map((_, i) => {
                const left = `${Math.random() * 100}%`;
                const delay = Math.random() * 2.5;
                const dur = 2.5 + Math.random() * 2;
                const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
                const size = 5 + Math.floor(Math.random() * 7);
                const rot = Math.random() * 360;
                return (
                    <motion.div
                        key={i}
                        initial={{ y: -20, x: 0, opacity: 1, rotate: rot }}
                        animate={{ y: "110vh", x: (Math.random() - 0.5) * 120, opacity: [1, 1, 0], rotate: rot + 360 * 3 }}
                        transition={{ duration: dur, delay, ease: "linear", repeat: Infinity, repeatDelay: Math.random() * 1.5 }}
                        style={{
                            position: "absolute",
                            left,
                            top: 0,
                            width: size,
                            height: size,
                            borderRadius: Math.random() > 0.5 ? "50%" : 2,
                            background: color,
                            boxShadow: `0 0 6px ${color}88`,
                        }}
                    />
                );
            })}
        </div>
    );
}

export default function TournamentView({
    data,
    roster,
    isAdmin,
    setIsAdmin,
    setActiveTournamentId,
    // Format
    matchFormat,
    setMatchFormat,
    // Setup props
    newPlayer,
    setNewPlayer,
    addPlayer,
    toggleDraftPlayer,
    promptAutoTournament,
    isManualMode,
    setIsManualMode,
    manualTeams,
    handleManualSelect,
    handleFormatSelection,
    selectedPlayers,
    // Match/Scoring props
    adjustScore,
    confirmMatch,
    confirmKnockout,
    generateKnockouts,
    // Standings props
    standings,
    handleStandingsLongPress,
    // Celebration
    dismissCelebration,
    setDismissCelebration,
    isTournamentOver,
    tournamentWinner,
    prepareAutoTournament,
    commitAutoTournament,
    removeManualTeam,
}) {
    const { trigger: triggerHaptic } = useHaptic();
    const [activeTab, setActiveTab] = useState("matches");

    const isSetupMode = !data || data.status === "draft";

    // Derive the qualifier count for standings display
    const qCount = useMemo(() => qualifyCount(standings.length), [standings.length]);

    // All pool matches done check
    const allMatchesDone = useMemo(() =>
        (data?.matches || []).length > 0 && (data?.matches || []).every((m) => m.done),
        [data?.matches]);

    return (
        <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative overflow-hidden text-white"
            style={{ background: "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 80% 80%, rgba(236,72,153,0.08) 0%, transparent 50%), #030712" }}>

            {/* Ambient orbs */}
            <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-60" style={{ background: "rgba(99,102,241,0.05)" }} />
            <div className="absolute bottom-32 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-60" style={{ background: "rgba(236,72,153,0.05)" }} />

            {/* ── CHAMPION CELEBRATION ─────────────────────────────────────── */}
            <AnimatePresence>
                {isTournamentOver && !dismissCelebration && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.35 }}
                        className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-8 overflow-hidden"
                        style={{ background: "rgba(3,7,18,0.97)", backdropFilter: "blur(30px)" }}
                    >
                        {/* Confetti rain */}
                        <ConfettiRain />

                        {/* Pulsing glow rings */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {[0, 1, 2].map((n) => (
                                <motion.div key={n}
                                    className="absolute rounded-full"
                                    initial={{ scale: 0.5, opacity: 0.5 }}
                                    animate={{ scale: 2.5 + n * 0.8, opacity: 0 }}
                                    transition={{ duration: 2, delay: n * 0.5, repeat: Infinity, ease: "easeOut" }}
                                    style={{ width: 160, height: 160, background: "rgba(255,202,40,0.08)" }}
                                />
                            ))}
                        </div>

                        {/* Trophy + glow */}
                        <motion.div
                            animate={{ scale: [0.8, 1.12, 1], rotate: [0, -8, 8, 0] }}
                            transition={{ duration: 1.1, ease: "easeOut" }}
                            className="relative mb-8 z-10"
                        >
                            <div className="absolute inset-0 blur-3xl rounded-full scale-150" style={{ background: "rgba(255,202,40,0.35)" }} />
                            <Crown size={96} style={{ color: "#FFCA28", filter: "drop-shadow(0 0 50px rgba(255,202,40,1))" }} className="relative z-10" />
                        </motion.div>

                        {/* "Event Champions" label */}
                        <motion.p
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="text-[9px] font-black uppercase tracking-[0.5em] mb-3 z-10"
                            style={{ color: "rgba(255,202,40,0.6)" }}
                        >
                            🏆 Event Champions
                        </motion.p>

                        {/* Winner name */}
                        <motion.h1
                            initial={{ y: 24, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ delay: 0.45, type: "spring", stiffness: 340, damping: 22 }}
                            className="text-4xl font-black italic uppercase tracking-tight text-center mb-10 z-10"
                            style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: "0 0 60px rgba(255,202,40,0.7), 0 0 20px rgba(255,202,40,0.4)", color: "#fff" }}
                        >
                            {tournamentWinner}
                        </motion.h1>

                        {/* Dismiss */}
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
                            onClick={() => { triggerHaptic([30, 30, 80]); setDismissCelebration(true); }}
                            className="px-10 py-4 rounded-full font-black uppercase text-[10px] tracking-widest z-10 relative"
                            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(20px)" }}
                        >
                            <Sparkles size={12} className="inline mr-2" />
                            View Final Board
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER */}
            <header className="flex-none px-5 py-4 flex justify-between items-center relative z-50"
                style={{ background: "linear-gradient(to bottom, rgba(3,7,18,0.9), transparent)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <motion.button whileTap={{ scale: 0.88 }}
                    onClick={() => { triggerHaptic(50); setActiveTournamentId(null); }}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <ChevronLeft size={20} />
                </motion.button>

                <div className="flex flex-col items-center">
                    <h1 className="text-sm font-black italic tracking-tight uppercase text-white">{data?.name || "Tournament"}</h1>
                    <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5"
                        style={{ color: isSetupMode ? "rgba(255,255,255,0.3)" : "rgba(255,202,40,0.7)" }}>
                        {isSetupMode ? "Setup Mode" : "⚡ Live Event"}
                    </span>
                </div>

                <motion.button whileTap={{ scale: 0.88 }}
                    onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={isAdmin
                        ? { background: "linear-gradient(135deg, #F57C00, #FFCA28)", boxShadow: "0 0 20px rgba(245,124,0,0.5)", color: "#030712" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                    }>
                    {isAdmin ? <Unlock size={16} /> : <Lock size={16} />}
                </motion.button>
            </header>

            {/* MAIN SCROLL */}
            <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative z-10"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y", scrollbarWidth: "none" }}>
                <div className="p-5 pb-32">
                    {isSetupMode ? (
                        <Setup
                            data={data}
                            roster={roster}
                            newPlayer={newPlayer}
                            setNewPlayer={setNewPlayer}
                            addPlayer={addPlayer}
                            toggleDraftPlayer={toggleDraftPlayer}
                            promptAutoTournament={promptAutoTournament}
                            isManualMode={isManualMode}
                            setIsManualMode={setIsManualMode}
                            manualTeams={manualTeams}
                            handleManualSelect={handleManualSelect}
                            handleFormatSelection={handleFormatSelection}
                            matchFormat={matchFormat}
                            setMatchFormat={setMatchFormat}
                            selectedPlayers={selectedPlayers}
                            prepareAutoTournament={prepareAutoTournament}
                            commitAutoTournament={commitAutoTournament}
                            removeManualTeam={removeManualTeam}
                        />
                    ) : (
                        <div className="pb-6">
                            <AnimatePresence mode="wait">
                                {activeTab === "matches" ? (
                                    <MatchList
                                        matches={data.matches} knockouts={data.knockouts}
                                        isAdmin={isAdmin} adjustScore={adjustScore}
                                        confirmMatch={confirmMatch} confirmKnockout={confirmKnockout}
                                    />
                                ) : (
                                    <StandingsTable
                                        standings={standings} isAdmin={isAdmin}
                                        handleStandingsLongPress={handleStandingsLongPress}
                                        isKnockoutReady={allMatchesDone}
                                        generateKnockouts={generateKnockouts}
                                        isKnockoutStarted={data.knockouts?.length > 0}
                                        qualifyCount={qCount}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </main>

            {/* BOTTOM TAB BAR */}
            {!isSetupMode && (
                <div className="flex-none absolute bottom-0 left-0 right-0 z-50">
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(to top, rgba(3,7,18,0.95) 60%, transparent)" }} />
                    <div className="relative p-4 pb-6">
                        <LiquidTabBar
                            tabs={[
                                { id: "matches", label: "Matches", icon: <Swords size={14} /> },
                                { id: "standings", label: "Standings", icon: <TrendingUp size={14} /> },
                            ]}
                            activeTab={activeTab}
                            onChange={(id) => { triggerHaptic(30); setActiveTab(id); }}
                            style={{ maxWidth: 300, margin: "0 auto" }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
