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
import GlassHeader from "../../common/GlassHeader";

// ─── Confetti Particle ────────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#FFCA28", "#F57C00", "#4ADE80", "#818CF8", "#F472B6", "#38BDF8"];
const seeded = (index, salt) => {
    const x = Math.sin((index + 1) * (salt + 1) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};
function ConfettiRain() {
    const count = 55;
    const particles = Array.from({ length: count }).map((_, i) => {
        const left = `${seeded(i, 1) * 100}%`;
        const delay = seeded(i, 2) * 2.5;
        const dur = 2.5 + seeded(i, 3) * 2;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 5 + Math.floor(seeded(i, 4) * 7);
        const rot = seeded(i, 5) * 360;
        const drift = (seeded(i, 6) - 0.5) * 120;
        const repeatDelay = seeded(i, 7) * 1.5;
        const borderRadius = seeded(i, 8) > 0.5 ? "50%" : 2;
        return { i, left, delay, dur, color, size, rot, drift, repeatDelay, borderRadius };
    });

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
                <motion.div
                    key={p.i}
                    initial={{ y: -20, x: 0, opacity: 1, rotate: p.rot }}
                    animate={{ y: "110vh", x: p.drift, opacity: [1, 1, 0], rotate: p.rot + 360 * 3 }}
                    transition={{ duration: p.dur, delay: p.delay, ease: "linear", repeat: Infinity, repeatDelay: p.repeatDelay }}
                    style={{
                        position: "absolute",
                        left: p.left,
                        top: 0,
                        width: p.size,
                        height: p.size,
                        borderRadius: p.borderRadius,
                        background: p.color,
                        boxShadow: `0 0 6px ${p.color}88`,
                    }}
                />
            ))}
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
    pointsToWin,
    setPointsToWin,
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
    const mainScrollRef = React.useRef(null);
    const tabScrollRef = React.useRef({ matches: 0, standings: 0 });
    const previousTabRef = React.useRef("matches");
    const viewHeaderRef = React.useRef(null);
    const [viewHeaderHeight, setViewHeaderHeight] = useState(0);

    const isSetupMode = !data || data.status === "draft";
    const isStandingsTabActive = !isSetupMode && activeTab === "standings";
    const standingsStickyTop = Math.max(88, viewHeaderHeight + 10);
    const tournamentTitle = String(data?.name || "Tournament").trim() || "Tournament";

    // Derive the qualifier count for standings display
    const qCount = useMemo(() => qualifyCount(standings.length), [standings.length]);

    // All pool matches done check
    const allMatchesDone = useMemo(() => {
        const matches = data?.matches || [];
        const knockouts = data?.knockouts || [];
        // If it's a 2-team bypass, matches will be empty, but we are "ready" 
        // because we go straight to knockouts.
        if (matches.length === 0 && (Array.isArray(knockouts) ? knockouts.length > 0 : Object.keys(knockouts).length > 0)) {
            return true;
        }
        return matches.length > 0 && matches.every((m) => m && m.done);
    }, [data?.matches, data?.knockouts]);

    // Celebration Logic: Only show if tournament just finished (transition),
    // or if we haven't dismissed it yet.
    // If we load the page and it's ALREADY over, we auto-dismiss to be polite.
    const wasOverOnMount = React.useRef(isTournamentOver);

    React.useEffect(() => {
        if (wasOverOnMount.current) {
            setDismissCelebration(true);
        }
    }, [setDismissCelebration]);

    // Keep independent scroll positions per mobile tab.
    React.useEffect(() => {
        const mainEl = mainScrollRef.current;
        if (!mainEl) return;

        const prevTab = previousTabRef.current;
        if (prevTab === activeTab) return;

        tabScrollRef.current[prevTab] = mainEl.scrollTop;
        const nextTop = tabScrollRef.current[activeTab] ?? 0;

        requestAnimationFrame(() => {
            if (mainScrollRef.current) {
                mainScrollRef.current.scrollTop = nextTop;
            }
        });

        previousTabRef.current = activeTab;
    }, [activeTab]);

    React.useLayoutEffect(() => {
        const element = viewHeaderRef.current;
        if (!element) return undefined;

        const syncHeight = () => {
            setViewHeaderHeight(element.getBoundingClientRect().height);
        };

        syncHeight();
        const observer = new ResizeObserver(syncHeight);
        observer.observe(element);
        return () => observer.disconnect();
    }, [isSetupMode, isAdmin, data?.name]);


    return (
        <div className="w-full max-w-5xl mx-auto h-[100dvh] flex flex-col relative overflow-hidden text-white"
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
                            className="neo-btn px-10 py-4 rounded-full font-black uppercase text-[10px] tracking-widest z-10 relative"
                            style={{ backdropFilter: "blur(20px)" }}
                        >
                            <Sparkles size={12} className="inline mr-2" />
                            View Final Board
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER */}
            <GlassHeader headerRef={viewHeaderRef}>
                <header className="px-5 py-4 flex justify-between items-center gap-3">
                    <motion.button whileTap={{ scale: 0.88 }}
                        onClick={() => { triggerHaptic(50); setActiveTournamentId(null); }}
                        className="neo-btn neo-btn-subtle neo-btn-icon w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
                        <ChevronLeft size={20} />
                    </motion.button>

                    <div
                        className="flex-1 min-w-0 flex flex-col items-center px-3 py-1.5 rounded-2xl"
                        style={{
                            background: "linear-gradient(145deg, rgba(15,23,42,0.64), rgba(2,6,23,0.72))",
                            border: "1px solid rgba(120,132,156,0.22)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        }}
                    >
                        <h1
                            className="max-w-full w-full text-sm font-black italic tracking-tight uppercase text-white text-center leading-[1.06] px-1"
                            style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                wordBreak: "break-word",
                            }}
                        >
                            {tournamentTitle}
                        </h1>
                        <span
                            className="mt-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.14em]"
                            style={{
                                color: isSetupMode ? "rgba(226,232,240,0.75)" : "rgba(254,243,199,0.94)",
                                background: isSetupMode ? "rgba(30,41,59,0.7)" : "rgba(255,202,40,0.14)",
                                border: isSetupMode ? "1px solid rgba(120,132,156,0.28)" : "1px solid rgba(255,202,40,0.34)",
                            }}
                        >
                            {isSetupMode ? "Setup Mode" : isTournamentOver ? "Event Completed" : "Live Event"}
                        </span>
                    </div>

                    <motion.button whileTap={{ scale: 0.88 }}
                        onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }}
                        className={`neo-btn neo-btn-icon w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isAdmin ? "" : "neo-btn-subtle"}`}
                        style={isAdmin
                            ? {
                                background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                border: "1px solid rgba(255,202,40,0.62)",
                                boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                color: "#fff8e1"
                            }
                            : { color: "rgba(255,255,255,0.65)" }
                        }>
                        {isAdmin ? <Unlock size={16} /> : <Lock size={16} />}
                    </motion.button>
                </header>
            </GlassHeader>

            {/* MAIN SCROLL */}
            <main
                ref={mainScrollRef}
                onScroll={(event) => {
                    tabScrollRef.current[activeTab] = event.currentTarget.scrollTop;
                }}
                className={`flex-1 min-h-0 relative z-10 ${isStandingsTabActive ? "overflow-hidden" : "overflow-y-auto"}`}
                style={{
                    paddingTop: `${Math.max(0, viewHeaderHeight) + 10}px`,
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                    scrollbarWidth: "none"
                }}>
                <div className={`p-5 ${isStandingsTabActive ? "pb-28 h-full min-h-0" : "pb-36"}`}>
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
                            pointsToWin={pointsToWin}
                            setPointsToWin={setPointsToWin}
                            selectedPlayers={selectedPlayers}
                            prepareAutoTournament={prepareAutoTournament}
                            commitAutoTournament={commitAutoTournament}
                            removeManualTeam={removeManualTeam}
                        />
                    ) : (
                        <div className={isStandingsTabActive ? "h-full min-h-0" : "pb-6"}>
                            {/* 
                                Mobile (default): Show only the active tab.
                                Tablet/Desktop (md:): Show both side-by-side in a responsive grid.
                            */}
                            <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start h-full">

                                {/* Matches Column: hidden on mobile if not active, shows on md+ taking 7 cols */}
                                <div className={`${activeTab === "matches" ? "block" : "hidden"} md:block md:col-span-7`}>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key="matches"
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                        >
                                            <MatchList
                                                matches={data.matches} knockouts={data.knockouts}
                                                isAdmin={isAdmin} adjustScore={adjustScore}
                                                confirmMatch={confirmMatch} confirmKnockout={confirmKnockout}
                                                pointsToWin={pointsToWin}
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Standings Column: hidden on mobile if not active, shows on md+ taking 5 cols */}
                                <div className={`${activeTab === "standings" ? "block" : "hidden"} md:block md:col-span-5 ${isStandingsTabActive ? "h-full min-h-0" : ""}`}>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key="standings"
                                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className={isStandingsTabActive ? "h-full min-h-0" : ""}
                                        >
                                            <div
                                                className={`md:sticky ${isStandingsTabActive ? "h-full min-h-0" : ""}`}
                                                style={{ top: `${standingsStickyTop}px` }}
                                            >
                                                <StandingsTable
                                                    standings={standings} isAdmin={isAdmin}
                                                    isKnockoutReady={allMatchesDone}
                                                    generateKnockouts={generateKnockouts}
                                                    isKnockoutStarted={data.knockouts?.length > 0}
                                                    qualifyCount={qCount}
                                                    isTournamentOver={isTournamentOver}
                                                    enableInternalScroll={isStandingsTabActive}
                                                />
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* BOTTOM TAB BAR - FIXED GLASS */}
            {!isSetupMode && (
                <div className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-8 pt-4 px-6 rounded-t-3xl"
                    style={{
                        background: "rgba(3,7,18,0.7)",
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        boxShadow: "0 -4px 30px rgba(0,0,0,0.5)",
                    }}>
                    <LiquidTabBar
                        tabs={[
                            { id: "matches", label: "Matches", icon: <Swords size={16} /> },
                            { id: "standings", label: "Standings", icon: <TrendingUp size={16} /> },
                        ]}
                        activeTab={activeTab}
                        onChange={(id) => { triggerHaptic(30); setActiveTab(id); }}
                        style={{ maxWidth: 300, margin: "0 auto" }}
                    />
                </div>
            )}
        </div>
    );
}
