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
    Star,
    Crown,
} from "lucide-react";
import { useHaptic } from "../../../hooks/useHaptic";
import PlayerAvatar from "../../common/PlayerAvatar";
import Modal from "../../common/Modal";
import LiquidButton from "../../common/LiquidButton";
import LiquidTabBar from "../../common/LiquidTabBar";

export default function TournamentHub({
    tournaments,
    activeTournamentId,
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

    const [deleteModal, setDeleteModal] = React.useState({
        show: false,
        id: null,
        snapBack: null,   // fn to animate card back if modal is cancelled
    });

    const sortedTournaments = Object.values(tournaments || {}).sort(
        (a, b) => b.createdAt - a.createdAt
    );

    return (
        <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative overflow-hidden"
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

            {/* HEADER — frosted glass */}
            <header className="flex-none px-6 pt-12 pb-4 flex justify-between items-end relative z-10"
                style={{
                    background: "linear-gradient(to bottom, rgba(3,7,18,0.95), rgba(3,7,18,0.6))",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                }}>
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
                    style={{ width: 36, height: 36, padding: 0, borderRadius: "0.75rem", minWidth: 0 }}
                >
                    {isAdmin ? <Unlock size={14} /> : <Lock size={14} />}
                </LiquidButton>
            </header>

            {/* CREATE FORM — compact single-line */}
            <div className="px-4 pb-2 relative z-10">
                <form onSubmit={createTournament} className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 rounded-2xl blur opacity-0 group-focus-within:opacity-60 transition duration-500"></div>
                    <div className="relative flex items-center gap-2 px-4 py-2 rounded-2xl overflow-hidden transition-all duration-300"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)" }}>

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
                                style={{ width: 36, height: 36, borderRadius: "0.75rem", padding: 0, flexShrink: 0 }}>
                                <Plus size={18} strokeWidth={3} />
                            </LiquidButton>
                        )}
                    </div>
                </form>
            </div>

            {/* TAB SWITCHER */}
            <div className="px-4 pb-3 relative z-10">
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

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto px-3 pb-8 relative z-10" style={{ scrollbarWidth: "none" }}>
                <AnimatePresence mode="wait">
                    {hubTab === "events" ? (
                        <motion.div
                            key="events"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="space-y-1.5"
                        >
                            {/* Section header with event count */}
                            <div className="flex items-center justify-between px-2 pb-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
                                    Events
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{
                                        background: "rgba(255,109,0,0.12)",
                                        border: "1px solid rgba(255,109,0,0.22)",
                                        color: "#FF6D00",
                                    }}>
                                    {sortedTournaments.length}
                                </span>
                            </div>
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
                            className="space-y-4"
                        >
                            {/* HERO PODIUM (1st Place) */}
                            {globalLeaderboard && globalLeaderboard.length > 0 ? (
                                <>
                                    {/* ── HERO #1 ── */}
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative mb-3">
                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-3xl blur-xl" />
                                        <div className="relative p-5 rounded-3xl overflow-hidden"
                                            style={{
                                                background: "rgba(255,255,255,0.03)",
                                                border: "1px solid rgba(255,202,40,0.25)",
                                                backdropFilter: "blur(24px)",
                                                boxShadow: "inset 0 1px 0 rgba(255,202,40,0.18), inset 0 -1px 0 rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.3)",
                                            }}>
                                            {/* Shimmer overlay */}
                                            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                                                <div className="absolute -inset-full"
                                                    style={{
                                                        background: "linear-gradient(105deg, transparent 40%, rgba(255,202,40,0.06) 45%, rgba(255,202,40,0.12) 50%, rgba(255,202,40,0.06) 55%, transparent 60%)",
                                                        animation: "shimmer 3s ease-in-out infinite",
                                                    }} />
                                            </div>

                                            <div className="flex items-center gap-5 relative z-10">
                                                <div className="relative">
                                                    {/* Animated glow ring */}
                                                    <div className="absolute -inset-1.5 rounded-full opacity-60"
                                                        style={{
                                                            background: "conic-gradient(from 0deg, #FFCA28, #F57C00, #FFCA28)",
                                                            animation: "spin 4s linear infinite",
                                                        }} />
                                                    <div className="absolute -inset-0.5 rounded-full bg-[#0f172a]" />
                                                    <PlayerAvatar name={globalLeaderboard[0].name} className="relative w-16 h-16 text-lg shadow-xl" />
                                                    <div className="absolute -bottom-2 -right-2 bg-amber-500 text-[#0f172a] w-7 h-7 flex items-center justify-center rounded-full font-black text-sm border-2 border-[#0f172a]">
                                                        1
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Current #1</div>
                                                    <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-2 truncate">
                                                        {globalLeaderboard[0].name}
                                                    </h2>
                                                    <div className="flex items-center gap-4">
                                                        <div>
                                                            <div className="text-[9px] text-white/40 font-bold uppercase">Rating</div>
                                                            <div className="text-xl font-bold text-amber-400 font-mono">{globalLeaderboard[0].rating}</div>
                                                        </div>
                                                        <div className="w-px h-8 bg-white/10" />
                                                        <div>
                                                            <div className="text-[9px] text-white/40 font-bold uppercase">Win Rate</div>
                                                            <div className="text-xl font-bold text-white font-mono">{Math.round(globalLeaderboard[0].winRate * 100)}%</div>
                                                        </div>
                                                        <div className="w-px h-8 bg-white/10" />
                                                        <div>
                                                            <div className="text-[9px] text-white/40 font-bold uppercase">Record</div>
                                                            <div className="text-sm font-bold text-white/60 font-mono">{globalLeaderboard[0].w}W - {globalLeaderboard[0].l}L</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* ── 2nd & 3rd — frosted glass podium ── */}
                                    {globalLeaderboard.length >= 2 && (
                                        <div className="grid grid-cols-2 gap-2 mb-4">
                                            {globalLeaderboard.slice(1, 3).map((p, i) => (
                                                <motion.div key={p.name}
                                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + (i * 0.1) }}
                                                    className="relative overflow-hidden rounded-2xl"
                                                    style={{
                                                        background: "rgba(255,255,255,0.03)",
                                                        border: `1px solid ${i === 0 ? "rgba(226,232,240,0.18)" : "rgba(180,83,9,0.18)"}`,
                                                        backdropFilter: "blur(24px)",
                                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.2)",
                                                        marginTop: i === 0 ? "-4px" : "8px",  /* podium offset */
                                                    }}
                                                >
                                                    <div className="p-4 flex flex-col items-center text-center">
                                                        <div className="relative mb-3">
                                                            <PlayerAvatar name={p.name} className="w-12 h-12 text-sm ring-2 ring-white/10" />
                                                            <div className="absolute -bottom-2 -right-1 w-6 h-6 flex items-center justify-center rounded-full font-black text-xs border-2 border-[#0f172a]"
                                                                style={{
                                                                    background: i === 0 ? "#E2E8F0" : "#B45309",
                                                                    color: i === 0 ? "#0f172a" : "#FFF"
                                                                }}>
                                                                {i + 2}
                                                            </div>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate w-full mb-0.5">{p.name}</h3>
                                                        <div className="text-lg font-mono font-bold text-white/80 mb-0.5">{p.rating}</div>
                                                        <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                                                            {Math.round(p.winRate * 100)}% · {p.w}W-{p.l}L
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── List (4th+) ── */}
                                    {globalLeaderboard.length > 3 && (
                                        <div className="space-y-0.5 pb-24">
                                            {/* Section header */}
                                            <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
                                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
                                                    Global Rankings
                                                </span>
                                                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                    style={{
                                                        background: "rgba(255,255,255,0.06)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        color: "rgba(255,255,255,0.3)",
                                                    }}>
                                                    {globalLeaderboard.length - 3}
                                                </span>
                                            </div>
                                            {globalLeaderboard.slice(3).map((p, i) => (
                                                <motion.div key={p.name}
                                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + (i * 0.04) }}
                                                    className="flex items-center p-3 rounded-xl relative overflow-hidden"
                                                    style={{
                                                        background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                                                        border: "1px solid rgba(255,255,255,0.04)",
                                                    }}
                                                >
                                                    {/* Win rate progress bar (background) */}
                                                    <div className="absolute inset-y-0 left-0 rounded-xl pointer-events-none"
                                                        style={{
                                                            width: `${Math.round(p.winRate * 100)}%`,
                                                            background: "linear-gradient(90deg, rgba(255,202,40,0.04) 0%, rgba(255,109,0,0.02) 100%)",
                                                        }} />

                                                    <div className="w-7 text-center font-mono font-bold text-white/30 text-xs relative z-10">{i + 4}</div>
                                                    <div className="relative z-10">
                                                        <PlayerAvatar name={p.name} className="w-8 h-8 text-[10px] mr-3 ring-2 ring-white/10" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 relative z-10">
                                                        <div className="font-bold text-xs text-white uppercase tracking-wide truncate">{p.name}</div>
                                                        <div className="text-[10px] text-white/30 font-mono">{p.w}W - {p.l}L · {Math.round(p.winRate * 100)}%</div>
                                                    </div>
                                                    <div className="font-mono font-bold text-sm text-white/70 relative z-10">{p.rating}</div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="py-20 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                        <Medal size={24} style={{ color: "rgba(255,255,255,0.2)" }} />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
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

    const players = t.players || t.draftPlayers || [];
    const isWinner = !!t.winner;
    const isActive = t.status === "active";
    const isDraft = t.status === "draft";

    // ─── per-state colour tokens (Firebase palette) ──────────────────────
    // Firebase orange: #FF6D00 / active emerald / winner gold
    const accentColor = isWinner ? "#FFCA28" : isActive ? "#34d399" : "#FF6D00";
    const accentRgb = isWinner ? "255,202,40" : isActive ? "52,211,153" : "255,109,0";
    const cardBg = isWinner
        ? `rgba(255,202,40,0.06)`
        : isActive
            ? `rgba(52,211,153,0.05)`
            : `rgba(255,109,0,0.05)`;
    const cardBorder = isWinner
        ? `1px solid rgba(255,202,40,0.22)`
        : isActive
            ? `1px solid rgba(52,211,153,0.18)`
            : `1px solid rgba(255,109,0,0.18)`;
    // Only inset shadows to avoid clipping issues
    const cardShadow = isWinner
        ? `inset 0 1px 0 rgba(255,202,40,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)`
        : isActive
            ? `inset 0 1px 0 rgba(52,211,153,0.15), inset 0 -1px 0 rgba(0,0,0,0.25)`
            : `inset 0 1px 0 rgba(255,109,0,0.12), inset 0 -1px 0 rgba(0,0,0,0.25)`;

    // ─── Icon for the status chip ────────────────────────────────────────
    const StatusIcon = () => isWinner
        ? <Crown size={13} className="text-amber-300" />
        : isActive
            ? <Zap size={13} className="text-emerald-400" />
            : isDraft
                ? <LayoutGrid size={13} style={{ color: "#FF6D00" }} />
                : <Trophy size={13} style={{ color: "#FF6D00" }} />;

    const statusLabel = isActive ? "Live" : isDraft ? "Draft" : "Done";

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
                                className="h-[calc(100%-8px)] rounded-2xl flex items-center justify-center relative overflow-hidden"
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
                        whileTap={!isAdmin ? { scale: 0.985 } : undefined}
                        onClick={(e) => {
                            if (!wasDragged.current) {
                                spawnRipple(e, setCardRipples);
                                triggerHaptic(40);
                                setActiveTournamentId(t.id);
                            }
                        }}
                        className="relative flex items-center gap-3.5 px-4 py-3.5 rounded-3xl cursor-pointer overflow-hidden"
                        style={{
                            x,
                            zIndex: 2,
                            minHeight: 76,
                            background: cardBg,
                            border: cardBorder,
                            backdropFilter: "blur(28px) saturate(200%) brightness(1.08)",
                            WebkitBackdropFilter: "blur(28px) saturate(200%) brightness(1.08)",
                            boxShadow: cardShadow,
                        }}
                    >
                        {/* ─ Noise texture overlay for tactile glass feel ─ */}
                        <div className="absolute inset-0 rounded-2xl pointer-events-none z-0"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                                backgroundSize: "180px 180px",
                                opacity: 0.028,
                                mixBlendMode: "overlay",
                            }}
                        />

                        {/* ─ Liquid ripples (card click) ─ */}
                        {cardRipples.map(r => (
                            <span key={r.id} className="liquid-ripple z-20"
                                style={{ left: r.x, top: r.y, width: r.size, height: r.size }} />
                        ))}

                        {/* ─ Top-edge refraction highlight ─ */}
                        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl pointer-events-none z-10"
                            style={{ background: `linear-gradient(90deg, transparent 0%, rgba(${accentRgb},0.5) 40%, rgba(255,255,255,0.4) 60%, transparent 100%)` }} />

                        {/* ─ Inner top sheen (glass thickness illusion) ─ */}
                        <div className="absolute inset-x-0 top-0 h-8 rounded-t-2xl pointer-events-none z-0"
                            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)" }} />

                        {/* ─ Winner left-accent bar ─ */}
                        {isWinner && (
                            <div className="absolute left-0 inset-y-3 w-[3px] rounded-full z-10"
                                style={{ background: `linear-gradient(180deg, ${accentColor} 0%, rgba(255,202,40,0) 100%)` }} />
                        )}

                        {/* ─ Status icon chip (liquid glass) ─ */}
                        <div className="flex-none w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden z-10"
                            style={{
                                background: isWinner
                                    ? "rgba(255,202,40,0.10)"
                                    : isActive
                                        ? "rgba(52,211,153,0.10)"
                                        : "rgba(255,109,0,0.10)",
                                border: `1px solid rgba(${accentRgb},0.22)`,
                                backdropFilter: "blur(12px)",
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.2)`,
                            }}
                        >
                            {/* chip inner sheen */}
                            <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
                                style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.12) 0%,transparent 100%)" }} />
                            <StatusIcon />
                        </div>

                        {/* ─ Main text content ─ */}
                        <div className="flex-1 min-w-0 z-10">
                            <h3 className={`font-bold text-[13px] tracking-widest uppercase leading-snug truncate mb-1 ${isWinner ? "text-amber-200" : "text-white"}`}>
                                {t.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                {/* Glass status badge */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest relative overflow-hidden"
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
                                <span className="text-[8px] text-white/15 font-bold uppercase tracking-wider tabular-nums">
                                    {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                                {isWinner && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300/70 truncate max-w-[80px]">
                                        <Crown size={8} className="text-amber-400 flex-none" />
                                        {t.winner}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ─ Player avatars ─ */}
                        <div className="flex-none flex items-center z-10">
                            <div className="flex -space-x-2">
                                {players.slice(0, 4).map((p, i) => (
                                    <div key={i} className="rounded-full ring-2 ring-white/10">
                                        <PlayerAvatar name={p} className="w-6 h-6 text-[8px]" />
                                    </div>
                                ))}
                            </div>
                            {players.length > 4 && (
                                <span className="ml-1.5 text-[8px] font-black uppercase tracking-wider text-white/30">
                                    +{players.length - 4}
                                </span>
                            )}
                            {players.length === 0 && (
                                <span className="text-[8px] font-bold uppercase tracking-widest text-white/20 flex items-center gap-1">
                                    <Users size={9} /> 0
                                </span>
                            )}
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </motion.li>
    );
}


