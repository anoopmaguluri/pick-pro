import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "../../../hooks/useHaptic";
import { Plus, Trash2, UsersRound, UserPlus, Zap, Check, RotateCcw, Shuffle, Search } from "lucide-react";
import PlayerAvatar from "../../common/PlayerAvatar";
import LiquidButton from "../../common/LiquidButton";
import LiquidTabBar from "../../common/LiquidTabBar";
import GlassModal from "../../common/GlassModal";
import { WIN_TARGET_OPTIONS, normalizeWinTarget } from "../../../utils/scoringRules";


// ── MEMOIZED COMPONENTS ──
const DECK_ROW_HEIGHT = 72;
const DECK_OVERSCAN = 8;

const UnifiedDeckRow = React.memo(({ playerName, isDrafted, onToggle }) => (
    <div
        className="neo-btn h-16 w-full px-3.5 rounded-2xl flex items-center gap-3 relative overflow-hidden"
        style={{
            background: isDrafted
                ? "linear-gradient(145deg, rgba(255,202,40,0.2), rgba(245,124,0,0.14) 55%, rgba(15,23,42,0.32))"
                : "linear-gradient(145deg, rgba(148,163,184,0.14), rgba(30,41,59,0.34) 55%, rgba(15,23,42,0.4))",
            border: isDrafted ? "1px solid rgba(255,202,40,0.3)" : "1px solid rgba(148,163,184,0.3)",
            boxShadow: isDrafted
                ? "0 12px 24px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 16px rgba(255,202,40,0.12)"
                : "0 12px 24px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.14)"
        }}
    >
        <div className="neo-gloss-sweep opacity-35" />
        <PlayerAvatar
            name={playerName}
            className={`w-8 h-8 text-[9px] shrink-0 ${isDrafted ? "ring-2 ring-amber-300/50" : "ring-1 ring-slate-200/35"}`}
        />
        <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.11em] text-white truncate">{playerName}</p>
            <p
                className="text-[8px] font-black uppercase tracking-[0.14em] mt-0.5"
                style={{ color: isDrafted ? "rgba(255,202,40,0.82)" : "rgba(148,163,184,0.86)" }}
            >
                {isDrafted ? "Drafted" : "Bench"}
            </p>
        </div>
        <button
            type="button"
            onClick={() => onToggle(playerName, !isDrafted)}
            className="neo-btn neo-btn-icon h-8 px-3 rounded-full text-[8px] font-black uppercase tracking-[0.14em] flex items-center gap-1.5 shrink-0"
            style={isDrafted
                ? {
                    background: "rgba(2,6,23,0.52)",
                    border: "1px solid rgba(255,202,40,0.3)",
                    color: "rgba(255,232,173,0.9)"
                }
                : {
                    background: "rgba(2,6,23,0.52)",
                    border: "1px solid rgba(148,163,184,0.34)",
                    color: "rgba(226,232,240,0.9)"
                }
            }
        >
            {isDrafted ? <RotateCcw size={10} /> : <Plus size={10} />}
            {isDrafted ? "Bench" : "Draft"}
        </button>
    </div>
));

