import React from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import {
    Trophy,
    LayoutGrid,
    TrendingUp,
    Plus,
    Trash2,
    CalendarDays,
    Medal,
    Users,
    Lock,
    Unlock,
    Zap,
    Crown,
    ChevronRight,
} from "lucide-react";
import { useHaptic } from "../../../hooks/useHaptic";
import PlayerAvatar from "../../common/PlayerAvatar";
import Modal from "../../common/Modal";
import LiquidButton from "../../common/LiquidButton";
import LiquidTabBar from "../../common/LiquidTabBar";
import GlassHeader from "../../common/GlassHeader";
import { getMonogram } from "../../../utils/formatting";

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const formatEventType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    if (type === "singles") return "Singles";
    if (type === "mixer") return "Mixer";
    if (type === "fixed" || type === "pairs") return "Fixed Teams";
    return "Open";
};

const formatEventDate = (timestamp) => {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || ts <= 0) return "Unknown date";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatEventAge = (timestamp) => {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || ts <= 0) return "";

    const now = Date.now();
    const diffMs = Math.max(0, now - ts);
    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;

    if (diffMs < hourMs) return "just now";
    if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}h ago`;
    if (diffMs < dayMs * 30) return `${Math.floor(diffMs / dayMs)}d ago`;
    return `${Math.floor(diffMs / (dayMs * 30))}mo ago`;
};

const rankingColumnLayout = "grid-cols-[28px_minmax(0,1fr)_56px_64px]";
const toRatingStr = (player) => toNumber(player?.rating).toFixed(2);
const toWinRatePct = (player) => {
    const wins = toNumber(player?.w);
    const losses = toNumber(player?.l);
    const played = wins + losses;
    const baseRate = played > 0 ? wins / played : 0;
    const winRate = toNumber(player?.winRate) || baseRate;
    return Math.max(0, Math.min(100, Math.round(winRate * 100)));
};

export default function TournamentHub({
    tournaments,
    setActiveTournamentId,
    createTournament,
    deleteTournament,
    newTourneyName,
    setNewTourneyName,
    globalLeaderboard,
    isAdmin,
    setIsAdmin,
    hubTab,
    setHubTab,
}) {
    const { trigger: triggerHaptic } = useHaptic();
    const hubHeaderRef = React.useRef(null);
    const [hubHeaderHeight, setHubHeaderHeight] = React.useState(0);

    const [deleteModal, setDeleteModal] = React.useState({
        show: false,
        id: null,
        snapBack: null,   // fn to animate card back if modal is cancelled
    });

    const sortedTournaments = Object.values(tournaments || {}).sort(
        (a, b) => b.createdAt - a.createdAt
    );
    const activeEventsCount = sortedTournaments.filter((event) => event?.status === "active").length;
    const draftEventsCount = sortedTournaments.filter((event) => event?.status === "draft").length;
    const doneEventsCount = sortedTournaments.filter((event) => event?.status === "done").length;
    const leaderboard = Array.isArray(globalLeaderboard) ? globalLeaderboard : [];
    const leaderboardAverageWinRate = leaderboard.length > 0
        ? Math.round((leaderboard.reduce((sum, p) => sum + (toNumber(p.winRate) * 100), 0) / leaderboard.length))
        : 0;
    const leaderboardTotalGames = leaderboard.reduce(
        (sum, p) => sum + toNumber(p.w) + toNumber(p.l),
        0
    );
    const topThree = leaderboard.slice(0, 3);
    const remainingLeaderboard = leaderboard.slice(3);

    React.useLayoutEffect(() => {
        const element = hubHeaderRef.current;
        if (!element) return undefined;

        const syncHeight = () => {
            setHubHeaderHeight(element.getBoundingClientRect().height);
        };

        syncHeight();
        const observer = new ResizeObserver(syncHeight);
        observer.observe(element);
        return () => observer.disconnect();
    }, [hubTab]);

    return (
        <div className="w-full max-w-5xl mx-auto h-[100dvh] flex flex-col relative overflow-hidden"
            style={{ background: "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 80% 80%, rgba(236,72,153,0.08) 0%, transparent 50%), #030712" }}>

            <Modal
                show={deleteModal.show}
                title="Delete Event?"
                message="This will permanently delete this event and its history. This action cannot be undone."
                confirmText="Delete"
                isDestructive={true}
                onCancel={() => {
                    if (deleteModal.snapBack) deleteModal.snapBack();
                    setDeleteModal({ show: false, id: null, snapBack: null });
                }}
                onConfirm={() => {
                    deleteTournament(deleteModal.id);
                    setDeleteModal({ show: false, id: null, snapBack: null });
                }}
            />

            {/* Ambient background orbs */}
            <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(99,102,241,0.14)" }} />
            <div className="absolute bottom-1/4 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(236,72,153,0.12)" }} />
            <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(255,109,0,0.08)" }} />

            {/* ── STICKY GLASS HEADER (Logo + Search + Tabs) ── */}
            <GlassHeader headerRef={hubHeaderRef}>

                {/* HEADER */}
                <header className="flex-none px-6 pt-12 pb-4 flex justify-between items-end relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                                style={{ background: "linear-gradient(135deg, #FFCA28, #F57C00)", boxShadow: "0 0 16px rgba(255,202,40,0.4)" }}>
                                <Trophy size={14} className="text-[#030712]" strokeWidth={3} />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight text-white" style={{ textShadow: "0 0 30px rgba(99,102,241,0.5)" }}>
                                PICK<span style={{ color: "#FFCA28" }}>PRO</span>
                            </h1>
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-[0.25em]" style={{ color: "rgba(255,202,40,0.6)" }}>
                            Tournament Edition
                        </p>
                    </div>

                    <LiquidButton
                        onClick={() => { triggerHaptic(100); setIsAdmin(!isAdmin); }}
                        variant={isAdmin ? "primary" : "ghost"}
                        style={isAdmin
                            ? {
                                width: 36,
                                height: 36,
                                padding: 0,
                                borderRadius: "0.75rem",
                                minWidth: 0,
                                background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                border: "1px solid rgba(255,202,40,0.62)",
                                boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                color: "#fff8e1",
                            }
                            : {
                                width: 36,
                                height: 36,
                                padding: 0,
                                borderRadius: "0.75rem",
                                minWidth: 0
                            }}
                    >
                        {isAdmin ? <Unlock size={14} /> : <Lock size={14} />}
                    </LiquidButton>
                </header>

                {/* CREATE FORM */}
                <div className="px-4 pb-2 relative z-10">
                    <form onSubmit={createTournament} className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 rounded-2xl blur opacity-0 group-focus-within:opacity-60 transition duration-500"></div>
                        <div className="relative flex items-center gap-2 px-4 py-2 rounded-2xl overflow-hidden transition-all duration-300"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

                            <Plus size={14} className="text-white/20 flex-none" />
                            <input
                                type="text"
                                value={newTourneyName}
                                onChange={(e) => setNewTourneyName(e.target.value)}
                                placeholder="NEW EVENT..."
                                className="flex-1 bg-transparent text-sm font-bold text-white placeholder-white/15 outline-none uppercase tracking-wider"
                                style={{ caretColor: "#FFCA28" }}
                            />

                            {newTourneyName.trim() && (
                                <LiquidButton type="submit" variant="primary"
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "0.75rem",
                                        padding: 0,
                                        flexShrink: 0,
                                        background: "linear-gradient(145deg, rgba(255,202,40,0.38), rgba(245,124,0,0.34))",
                                        border: "1px solid rgba(255,202,40,0.62)",
                                        boxShadow: "0 0 22px rgba(255,202,40,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                                        color: "#fff8e1",
                                    }}>
                                    <Plus size={18} strokeWidth={3} />
                                </LiquidButton>
                            )}
                        </div>
                    </form>
                </div>

                {/* TAB SWITCHER */}
                <div className="px-4 pb-4 relative z-10">
                    <LiquidTabBar
                        tabs={[
                            { id: "events", label: "Tour History" },
                            { id: "rankings", label: "Rankings", icon: <TrendingUp size={12} /> },
                        ]}
                        activeTab={hubTab}
                        onChange={(id) => { triggerHaptic(20); setHubTab(id); }}
                        style={{ maxWidth: 320, margin: "0 auto" }}
                    />
                </div>

                {hubTab === "events" && (
                    <div className="px-4 pb-4 relative z-10">
                        <div
                            className="relative rounded-2xl px-3 py-2.5 overflow-hidden"
                            style={{
                                background: "linear-gradient(135deg, rgba(10,16,32,0.94), rgba(2,9,23,0.95) 56%, rgba(16,13,6,0.9))",
                                border: "1px solid rgba(120,132,156,0.2)",
                                boxShadow: "0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
                                backdropFilter: "blur(14px)",
                            }}
                        >
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,202,40,0.15),transparent_40%)]" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(148,163,184,0.12),transparent_44%)]" />
                            </div>

                            <div className="relative z-10 flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,232,240,0.68)" }}>
                                    Tour History
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.13em]"
                                        style={{
                                            background: "rgba(255,109,0,0.14)",
                                            border: "1px solid rgba(255,109,0,0.25)",
                                            color: "#FFB36B",
                                        }}
                                    >
                                        Events {sortedTournaments.length}
                                    </span>
                                    {isAdmin && sortedTournaments.length > 0 && (
                                        <span
                                            className="hidden sm:inline-flex px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.12em]"
                                            style={{
                                                background: "rgba(15,23,42,0.6)",
                                                border: "1px solid rgba(120,132,156,0.28)",
                                                color: "rgba(191,207,227,0.7)",
                                            }}
                                        >
                                            Swipe To Delete
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="relative z-10 mt-2 grid grid-cols-3 gap-1.5">
                                <span
                                    className="px-2 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-[0.12em] text-center"
                                    style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", color: "rgba(110,231,183,0.95)" }}
                                >
                                    Live {activeEventsCount}
                                </span>
                                <span
                                    className="px-2 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-[0.12em] text-center"
                                    style={{ background: "rgba(255,109,0,0.14)", border: "1px solid rgba(255,109,0,0.28)", color: "rgba(255,188,120,0.95)" }}
                                >
                                    Draft {draftEventsCount}
                                </span>
                                <span
                                    className="px-2 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-[0.12em] text-center"
                                    style={{ background: "rgba(255,202,40,0.14)", border: "1px solid rgba(255,202,40,0.28)", color: "rgba(255,238,170,0.95)" }}
                                >
                                    Done {doneEventsCount}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

            </GlassHeader>

            {/* MAIN CONTENT */}
            <main
                className={`flex-1 min-h-0 px-3 relative z-10 ${hubTab === "events" ? "overflow-y-auto" : "overflow-hidden"}`}
                style={{
                    paddingTop: `${Math.max(0, hubHeaderHeight) + 12}px`,
                    scrollbarWidth: "none",
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                }}
            >
                <AnimatePresence mode="wait">
                    {hubTab === "events" ? (
                        <motion.div
                            key="events"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="pt-3 pb-10 space-y-1.5"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                                <AnimatePresence initial={false} mode="popLayout">
                                    {sortedTournaments.map((t) => (
                                        <TournamentCardItem
                                            key={t.id}
                                            t={t}
                                            isAdmin={isAdmin}
                                            triggerHaptic={triggerHaptic}
                                            setActiveTournamentId={setActiveTournamentId}
                                            setDeleteModal={setDeleteModal}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>

                            {sortedTournaments.length === 0 && (
                                <div className="py-20 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                        <Trophy size={24} style={{ color: "rgba(255,255,255,0.2)" }} />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                        No Events Yet
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="rankings"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="h-full min-h-0 flex flex-col gap-3 overflow-hidden pb-3"
                        >
                            {leaderboard.length > 0 ? (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="relative rounded-[2rem] overflow-hidden p-4 shrink-0"
                                        style={{
                                            background: "linear-gradient(145deg, rgba(8,10,18,0.96), rgba(12,18,34,0.94) 56%, rgba(8,16,34,0.92))",
                                            border: "1px solid rgba(255,202,40,0.3)",
                                            boxShadow: "0 20px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -16px 24px rgba(2,6,23,0.36)",
                                        }}
                                    >
                                        <div className="absolute inset-0 pointer-events-none">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,rgba(255,202,40,0.22),transparent_38%)]" />
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_95%_100%,rgba(148,163,184,0.12),transparent_40%)]" />
                                            <div className="absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.6)_0px,rgba(255,255,255,0.6)_1px,transparent_1px,transparent_14px)]" />
                                        </div>

                                        {topThree[0] && (
                                            <div
                                                className="relative z-10 rounded-2xl px-4 py-3.5"
                                                style={{
                                                    background: "linear-gradient(120deg, rgba(255,202,40,0.2), rgba(15,23,42,0.9) 52%, rgba(2,6,23,0.94))",
                                                    border: "1px solid rgba(255,202,40,0.38)",
                                                    boxShadow: "0 12px 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                                                }}
                                            >
                                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/75 to-transparent" />
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        <PlayerAvatar
                                                            name={topThree[0].name}
                                                            label={getMonogram(topThree[0].name, 2)}
                                                            className="w-12 h-12 text-sm ring-2 ring-amber-300/45"
                                                        />
                                                        <span
                                                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                                                            style={{
                                                                background: "linear-gradient(145deg, rgba(255,202,40,0.96), rgba(245,124,0,0.92))",
                                                                border: "1px solid rgba(255,232,173,0.78)",
                                                                color: "#1f2937",
                                                            }}
                                                        >
                                                            1
                                                        </span>
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-200/90">Pole Position</div>
                                                        <div className="text-[15px] font-black uppercase tracking-[0.05em] text-white truncate">{topThree[0].name}</div>
                                                        <div className="mt-1.5 flex items-center gap-1.5">
                                                            <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.12em]"
                                                                style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.28)", color: "rgba(226,232,240,0.88)" }}>
                                                                WR {toWinRatePct(topThree[0])}%
                                                            </span>
                                                            <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.12em]"
                                                                style={{ background: "rgba(245,124,0,0.26)", border: "1px solid rgba(255,202,40,0.38)", color: "rgba(255,243,205,0.95)" }}>
                                                                Rating {toRatingStr(topThree[0])}
                                                            </span>
                                                            <span className="text-[8px] font-black uppercase tracking-[0.1em] text-white/55 tabular-nums">
                                                                {toNumber(topThree[0].w)}-{toNumber(topThree[0].l)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {topThree.length > 1 && (
                                            <div className="relative z-10 mt-2 grid grid-cols-2 gap-2">
                                                {topThree.slice(1).map((player, idx) => {
                                                    const accent = idx === 0
                                                        ? {
                                                            bg: "linear-gradient(125deg, rgba(148,163,184,0.2), rgba(15,23,42,0.86))",
                                                            border: "1px solid rgba(148,163,184,0.4)",
                                                            rankBg: "rgba(148,163,184,0.92)",
                                                            rankColor: "#0f172a",
                                                        }
                                                        : {
                                                            bg: "linear-gradient(125deg, rgba(251,146,60,0.22), rgba(15,23,42,0.86))",
                                                            border: "1px solid rgba(251,146,60,0.4)",
                                                            rankBg: "rgba(251,146,60,0.92)",
                                                            rankColor: "#111827",
                                                        };
                                                    return (
                                                        <div
                                                            key={player.name}
                                                            className="rounded-2xl px-3 py-2.5"
                                                            style={{
                                                                background: accent.bg,
                                                                border: accent.border,
                                                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <PlayerAvatar name={player.name} label={getMonogram(player.name, 2)} className="w-9 h-9 text-[10px]" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-[10px] font-black uppercase tracking-[0.09em] text-white truncate">{player.name}</div>
                                                                    <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/55 tabular-nums">
                                                                        WR {toWinRatePct(player)}% · {toRatingStr(player)}
                                                                    </div>
                                                                </div>
                                                                <span
                                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                                                                    style={{ background: accent.rankBg, color: accent.rankColor }}
                                                                >
                                                                    {idx + 2}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.04 }}
                                        className="relative rounded-[2rem] overflow-hidden flex-1 min-h-0 flex flex-col"
                                        style={{
                                            background: "linear-gradient(158deg, rgba(7,11,22,0.92), rgba(2,8,20,0.98) 58%, rgba(8,14,30,0.92))",
                                            border: "1px solid rgba(120,132,156,0.24)",
                                            boxShadow: "0 18px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        <div className="absolute inset-0 pointer-events-none">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(255,202,40,0.12),transparent_42%)]" />
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_92%_100%,rgba(148,163,184,0.1),transparent_42%)]" />
                                        </div>

                                        <div
                                            className="sticky top-0 z-20 px-4 py-3.5"
                                            style={{
                                                borderBottom: "1px solid rgba(120,132,156,0.2)",
                                                background: "linear-gradient(92deg, rgba(255,202,40,0.13), rgba(15,23,42,0.92) 48%, rgba(148,163,184,0.12))",
                                                backdropFilter: "blur(12px)",
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em]"
                                                    style={{ color: "rgba(255,243,205,0.92)" }}
                                                >
                                                    <TrendingUp size={11} />
                                                    Global Rankings
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.13em]"
                                                        style={{
                                                            background: "rgba(15,23,42,0.62)",
                                                            border: "1px solid rgba(120,132,156,0.3)",
                                                            color: "rgba(226,232,240,0.9)",
                                                        }}
                                                    >
                                                        Players {leaderboard.length}
                                                    </span>
                                                    <span
                                                        className="hidden sm:inline-flex px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.13em]"
                                                        style={{
                                                            background: "rgba(255,202,40,0.16)",
                                                            border: "1px solid rgba(255,202,40,0.32)",
                                                            color: "rgba(255,243,205,0.94)",
                                                        }}
                                                    >
                                                        Avg WR {leaderboardAverageWinRate}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div
                                                className={`mt-3 grid ${rankingColumnLayout} gap-2 items-center text-[8px] font-black uppercase tracking-[0.16em]`}
                                                style={{ color: "rgba(191,207,227,0.55)" }}
                                            >
                                                <span className="text-center">#</span>
                                                <span>Player</span>
                                                <span className="text-center">WR</span>
                                                <span className="text-center">Rating</span>
                                            </div>
                                        </div>

                                        <div
                                            className="relative z-10 px-3 pb-3 flex-1 min-h-0 overflow-y-auto"
                                            style={{
                                                scrollbarWidth: "none",
                                                WebkitOverflowScrolling: "touch",
                                                touchAction: "pan-y",
                                            }}
                                        >
                                            {remainingLeaderboard.length > 0 ? remainingLeaderboard.map((player, offsetIdx) => {
                                                const rankIdx = offsetIdx + 3;
                                                const wins = toNumber(player.w);
                                                const losses = toNumber(player.l);
                                                const played = wins + losses;
                                                const winRatePct = toWinRatePct(player);
                                                const rating = toRatingStr(player);

                                                return (
                                                    <motion.div
                                                        key={player.name}
                                                        layout
                                                        initial={{ opacity: 0, y: 6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: offsetIdx * 0.015 }}
                                                        className="relative rounded-2xl mt-2 overflow-hidden"
                                                        style={{
                                                            border: "1px solid rgba(100,116,139,0.3)",
                                                            background: "linear-gradient(116deg, rgba(15,23,42,0.7), rgba(2,6,23,0.84) 56%, rgba(15,23,42,0.72))",
                                                            boxShadow: "0 10px 22px rgba(2,6,23,0.34), inset 0 1px 0 rgba(255,255,255,0.08)",
                                                        }}
                                                    >
                                                        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: "linear-gradient(180deg, rgba(255,202,40,0.9), rgba(245,124,0,0.68))" }} />
                                                        <div
                                                            className="absolute inset-y-0 left-0 pointer-events-none"
                                                            style={{ width: `${winRatePct}%`, background: "linear-gradient(90deg, rgba(255,202,40,0.1), rgba(255,202,40,0.02))" }}
                                                        />

                                                        <div className={`relative z-10 px-3 py-3 grid ${rankingColumnLayout} gap-2 items-center`}>
                                                            <div className="flex justify-center">
                                                                <span
                                                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black tabular-nums"
                                                                    style={{
                                                                        background: "rgba(30,41,59,0.74)",
                                                                        border: "1px solid rgba(100,116,139,0.32)",
                                                                        color: "rgba(203,213,225,0.9)",
                                                                    }}
                                                                >
                                                                    {rankIdx + 1}
                                                                </span>
                                                            </div>

                                                            <div className="min-w-0 flex items-center gap-2">
                                                                <PlayerAvatar
                                                                    name={player.name}
                                                                    label={getMonogram(player.name, 2)}
                                                                    className="w-7 h-7 text-[10px] ring-2 ring-white/12"
                                                                />
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.08em] text-white truncate">
                                                                        {player.name}
                                                                    </div>
                                                                    <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/42 tabular-nums">
                                                                        {wins}-{losses} · {played}G
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <span className="text-center text-[11px] font-black tabular-nums text-cyan-300">
                                                                {winRatePct}%
                                                            </span>
                                                            <span className="text-center text-[11px] font-black tabular-nums text-amber-100">
                                                                {rating}
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                );
                                            }) : (
                                                <div className="py-12 text-center">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                                                        Top 3 Displayed In HUD
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className="px-4 py-2 text-[8px] font-bold uppercase tracking-[0.14em]"
                                            style={{ color: "rgba(148,163,184,0.64)", borderTop: "1px solid rgba(120,132,156,0.18)" }}
                                        >
                                            Total Recorded Games {leaderboardTotalGames}
                                        </div>
                                    </motion.div>
                                </>
                            ) : (
                                <div className="py-20 text-center">
                                    <div
                                        className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                                        style={{
                                            background: "linear-gradient(145deg, rgba(15,23,42,0.72), rgba(2,6,23,0.86))",
                                            border: "1px solid rgba(100,116,139,0.3)",
                                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 12px 26px rgba(0,0,0,0.35)",
                                        }}
                                    >
                                        <Medal size={24} style={{ color: "rgba(148,163,184,0.6)" }} />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.5)" }}>
                                        Global Rankings Coming Soon
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Bottom gradient fade */}
            <div className="absolute bottom-0 inset-x-0 h-20 pointer-events-none z-20"
                style={{ background: "linear-gradient(to top, #030712 0%, transparent 100%)" }} />
        </div>
    );
}

// ─── Liquid Glass card sub-component ───────────────────────────────────────
function TournamentCardItem({ t, isAdmin, triggerHaptic, setActiveTournamentId, setDeleteModal }) {
    const x = useMotionValue(0);
    const wasDragged = React.useRef(false);
    const dragTimeout = React.useRef(null);
    const hardSwiped = React.useRef(false);   // track whether we've already triggered hard-swipe

    // Liquid ripple state
    const [cardRipples, setCardRipples] = React.useState([]);
    const [delRipples, setDelRipples] = React.useState([]);
    const [pressSweepId, setPressSweepId] = React.useState(0);

    const spawnRipple = (e, setter) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.2;
        const id = Date.now() + Math.random();
        setter(prev => [...prev, {
            id,
            x: e.clientX - rect.left - size / 2,
            y: e.clientY - rect.top - size / 2,
            size,
        }]);
        setTimeout(() => setter(prev => prev.filter(r => r.id !== id)), 700);
    };

    // ─── Delete zone motion transforms ───────────────────────────────────────
    // Phase 1: 0 → -88  →  pill fades in (existing feel)
    // Phase 2: -88 → -340  →  zone expands, turns full red, icon grows
    const PILL_END = -60;   // snap-open position = button width + tiny gap
    const HARD_SNAP = -140;  // threshold for hard-swipe delete
    const FULL_W = -340;  // zone fully expanded

    // Delete button opacity: fades in during phase 1
    const deleteOpacity = useTransform(x, [PILL_END, -28, 0], [1, 1, 0]);
    // Delete zone width: small pill (56px) → full card width (340px)
    const deleteWidth = useTransform(x, [FULL_W, PILL_END], [340, 56]);
    // Delete zone red intensity: dim → vivid as user swipes past pill
    const deleteRed = useTransform(x, [FULL_W, PILL_END], ["rgba(220,30,10,0.85)", "rgba(255,61,0,0.28)"]);
    // Trash icon scale: grows during expansion
    const trashScale = useTransform(x, [FULL_W, PILL_END], [1.45, 1]);
    // Border becomes vivid red
    const deleteBorder = useTransform(x, [FULL_W, PILL_END], ["rgba(255,100,60,0.7)", "rgba(255,61,0,0.45)"]);

    const snapBack = () => animate(x, 0, { type: "spring", stiffness: 450, damping: 38 });
    const snapOff = () => animate(x, -420, { type: "spring", stiffness: 500, damping: 45, mass: 0.8 });

    const playersPreview = Array.isArray(t.playersPreview) ? t.playersPreview : [];
    const playerCount = Number.isFinite(t.playerCount) ? Number(t.playerCount) : playersPreview.length;

    const isWinner = !!t.winner;
    const isActive = t.status === "active";
    const isDraft = t.status === "draft";

    // ─── per-state colour tokens (Firebase palette) ──────────────────────
    // Firebase orange: #FF6D00 / active emerald / winner gold
    const accentColor = isWinner ? "#FFCA28" : isActive ? "#34d399" : "#FF6D00";
    const accentRgb = isWinner ? "255,202,40" : isActive ? "52,211,153" : "255,109,0";
    const cardBg = "linear-gradient(132deg, rgba(8,12,26,0.94), rgba(9,18,38,0.93) 58%, rgba(15,23,42,0.92) 100%)";
    const cardBorder = "1px solid rgba(148,163,184,0.24)";
    const cardShadow = "0 8px 16px rgba(2,6,23,0.26), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 18px rgba(2,6,23,0.22)";
    const cardHoverShadow = `0 12px 24px rgba(2,6,23,0.34), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -10px 18px rgba(2,6,23,0.24), 0 0 0 1px rgba(${accentRgb},0.16)`;

    // ─── Icon for the status chip ────────────────────────────────────────
    const StatusIcon = () => isWinner
        ? <Crown size={13} className="text-amber-300" />
        : isActive
            ? <Zap size={13} className="text-emerald-400" />
            : isDraft
                ? <LayoutGrid size={13} style={{ color: "#FF6D00" }} />
                : <Trophy size={13} style={{ color: "#FF6D00" }} />;

    const statusLabel = isActive ? "Live" : isDraft ? "Draft" : "Done";
    const formatLabel = formatEventType(t.format);
    const pointsLabel = `TO ${Math.max(1, toNumber(t.pointsToWin, 11))}`;
    const eventDate = formatEventDate(t.createdAt);
    const eventAge = formatEventAge(t.createdAt);

    return (
        /* Outer li: opacity only — NO overflow:hidden so shadows can breathe */
        <motion.li
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
            style={{ listStyle: "none" }}
        >
            {/* Inner div: height collapse for smooth list reflow */}
            <motion.div
                initial={{ height: "auto" }}
                animate={{ height: "auto" }}
                exit={{
                    height: 0,
                    marginBottom: 0,
                    transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] }
                }}
                style={{ overflow: "hidden" }}
            >
                <div className="relative py-1">

                    {/* ── iOS-STYLE EXPANDING DELETE ZONE ── */}
                    {isAdmin && (
                        <div className="absolute inset-y-1 right-0 flex items-center pointer-events-none">
                            <motion.button
                                style={{
                                    opacity: deleteOpacity,
                                    width: deleteWidth,
                                    pointerEvents: "auto",
                                    background: deleteRed,
                                    border: `1px solid`,
                                    borderColor: deleteBorder,
                                    backdropFilter: "blur(18px) saturate(180%)",
                                    boxShadow: "inset 0 1px 0 rgba(255,160,120,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)",
                                }}
                                onClick={(e) => {
                                    spawnRipple(e, setDelRipples);
                                    e.stopPropagation();
                                    triggerHaptic(60);
                                    setDeleteModal({ show: true, id: t.id, snapBack });
                                }}
                                className="neo-btn neo-btn-danger h-[calc(100%-8px)] rounded-2xl flex items-center justify-center relative overflow-hidden"
                            >
                                {/* inner sheen */}
                                <div className="absolute inset-x-0 top-0 h-[40%] rounded-t-2xl"
                                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)" }} />
                                <motion.div style={{ scale: trashScale }} className="relative z-10">
                                    <Trash2 size={17} strokeWidth={2.5} style={{ color: "#FF9070" }} />
                                </motion.div>
                                {/* Liquid ripples */}
                                {delRipples.map(r => (
                                    <span key={r.id} className="liquid-ripple-red"
                                        style={{ left: r.x, top: r.y, width: r.size, height: r.size }} />
                                ))}
                            </motion.button>
                        </div>
                    )}

                    {/* ── FROSTED GLASS DRAGGABLE CARD ─────────────────── */}
                    <motion.div
                        drag={isAdmin ? "x" : false}
                        dragConstraints={{ left: -360, right: 0 }}
                        dragElastic={{ left: 0.08, right: 0 }}
                        dragMomentum={false}
                        onDragStart={() => {
                            wasDragged.current = true;
                            hardSwiped.current = false;
                            if (dragTimeout.current) clearTimeout(dragTimeout.current);
                            triggerHaptic(20);
                        }}
                        onDrag={(_, info) => {
                            // Haptic "click" as card crosses the hard-swipe threshold
                            if (!hardSwiped.current && x.get() < HARD_SNAP) {
                                hardSwiped.current = true;
                                triggerHaptic(80);
                            } else if (hardSwiped.current && x.get() > HARD_SNAP) {
                                hardSwiped.current = false; // crossed back
                            }
                        }}
                        onDragEnd={() => {
                            dragTimeout.current = setTimeout(() => { wasDragged.current = false; }, 150);
                            const cur = x.get();
                            if (cur < HARD_SNAP) {
                                snapOff();
                                triggerHaptic(100);
                                setDeleteModal({ show: true, id: t.id, snapBack });
                            } else if (cur < -28) {
                                // Partial swipe past reveal → stay open
                                animate(x, PILL_END, { type: "spring", stiffness: 450, damping: 38 });
                            } else {
                                snapBack();
                            }
                        }}
                        whileHover={{ y: -1.5, boxShadow: cardHoverShadow, borderColor: "rgba(148,163,184,0.34)" }}
                        whileTap={{ scale: 0.976 }}
                        onTapStart={() => setPressSweepId((prev) => prev + 1)}
                        onClick={(e) => {
                            if (!wasDragged.current) {
                                spawnRipple(e, setCardRipples);
                                triggerHaptic(40);
                                setActiveTournamentId(t.id);
                            }
                        }}
                        className="relative grid grid-cols-[44px_minmax(0,1fr)_96px] sm:grid-cols-[44px_minmax(0,1fr)_106px] items-stretch gap-2.5 sm:gap-3 px-4 py-3 rounded-[1.85rem] cursor-pointer overflow-hidden h-[108px]"
                        style={{
                            x,
                            zIndex: 2,
                            background: cardBg,
                            border: cardBorder,
                            backdropFilter: "blur(26px) saturate(190%) brightness(1.06)",
                            WebkitBackdropFilter: "blur(26px) saturate(190%) brightness(1.06)",
                            boxShadow: cardShadow,
                        }}
                    >
                        <div className="absolute inset-0 pointer-events-none z-0">
                            <div className="absolute -left-12 -top-10 w-40 h-24 rounded-full blur-2xl" style={{ background: `rgba(${accentRgb},0.09)` }} />
                            <div className="absolute -right-12 -bottom-14 w-40 h-24 rounded-full blur-2xl" style={{ background: "rgba(59,130,246,0.09)" }} />
                        </div>

                        {/* ─ Liquid ripples (card click) ─ */}
                        {cardRipples.map(r => (
                            <span key={r.id} className="liquid-ripple z-20"
                                style={{ left: r.x, top: r.y, width: r.size, height: r.size }} />
                        ))}

                        {pressSweepId > 0 && (
                            <motion.span
                                key={pressSweepId}
                                className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none z-20"
                                initial={{ x: "-130%", opacity: 0 }}
                                animate={{ x: "430%", opacity: [0, 0.55, 0] }}
                                transition={{ duration: 0.36, ease: "easeOut" }}
                                style={{
                                    background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                                    filter: "blur(2px)",
                                }}
                            />
                        )}

                        {/* ─ Top-edge refraction highlight ─ */}
                        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl pointer-events-none z-10"
                            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(226,232,240,0.24) 52%, transparent 100%)" }} />

                        <div className="absolute inset-x-0 top-0 h-9 rounded-t-2xl pointer-events-none z-0"
                            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, transparent 100%)" }} />

                        {/* ─ Status icon pod ─ */}
                        <div className="w-11 h-11 rounded-[14px] flex items-center justify-center relative overflow-hidden z-10 self-center justify-self-center"
                            style={{
                                background: isWinner
                                    ? "linear-gradient(145deg, rgba(255,202,40,0.18), rgba(245,124,0,0.1))"
                                    : isActive
                                        ? "linear-gradient(145deg, rgba(52,211,153,0.18), rgba(16,185,129,0.1))"
                                        : "linear-gradient(145deg, rgba(255,109,0,0.18), rgba(251,146,60,0.1))",
                                border: `1px solid rgba(${accentRgb},0.34)`,
                                backdropFilter: "blur(10px)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 16px rgba(2,6,23,0.35)",
                            }}
                        >
                            <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
                                style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 100%)" }} />
                            <StatusIcon />
                        </div>

                        {/* ─ Main text content ─ */}
                        <div className="min-w-0 z-10 h-full flex flex-col justify-between py-[1px]">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className={`font-black text-[14px] tracking-[0.06em] uppercase leading-snug truncate ${isWinner ? "text-amber-200" : "text-white"}`}>
                                    {t.name}
                                </h3>
                            </div>

                            <div className="flex items-center gap-1 min-w-0 whitespace-nowrap overflow-hidden">
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest relative overflow-hidden"
                                    style={{
                                        background: `rgba(${accentRgb},0.12)`,
                                        border: `1px solid rgba(${accentRgb},0.22)`,
                                        color: accentColor,
                                        backdropFilter: "blur(8px)",
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                                    }}
                                >
                                    <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : ""}`}
                                        style={{ backgroundColor: isActive ? undefined : accentColor, opacity: 0.9 }} />
                                    {statusLabel}
                                </span>
                                <span
                                    className="min-w-0 max-w-[88px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider overflow-hidden"
                                    style={{
                                        background: "rgba(148,163,184,0.12)",
                                        border: "1px solid rgba(148,163,184,0.24)",
                                        color: "rgba(226,232,240,0.82)",
                                    }}
                                >
                                    <LayoutGrid size={8} />
                                    <span className="truncate">{formatLabel}</span>
                                </span>
                                <span
                                    className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider"
                                    style={{
                                        background: "rgba(255,202,40,0.12)",
                                        border: "1px solid rgba(255,202,40,0.26)",
                                        color: "rgba(255,236,170,0.9)",
                                    }}
                                >
                                    {pointsLabel}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 min-w-0 whitespace-nowrap overflow-hidden">
                                <span className="inline-flex items-center gap-1 text-[7px] font-bold uppercase tracking-[0.12em]"
                                    style={{ color: "rgba(191,207,227,0.5)" }}>
                                    <CalendarDays size={9} />
                                    {eventDate}
                                </span>
                                {eventAge && (
                                    <span
                                        className="text-[7px] font-black uppercase tracking-[0.11em] shrink-0"
                                        style={{ color: "rgba(148,163,184,0.55)" }}
                                    >
                                        {eventAge}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ─ Right rail (avatars + open cue) ─ */}
                        <div className="w-[96px] sm:w-[106px] h-full flex flex-col items-end justify-between py-[1px] z-10">
                            <div className="flex items-center justify-end gap-2 min-w-0">
                                <div className="flex -space-x-1.5">
                                    {playersPreview.slice(0, 3).map((p, i) => (
                                        <div key={i} className="rounded-full ring-2 ring-slate-950/60">
                                            <PlayerAvatar name={p} className="w-6 h-6 sm:w-7 sm:h-7 text-[8px] sm:text-[9px]" />
                                        </div>
                                    ))}
                                    {playerCount > 3 && (
                                        <span
                                            className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[8px] sm:text-[9px] font-black"
                                            style={{
                                                background: "rgba(15,23,42,0.82)",
                                                border: "1px solid rgba(148,163,184,0.28)",
                                                color: "rgba(226,232,240,0.86)",
                                            }}
                                        >
                                            +{playerCount - 3}
                                        </span>
                                    )}
                                    {playerCount === 0 && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full"
                                            style={{ background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.28)", color: "rgba(148,163,184,0.72)" }}>
                                            <Users size={9} />
                                        </span>
                                    )}
                                </div>
                                <ChevronRight size={14} style={{ color: "rgba(226,232,240,0.5)" }} />
                            </div>

                            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-right" style={{ color: "rgba(226,232,240,0.72)" }}>
                                {playerCount} Players
                            </span>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </motion.li>
    );
}