export default function Setup({
    data,
    roster,
    newPlayer,
    setNewPlayer,
    addPlayer,
    toggleDraftPlayer,
    isManualMode,
    setIsManualMode,
    manualTeams,
    handleManualSelect,
    handleFormatSelection,
    matchFormat,
    setMatchFormat,
    pointsToWin,
    setPointsToWin,
    selectedPlayers,
    prepareAutoTournament,
    commitAutoTournament,
    removeManualTeam,
}) {
    const { trigger: triggerHaptic } = useHaptic();
    const sortedRoster = React.useMemo(() => [...roster].sort(), [roster]);

    // Auto Draft Review State
    const [previewData, setPreviewData] = useState(null);

    // Toast Notification State
    const [toastMsg, setToastMsg] = useState(null);
    const [playerSearch, setPlayerSearch] = useState("");
    const [playerDeckTab, setPlayerDeckTab] = useState("all");
    const [deckScrollTop, setDeckScrollTop] = useState(0);
    const [deckViewportHeight, setDeckViewportHeight] = useState(420);
    const deckViewportRef = React.useRef(null);

    // Auto-dismiss toast
    React.useEffect(() => {
        if (!toastMsg) return;
        const timer = setTimeout(() => setToastMsg(null), 1500);
        return () => clearTimeout(timer);
    }, [toastMsg]);

    const draftPlayers = data.draftPlayers || [];
    const selectedPointsToWin = normalizeWinTarget(pointsToWin ?? data?.pointsToWin);
    const prevDraftLengthRef = React.useRef(draftPlayers.length);
    const isManualModeEligible = matchFormat === "doubles" && draftPlayers.length >= 4 && draftPlayers.length % 2 === 0;

    // When user adds 2nd player (1 → 2), default format to doubles. Don't override when removing a player (3 → 2).
    React.useEffect(() => {
        const prev = prevDraftLengthRef.current;
        prevDraftLengthRef.current = draftPlayers.length;
        if (prev === 1 && draftPlayers.length === 2) {
            setMatchFormat("doubles");
        }
    }, [draftPlayers.length]);

    React.useEffect(() => {
        if (isManualMode && !isManualModeEligible) {
            setIsManualMode(false);
        }
    }, [isManualMode, isManualModeEligible, setIsManualMode]);

    React.useEffect(() => {
        const container = deckViewportRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver((entries) => {
            const nextHeight = entries[0]?.contentRect?.height ?? 0;
            if (nextHeight > 0) setDeckViewportHeight(nextHeight);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Memoize player groups for deck filtering + virtualization
    const draftedSet = React.useMemo(() => new Set(draftPlayers), [draftPlayers]);
    const allPlayers = React.useMemo(() => {
        const merged = new Set([...sortedRoster, ...draftPlayers]);
        return Array.from(merged).sort((a, b) => a.localeCompare(b));
    }, [sortedRoster, draftPlayers]);
    const benchedPlayers = React.useMemo(() =>
        allPlayers.filter((player) => !draftedSet.has(player)),
        [allPlayers, draftedSet]);

    const searchQuery = playerSearch.trim().toLowerCase();
    const hasRosterPlayers = allPlayers.length > 0;
    const isSearchActive = searchQuery.length >= 2;
    const deckBasePlayers = React.useMemo(() => {
        if (playerDeckTab === "drafted") return allPlayers.filter((player) => draftedSet.has(player));
        if (playerDeckTab === "bench") return benchedPlayers;
        return allPlayers;
    }, [allPlayers, benchedPlayers, draftedSet, playerDeckTab]);
    const filteredDeckPlayers = React.useMemo(() => {
        if (!isSearchActive) return deckBasePlayers;
        return deckBasePlayers.filter((player) => player.toLowerCase().includes(searchQuery));
    }, [deckBasePlayers, isSearchActive, searchQuery]);

    const deckTotalRows = filteredDeckPlayers.length;
    const deckVisibleCount = Math.ceil(deckViewportHeight / DECK_ROW_HEIGHT) + DECK_OVERSCAN * 2;
    const deckStartIndex = Math.max(0, Math.floor(deckScrollTop / DECK_ROW_HEIGHT) - DECK_OVERSCAN);
    const deckEndIndex = Math.min(deckTotalRows, deckStartIndex + deckVisibleCount);
    const visibleDeckPlayers = React.useMemo(() =>
        filteredDeckPlayers.slice(deckStartIndex, deckEndIndex),
        [filteredDeckPlayers, deckStartIndex, deckEndIndex]);
    const deckInnerHeight = deckTotalRows * DECK_ROW_HEIGHT;

    const summaryCounts = React.useMemo(() => ({
        total: allPlayers.length,
        drafted: draftedSet.size,
        bench: benchedPlayers.length
    }), [allPlayers.length, draftedSet.size, benchedPlayers.length]);

    // Optimize callbacks
    const handleRemove = React.useCallback((p) => {
        triggerHaptic(20);
        toggleDraftPlayer(p, false);
        setToastMsg({ type: 'remove', text: `${p} sent to Bench` });
    }, [toggleDraftPlayer, triggerHaptic]);

    const handleAdd = React.useCallback((p) => {
        triggerHaptic(20);
        toggleDraftPlayer(p, true);
        setToastMsg({ type: 'add', text: `${p} drafted` });
    }, [toggleDraftPlayer, triggerHaptic]);

    React.useEffect(() => {
        setDeckScrollTop(0);
        if (deckViewportRef.current) {
            deckViewportRef.current.scrollTop = 0;
        }
    }, [playerDeckTab, searchQuery]);

    React.useEffect(() => {
        const maxScrollTop = Math.max(0, deckInnerHeight - deckViewportHeight);
        if (deckScrollTop > maxScrollTop) {
            setDeckScrollTop(maxScrollTop);
            if (deckViewportRef.current) {
                deckViewportRef.current.scrollTop = maxScrollTop;
            }
        }
    }, [deckInnerHeight, deckViewportHeight, deckScrollTop]);

    const handleDeckScroll = React.useCallback((event) => {
        setDeckScrollTop(event.currentTarget.scrollTop);
    }, []);

    const handleDeckToggle = React.useCallback((playerName, shouldDraft) => {
        if (shouldDraft) {
            handleAdd(playerName);
            return;
        }
        handleRemove(playerName);
    }, [handleAdd, handleRemove]);

    const handleAutoDraft = async (fmt) => {
        try {
            const preview = await prepareAutoTournament(fmt);
            setPreviewData(preview);
            triggerHaptic(50);
        } catch (error) {
            console.error("Auto Draft Error:", error);
            // Optionally show a toast or alert
        }
    };

    const handlePointsToWinSelect = React.useCallback((target) => {
        const nextTarget = normalizeWinTarget(target);
        if (nextTarget === selectedPointsToWin) return;
        triggerHaptic(30);
        if (typeof setPointsToWin === "function") {
            void setPointsToWin(nextTarget);
        }
    }, [selectedPointsToWin, setPointsToWin, triggerHaptic]);

    const confirmPreview = () => {
        if (!previewData) return;
        commitAutoTournament(previewData);
        setPreviewData(null);
    };

    const handleManualUndo = () => {
        if (selectedPlayers.length > 0) {
            handleManualSelect(selectedPlayers[selectedPlayers.length - 1]);
            triggerHaptic(30);
        }
    };

    // Team Builder Visuals
    const firstPick = selectedPlayers[0];
    const secondPick = selectedPlayers[1];

    const availablePlayersForManual = React.useMemo(() =>
        draftPlayers.filter((p) => !manualTeams.some((team) => team.p1 === p || team.p2 === p)),
        [draftPlayers, manualTeams]);
    const canStartManualMatches = manualTeams.length > 0 && availablePlayersForManual.length === 0 && selectedPlayers.length === 0;

    const glassCard = {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.07)"
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-5 md:space-y-8 relative z-10 md:p-8">
            {!isManualMode ? (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className="md:grid md:grid-cols-12 md:gap-8 md:items-start space-y-6 md:space-y-0">

                    {/* LEFT COLUMN: Draft Input & Settings */}
                    <div className="md:col-span-7 space-y-6 flex flex-col">
                        <div className="p-6 rounded-[2rem]" style={glassCard}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 leading-none" style={{ color: "rgba(255,202,40,0.7)" }}>
                                <span>Draft Athletes</span>
                                {draftPlayers.length > 0 && (
                                    <span className="px-2 py-[2px] rounded-full text-[8px] font-black leading-none" style={{ background: "rgba(255,202,40,0.12)", color: "rgba(255,202,40,0.9)" }}>
                                        {draftPlayers.length}
                                    </span>
                                )}
                            </p>

                            <form onSubmit={addPlayer} className="flex gap-2 mb-5 relative">
                                <div className="flex-1 relative">
                                    <div className="absolute inset-0 rounded-xl bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] pointer-events-none" />
                                    <input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} placeholder="Enter name..."
                                        className="w-full relative rounded-xl px-5 py-4 text-sm font-bold text-white outline-none placeholder-white/30 bg-transparent"
                                        style={{ border: "1px solid rgba(255,255,255,0.05)", caretColor: "#FFCA28" }}
                                        onFocus={(e) => e.target.style.borderColor = 'rgba(255,202,40,0.5)'}
                                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'} />
                                    <div className="absolute inset-0 rounded-xl pointer-events-none opacity-20 overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-[200%] animate-[scan_4s_linear_infinite]" />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="neo-btn neo-btn-icon w-[52px] flex-shrink-0 flex items-center justify-center rounded-xl relative overflow-hidden group transition-transform active:scale-95"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-600/20 group-hover:opacity-100 opacity-60 transition-opacity" />
                                    <div className="neo-gloss-sweep opacity-80" />
                                    <Plus size={20} className="relative z-10 text-amber-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                                </button>
                            </form>

                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: "Total", value: summaryCounts.total, tone: "rgba(148,163,184,0.85)" },
                                    { label: "Drafted", value: summaryCounts.drafted, tone: "rgba(255,202,40,0.9)" },
                                    { label: "Bench", value: summaryCounts.bench, tone: "rgba(148,163,184,0.85)" },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-xl px-2.5 py-3 text-center"
                                        style={{
                                            background: "linear-gradient(145deg, rgba(2,6,23,0.52), rgba(15,23,42,0.34))",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)"
                                        }}
                                    >
                                        <p className="text-[8px] font-black uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                                            {item.label}
                                        </p>
                                        <p className="text-lg font-black tabular-nums mt-0.5" style={{ color: item.tone }}>
                                            {item.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {!hasRosterPlayers && (
                                <div className="mt-3 py-6 text-center rounded-xl flex flex-col items-center gap-2"
                                    style={{ border: "1px dashed rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
                                    <UserPlus size={20} style={{ color: "rgba(255,255,255,0.12)" }} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)" }}>
                                        Add players to get started
                                    </p>
                                </div>
                            )}
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 rounded-[1.7rem] relative overflow-hidden"
                            style={{
                                background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,124,0,0.09) 45%, rgba(255,255,255,0.03))",
                                border: "1px solid rgba(255,202,40,0.25)",
                                boxShadow: "0 16px 36px rgba(2,6,23,0.6), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 26px rgba(255,202,40,0.12)",
                                backdropFilter: "blur(26px)"
                            }}
                        >
                            <div className="absolute inset-0 pointer-events-none opacity-70">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,202,40,0.28),transparent_45%)]" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_100%,rgba(245,124,0,0.22),transparent_50%)]" />
                            </div>

                            <div className="relative z-10 flex items-center justify-between mb-4">
                                <p className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(255,202,40,0.9)" }}>
                                    Game Points
                                </p>
                                <span
                                    className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.18em]"
                                    style={{
                                        color: "rgba(255,202,40,0.95)",
                                        border: "1px solid rgba(255,202,40,0.35)",
                                        background: "rgba(245,124,0,0.18)"
                                    }}
                                >
                                    To {selectedPointsToWin}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {WIN_TARGET_OPTIONS.map((target) => {
                                    const isActive = selectedPointsToWin === target;
                                    return (
                                        <motion.button
                                            key={target}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handlePointsToWinSelect(target)}
                                            className="neo-btn rounded-2xl px-2 py-3 text-center relative overflow-hidden"
                                            style={isActive
                                                ? {
                                                    border: "1px solid rgba(255,202,40,0.6)",
                                                    background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                                    boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                                    color: "#fff8e1"
                                                }
                                                : {
                                                    border: "1px solid rgba(255,202,40,0.16)",
                                                    background: "rgba(2,6,23,0.5)",
                                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                                                    color: "rgba(255,255,255,0.48)"
                                                }
                                            }
                                        >
                                            {isActive && (
                                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2.4s_infinite]" />
                                            )}
                                            <span className="relative z-10 text-lg font-black tabular-nums tracking-tight">{target}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Format Selection (Inside Left Column): 2+ players (singles 2→ grand final; 4+ for round robin / manual) */}
                        {draftPlayers.length >= 2 && (
                            <>
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }} />
                                    <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>Format</span>
                                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.08), transparent)" }} />
                                </div>
                                <div className="mb-2">
                                    <LiquidTabBar
                                        tabs={[
                                            { id: "singles", label: "Singles" },
                                            { id: "doubles", label: "Doubles" }
                                        ]}
                                        activeTab={matchFormat} onChange={setMatchFormat}
                                        containerStyle={{
                                            background: "rgba(255,255,255,0.03)",
                                            backdropFilter: "none",
                                            padding: "4px",
                                            border: "1px solid rgba(255,202,40,0.16)"
                                        }}
                                        activeTabStyle={{
                                            background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                            border: "1px solid rgba(255,202,40,0.62)",
                                            boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                            color: "#fff8e1"
                                        }}
                                        inactiveTabStyle={{ color: "rgba(255,255,255,0.56)" }}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <LiquidButton
                                        onClick={() => handleAutoDraft(matchFormat)}
                                        variant="primary"
                                        glossy
                                        className="flex-1"
                                        style={{
                                            borderRadius: "1rem",
                                            padding: "1rem",
                                            background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                            border: "1px solid rgba(255,202,40,0.62)",
                                            boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                            color: "#fff8e1",
                                        }}
                                        disabled={matchFormat === "doubles" && draftPlayers.length < 4}
                                    >
                                        <Zap size={16} fill="currentColor" />
                                        <span className="ml-1.5 font-bold">Auto Draft</span>
                                    </LiquidButton>
                                    {isManualModeEligible && (
                                        <LiquidButton
                                            onClick={() => setIsManualMode(true)}
                                            variant="secondary"
                                            glossy
                                            className="flex-1"
                                            style={{
                                                borderRadius: "1rem",
                                                padding: "1rem",
                                                background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                                border: "1px solid rgba(255,202,40,0.62)",
                                                boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                                color: "#fff8e1",
                                            }}
                                        >
                                            <UsersRound size={16} /> <span className="ml-1.5 font-bold">Manual Teams</span>
                                        </LiquidButton>
                                    )}
                                </div>
                                {matchFormat === "doubles" && draftPlayers.length >= 4 && draftPlayers.length % 2 !== 0 && (
                                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-400/80">
                                        Manual Teams requires an even number of players.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Unified Player Command Deck */}
                    <div className="md:col-span-5 md:sticky md:top-[120px]">
                        <div
                            className="p-5 rounded-[2rem] relative overflow-hidden h-[520px] md:h-[560px] flex flex-col"
                            style={{
                                background: "linear-gradient(150deg, rgba(148,163,184,0.14), rgba(30,41,59,0.4) 48%, rgba(2,6,23,0.58))",
                                border: "1px solid rgba(148,163,184,0.3)",
                                boxShadow: "0 20px 42px rgba(2,6,23,0.6), inset 0 1px 0 rgba(255,255,255,0.12)",
                                backdropFilter: "blur(24px)"
                            }}
                        >
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(148,163,184,0.28),transparent_46%)]" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.16),transparent_48%)]" />
                            </div>

                            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3.5 flex items-center gap-1.5 leading-none" style={{ color: "rgba(241,245,249,0.9)" }}>
                                <UsersRound size={11} /> Player Command Deck
                                <span className="ml-auto px-2 py-[2px] rounded-full text-[8px] font-black leading-none" style={{ background: "rgba(15,23,42,0.55)", color: "rgba(226,232,240,0.95)", border: "1px solid rgba(148,163,184,0.28)" }}>
                                    {summaryCounts.total}
                                </span>
                            </p>
                            <p className="text-[8px] font-black uppercase tracking-[0.16em] mb-3" style={{ color: "rgba(203,213,225,0.6)" }}>
                                Unified Draft And Bench Controls
                            </p>

                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {[
                                    { id: "all", label: "All", count: summaryCounts.total },
                                    { id: "drafted", label: "Drafted", count: summaryCounts.drafted },
                                    { id: "bench", label: "Bench", count: summaryCounts.bench },
                                ].map((tab) => {
                                    const isActive = playerDeckTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => {
                                                if (playerDeckTab === tab.id) return;
                                                triggerHaptic(20);
                                                setPlayerDeckTab(tab.id);
                                            }}
                                            className="neo-btn rounded-xl py-2 px-1.5 text-center"
                                            style={isActive
                                                ? {
                                                    background: "linear-gradient(145deg, rgba(255,202,40,0.36), rgba(245,124,0,0.32))",
                                                    border: "1px solid rgba(255,202,40,0.58)",
                                                    color: "#fff8e1",
                                                    boxShadow: "0 0 20px rgba(255,202,40,0.22), inset 0 1px 0 rgba(255,255,255,0.2)"
                                                }
                                                : {
                                                    background: "rgba(2,6,23,0.5)",
                                                    border: "1px solid rgba(148,163,184,0.26)",
                                                    color: "rgba(226,232,240,0.72)",
                                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)"
                                                }
                                            }
                                        >
                                            <p className="text-[8px] font-black uppercase tracking-[0.12em]">{tab.label}</p>
                                            <p className="text-[11px] font-black tabular-nums mt-0.5">{tab.count}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mb-3 relative">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/50 pointer-events-none" />
                                <input
                                    value={playerSearch}
                                    onChange={(event) => setPlayerSearch(event.target.value)}
                                    placeholder="Search players..."
                                    className="w-full rounded-xl pl-9 pr-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white placeholder-white/35 bg-transparent outline-none"
                                    style={{ border: "1px solid rgba(148,163,184,0.28)", background: "rgba(2,6,23,0.42)" }}
                                />
                            </div>

                            <div className="h-4 mb-2 flex items-center justify-between">
                                <span className="text-[8px] font-black uppercase tracking-[0.13em]" style={{ color: "rgba(148,163,184,0.72)" }}>
                                    {playerSearch.length > 0 && playerSearch.length < 2 ? "Type 2+ letters to filter" : "\u00A0"}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-[0.12em]" style={{ color: "rgba(148,163,184,0.58)" }}>
                                    {deckTotalRows}/{deckBasePlayers.length}
                                </span>
                            </div>

                            <div
                                className="relative flex-1 min-h-0 rounded-[1.25rem] border border-slate-300/15 bg-slate-950/35 overflow-hidden"
                                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -20px 28px rgba(2,6,23,0.24)" }}
                            >
                                <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.28), rgba(2,6,23,0.58))" }} />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 z-10" style={{ background: "linear-gradient(to top, rgba(2,6,23,0.9), rgba(2,6,23,0.22), transparent)" }} />

                                <div
                                    ref={deckViewportRef}
                                    onScroll={handleDeckScroll}
                                    className="relative z-[1] h-full min-h-0 overflow-y-auto p-2 pb-6 scrollbar-hide"
                                    style={{
                                        scrollbarWidth: "none",
                                        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 44px), rgba(0,0,0,0) 100%)",
                                        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 44px), rgba(0,0,0,0) 100%)"
                                    }}
                                >
                                    {!hasRosterPlayers ? (
                                        <div className="rounded-2xl px-4 py-7 text-center" style={{ background: "rgba(15,23,42,0.45)", border: "1px dashed rgba(148,163,184,0.28)" }}>
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(226,232,240,0.78)" }}>
                                                No Players To Draft
                                            </p>
                                            <p className="text-[9px] font-bold mt-1" style={{ color: "rgba(148,163,184,0.78)" }}>
                                                Add players to the roster to start drafting.
                                            </p>
                                        </div>
                                    ) : playerDeckTab === "bench" && !isSearchActive && summaryCounts.bench === 0 ? (
                                        <div className="rounded-2xl px-4 py-7 text-center" style={{ background: "rgba(15,23,42,0.45)", border: "1px dashed rgba(148,163,184,0.28)" }}>
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(226,232,240,0.78)" }}>
                                                All Players Drafted
                                            </p>
                                            <p className="text-[9px] font-bold mt-1" style={{ color: "rgba(148,163,184,0.78)" }}>
                                                Everyone is currently in draft.
                                            </p>
                                        </div>
                                    ) : playerDeckTab === "drafted" && !isSearchActive && summaryCounts.drafted === 0 ? (
                                        <div className="rounded-2xl px-4 py-7 text-center" style={{ background: "rgba(15,23,42,0.45)", border: "1px dashed rgba(148,163,184,0.28)" }}>
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(226,232,240,0.78)" }}>
                                                Draft Queue Empty
                                            </p>
                                            <p className="text-[9px] font-bold mt-1" style={{ color: "rgba(148,163,184,0.78)" }}>
                                                Move players from Bench into Draft.
                                            </p>
                                        </div>
                                    ) : deckTotalRows === 0 ? (
                                        <div className="rounded-2xl px-4 py-7 text-center" style={{ background: "rgba(15,23,42,0.45)", border: "1px dashed rgba(148,163,184,0.28)" }}>
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(226,232,240,0.78)" }}>
                                                No Players
                                            </p>
                                            <p className="text-[9px] font-bold mt-1" style={{ color: "rgba(148,163,184,0.78)" }}>
                                                No players match this search.
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ height: deckInnerHeight, position: "relative" }}>
                                            {visibleDeckPlayers.map((playerName, listIndex) => {
                                                const absoluteIndex = deckStartIndex + listIndex;
                                                const isDrafted = draftedSet.has(playerName);
                                                return (
                                                    <div
                                                        key={playerName}
                                                        style={{
                                                            position: "absolute",
                                                            top: absoluteIndex * DECK_ROW_HEIGHT,
                                                            left: 0,
                                                            right: 0,
                                                            height: DECK_ROW_HEIGHT,
                                                            paddingBottom: 8
                                                        }}
                                                    >
                                                        <UnifiedDeckRow
                                                            playerName={playerName}
                                                            isDrafted={isDrafted}
                                                            onToggle={handleDeckToggle}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-5">
                    <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Manual Team Selection</p>
                        <button
                            onClick={() => setIsManualMode(false)}
                            className="neo-btn neo-btn-subtle text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl"
                            style={{ color: "rgba(255,202,40,0.9)" }}
                        >
                            ← Cancel
                        </button>
                    </div>

                    <div className="md:grid md:grid-cols-12 md:gap-8 md:items-start space-y-5 md:space-y-0">
                        {/* LEFT COLUMN: Available Players */}
                        <div className="md:col-span-6 space-y-3 min-h-0">
                            <p className="text-[9px] font-black uppercase tracking-widest pl-2" style={{ color: "rgba(255,255,255,0.25)" }}>Available Athletes</p>
                            <div
                                className="grid grid-cols-2 gap-3 max-h-[46vh] md:max-h-none overflow-y-auto md:overflow-visible pr-1 pb-1"
                                style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                            >
                                {availablePlayersForManual.length > 0 ? availablePlayersForManual.map((p) => (
                                    <motion.button whileTap={{ scale: 0.93 }} key={p} onClick={() => handleManualSelect(p)}
                                        className="neo-btn flex items-center gap-2 pl-2 pr-4 py-2 rounded-full font-black text-[11px] uppercase transition-all relative overflow-hidden group"
                                        style={selectedPlayers.includes(p)
                                            ? { background: "linear-gradient(135deg, rgba(255,202,40,0.15), rgba(245,124,0,0.15))", border: "1px solid rgba(255,202,40,0.5)", color: "#FFCA28", boxShadow: "0 0 20px rgba(255,202,40,0.2), inset 0 0 10px rgba(255,202,40,0.1)" }
                                            : { background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" }
                                        }>
                                        {selectedPlayers.includes(p) && <div className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />}
                                        <PlayerAvatar name={p} className={`relative z-10 w-8 h-8 text-[10px] ${selectedPlayers.includes(p) ? "ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "opacity-60 group-hover:opacity-100 transition-opacity"}`} />
                                        <span className="relative z-10">{p}</span>
                                    </motion.button>
                                )) : (
                                    <div
                                        className="col-span-2 rounded-2xl px-4 py-5 text-center"
                                        style={{ background: "rgba(15,23,42,0.45)", border: "1px dashed rgba(148,163,184,0.24)" }}
                                    >
                                        <p className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: "rgba(226,232,240,0.72)" }}>
                                            No Athletes Available
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: The Builder & Completed Teams */}
                        <div className="md:col-span-6 space-y-5 md:sticky md:top-[120px]">
                            <div className="p-4 rounded-[1.5rem]" style={glassCard}>
                                <h3 className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 leading-none" style={{ color: "rgba(255,202,40,0.6)" }}>
                                    <span>Building Team {manualTeams.length + 1}</span>
                                    <span className="px-2 py-[2px] rounded-full text-[8px] leading-none" style={{ background: "rgba(255,202,40,0.1)", color: "rgba(255,202,40,0.7)" }}>{selectedPlayers.length}/2</span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden group"
                                        style={{
                                            background: firstPick ? "rgba(245,158,11,0.15)" : "rgba(0,0,0,0.6)",
                                            border: firstPick ? "1px solid rgba(255,202,40,0.4)" : "1px dashed rgba(255,255,255,0.15)",
                                            boxShadow: firstPick ? "inset 0 0 20px rgba(245,158,11,0.2), 0 0 15px rgba(245,158,11,0.1)" : "inset 0 4px 10px rgba(0,0,0,0.8)",
                                        }}>
                                        {!firstPick && <div className="absolute inset-0 pointer-events-none opacity-30"><div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent animate-[scan_3s_linear_infinite]" /></div>}
                                        {firstPick ? (
                                            <motion.div layoutId="pick1" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                                <PlayerAvatar name={firstPick} className="w-6 h-6 text-[8px] ring-1 ring-amber-400/30" />{firstPick}
                                            </motion.div>
                                        ) : (
                                            <span className="text-white/15 text-[10px] font-black uppercase tracking-widest">Player 1</span>
                                        )}
                                    </div>
                                    <div className="text-white/15 font-black text-xs">+</div>
                                    <div className="flex-1 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden group"
                                        style={{
                                            background: secondPick ? "rgba(245,158,11,0.15)" : "rgba(0,0,0,0.6)",
                                            border: secondPick ? "1px solid rgba(255,202,40,0.4)" : "1px dashed rgba(255,255,255,0.15)",
                                            boxShadow: secondPick ? "inset 0 0 20px rgba(245,158,11,0.2), 0 0 15px rgba(245,158,11,0.1)" : "inset 0 4px 10px rgba(0,0,0,0.8)",
                                        }}>
                                        {!secondPick && firstPick && <div className="absolute inset-0 pointer-events-none opacity-30"><div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent animate-[scan_3s_linear_infinite]" /></div>}
                                        {secondPick ? (
                                            <motion.div layoutId="pick2" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                                <PlayerAvatar name={secondPick} className="w-6 h-6 text-[8px] ring-1 ring-amber-400/30" />{secondPick}
                                            </motion.div>
                                        ) : (
                                            <span className="text-white/15 text-[10px] font-black uppercase tracking-widest">Player 2</span>
                                        )}
                                    </div>
                                    {selectedPlayers.length > 0 && (
                                        <motion.button whileTap={{ scale: 0.9 }} onClick={handleManualUndo} className="neo-btn neo-btn-danger neo-btn-icon h-14 w-14 rounded-2xl flex items-center justify-center"
                                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.6)", boxShadow: "0 0 12px rgba(239,68,68,0.08)" }}>
                                            <RotateCcw size={18} />
                                        </motion.button>
                                    )}
                                </div>
                            </div>

                            {manualTeams.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-[9px] font-black uppercase tracking-widest pl-1 flex items-center gap-2 leading-none" style={{ color: "rgba(255,255,255,0.25)" }}>
                                        Ready for Battle
                                        <span className="px-2 py-[2px] rounded-full text-[8px] font-black leading-none" style={{ background: "rgba(34,197,94,0.1)", color: "rgba(34,197,94,0.7)" }}>{manualTeams.length}</span>
                                    </h3>
                                    <div className="space-y-2">
                                        <AnimatePresence initial={false} mode="popLayout">
                                            {manualTeams.map((t, i) => (
                                                <motion.div
                                                    key={i}
                                                    layout
                                                    initial={{ y: 10, scale: 0.98, opacity: 0 }}
                                                    animate={{ y: 0, scale: 1, opacity: 1 }}
                                                    exit={{ y: -8, scale: 0.97, opacity: 0 }}
                                                    transition={{
                                                        layout: { type: "spring", stiffness: 400, damping: 32, mass: 0.7 },
                                                        y: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                                                        opacity: { duration: 0.16, ease: "easeOut" },
                                                        scale: { duration: 0.16, ease: "easeOut" }
                                                    }}
                                                    className="flex items-center justify-between p-3 rounded-xl relative overflow-hidden"
                                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                                                            style={{ background: "linear-gradient(135deg, rgba(255,202,40,0.2), rgba(245,124,0,0.15))", border: "1px solid rgba(255,202,40,0.2)", color: "rgba(255,202,40,0.9)" }}>
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex -space-x-1.5">
                                                                <PlayerAvatar name={t.p1} className="w-6 h-6 text-[8px] ring-1 ring-white/10 z-10" />
                                                                <PlayerAvatar name={t.p2} className="w-6 h-6 text-[8px] ring-1 ring-white/10 z-0" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-white/80 uppercase">
                                                                <span>{t.p1}</span> <span className="text-white/15">+</span> <span>{t.p2}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeManualTeam(i)}
                                                        className="neo-btn neo-btn-danger neo-btn-icon p-2 text-white/75 hover:text-red-100 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}

                            {manualTeams.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center gap-2 py-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                            {manualTeams.length} {manualTeams.length === 1 ? "team" : "teams"} ready
                                            {availablePlayersForManual.length > 0 && (
                                                <> · {availablePlayersForManual.length} {availablePlayersForManual.length === 1 ? "player" : "players"} remaining</>
                                            )}
                                        </span>
                                    </div>
                                    {canStartManualMatches && (
                                        <LiquidButton onClick={() => handleFormatSelection(manualTeams)} variant="primary" style={{ width: "100%", padding: "1.2rem", borderRadius: "1rem", fontSize: "0.8rem" }}>
                                            ⚡ Start Matches
                                        </LiquidButton>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* PREVIEW MODAL */}
            {/* PREVIEW MODAL */}
            <GlassModal
                isOpen={!!previewData}
                onClose={() => setPreviewData(null)}
                icon={<Zap />}
                title={
                    <>
                        {previewData?.format === "singles" ? "Singles" : "Doubles"}
                        <span className="px-1.5 py-[2px] rounded text-[8px] font-black tracking-widest bg-amber-500/20 text-amber-400 uppercase border border-amber-500/20 ml-2">
                            Ready
                        </span>
                    </>
                }
                subtitle={
                    previewData ? (
                        <>
                            {previewData.matches.length === 0 && (previewData.knockouts?.length ?? 0) > 0 ? (
                                <>Grand Final only · <strong className="text-white/80">{previewData.players.length} players</strong></>
                            ) : (
                                <>Generating <strong className="text-white/80">{previewData.matches.length} matches</strong> for <strong className="text-white/80">{previewData.players.length} players</strong>.</>
                            )}
                        </>
                    ) : null
                }
                actions={
                    <div className="grid grid-cols-[54px_minmax(0,1fr)] gap-2 w-full">
                        <LiquidButton
                            onClick={() => handleAutoDraft(matchFormat)}
                            variant="ghost"
                            style={{ borderRadius: "1rem", padding: "0.95rem 0", minWidth: 0 }}
                            title="Regenerate Teams"
                        >
                            <Shuffle size={16} />
                        </LiquidButton>
                        <LiquidButton onClick={confirmPreview} variant="primary" style={{ borderRadius: "1rem", padding: "1.1rem", fontSize: "0.9rem" }}>
                            <span className="font-black">Start Event</span>
                        </LiquidButton>
                    </div>
                }
            >
                {/* GENERATED TEAMS REVIEW LIST */}
                {previewData?.teams && previewData.teams.length > 0 && (
                    <div className="mt-2 text-left">
                        <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 pl-1 flex items-center justify-between">
                            <span>Generated Teams</span>
                            <span>{previewData.teams.length} total</span>
                        </div>
                        <div className="space-y-2 pr-1">
                            {previewData.teams.map((team, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-black text-white/40 shrink-0">
                                        {idx + 1}
                                    </div>
                                    <span className="text-[11px] font-black text-white uppercase tracking-wider truncate flex-1 flex items-center gap-1.5">
                                        {team.p1} <span className="text-white/20 text-[9px]">AND</span> {team.p2}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </GlassModal>

            {/* FLOATING TOAST NOTIFICATION */}
            <AnimatePresence>
                {toastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="fixed bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-full flex items-center gap-2 pointer-events-none"
                        style={{
                            background: "rgba(3,7,18,0.85)",
                            backdropFilter: "blur(20px)",
                            border: `1px solid ${toastMsg.type === 'add' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                            boxShadow: `0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 20px ${toastMsg.type === 'add' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)'}`
                        }}
                    >
                        {toastMsg.type === 'add' ? (
                            <Check size={14} className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                        ) : (
                            <RotateCcw size={14} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                        )}
                        <span className="text-[11px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                            {toastMsg.text}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
