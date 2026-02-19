import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
}) {
    const { trigger: triggerHaptic } = useHaptic();
    const [hubTab, setHubTab] = React.useState("events");

    const [deleteModal, setDeleteModal] = React.useState({
        show: false,
        id: null,
    });

    const sortedTournaments = Object.values(tournaments).sort(
        (a, b) => b.createdAt - a.createdAt
    );

    return (
        <div className="max-w-md mx-auto h-[100dvh] flex flex-col relative overflow-hidden"
            style={{ background: "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 80% 80%, rgba(236,72,153,0.08) 0%, transparent 50%), #030712" }}>

            <Modal
                show={deleteModal.show}
                title="Delete Event?"
                message="This will permanently delete this event and its history."
                confirmText="Delete"
                isDestructive={true}
                onCancel={() => setDeleteModal({ show: false, id: null })}
                onConfirm={() => {
                    deleteTournament(deleteModal.id);
                    setDeleteModal({ show: false, id: null });
                }}
            />

            {/* Ambient background orbs */}
            <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(99,102,241,0.06)" }} />
            <div className="absolute bottom-1/4 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(236,72,153,0.06)" }} />

            {/* HEADER */}
            <header className="flex-none px-6 pt-12 pb-5 flex justify-between items-end relative z-10"
                style={{ background: "linear-gradient(to bottom, rgba(3,7,18,0.95), transparent)" }}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
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
                    style={{ width: 40, height: 40, padding: 0, borderRadius: "0.875rem", minWidth: 0 }}
                >
                    {isAdmin ? <Unlock size={16} /> : <Lock size={16} />}
                </LiquidButton>
            </header>

            {/* TAB SWITCHER */}
            <div className="px-6 pb-4 relative z-10">
                <LiquidTabBar
                    tabs={[
                        { id: "events", label: "Tour History" },
                        { id: "rankings", label: "Rankings", icon: <TrendingUp size={12} /> },
                    ]}
                    activeTab={hubTab}
                    onChange={(id) => { triggerHaptic(20); setHubTab(id); }}
                />
            </div>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto px-6 pb-8 relative z-10" style={{ scrollbarWidth: "none" }}>
                <AnimatePresence mode="wait">
                    {hubTab === "events" ? (
                        <motion.div key="events" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="space-y-4">

                            {/* CREATE FORM - HERO INPUT */}
                            <form onSubmit={createTournament} className="relative group mb-6">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                                <div className="relative flex items-center p-2 rounded-3xl overflow-hidden transition-all duration-300"
                                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)" }}>

                                    <div className="flex-1 pl-5 py-3 min-w-0">
                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-1 transition-colors group-focus-within:text-amber-400/80">
                                            Start New Event
                                        </label>
                                        <input
                                            type="text"
                                            value={newTourneyName}
                                            onChange={(e) => setNewTourneyName(e.target.value)}
                                            placeholder="EVENT NAME..."
                                            className="w-full bg-transparent text-lg font-black text-white placeholder-white/10 outline-none uppercase tracking-wider"
                                            style={{ caretColor: "#FFCA28" }}
                                        />
                                    </div>

                                    <div className="p-1">
                                        <LiquidButton type="submit" disabled={!newTourneyName.trim()} variant="primary"
                                            style={{ width: 52, height: 52, borderRadius: "1.2rem", padding: 0 }}>
                                            <Plus size={24} strokeWidth={3} />
                                        </LiquidButton>
                                    </div>
                                </div>
                            </form>

                            {/* TOURNAMENT CARDS */}
                            <div className="space-y-3">
                                {sortedTournaments.map((t) => (
                                    <motion.div layout key={t.id}
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.985 }}
                                        onClick={() => { triggerHaptic(40); setActiveTournamentId(t.id); }}
                                        className="relative p-5 rounded-3xl cursor-pointer group overflow-hidden transition-all"
                                        style={{
                                            background: t.winner
                                                ? "linear-gradient(135deg, rgba(255,202,40,0.1), rgba(245,124,0,0.05))"
                                                : "rgba(255,255,255,0.04)",
                                            border: t.winner
                                                ? "1px solid rgba(255,202,40,0.25)"
                                                : "1px solid rgba(255,255,255,0.08)",
                                            backdropFilter: "blur(20px)",
                                        }}
                                    >
                                        {/* Glass sheen */}
                                        <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 60%)" }} />

                                        <div className="flex items-start justify-between mb-3 relative z-10">
                                            <div className="flex-1 min-w-0 mr-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {t.winner && <Crown size={14} className="text-amber-400 fill-amber-400/20" />}
                                                    <h3 className={`font-black text-lg truncate transition-colors ${t.winner ? "text-amber-400" : "text-white group-hover:text-amber-300"}`}>
                                                        {t.name}
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
                                                    <span className="flex items-center gap-1.5">
                                                        <CalendarDays size={10} />
                                                        {new Date(t.createdAt).toLocaleDateString()}
                                                    </span>
                                                    {t.status === "active" && (
                                                        <span className="flex items-center gap-1.5 text-emerald-400/80">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                            Active
                                                        </span>
                                                    )}
                                                    {t.status === "completed" && (
                                                        <span className="flex items-center gap-1.5 text-amber-400/80">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                            Done
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {/* Delete — admin mode only */}
                                                {isAdmin && (
                                                    <motion.button
                                                        onClick={(e) => { e.stopPropagation(); triggerHaptic(50); setDeleteModal({ show: true, id: t.id }); }}
                                                        onPointerDown={() => { }}
                                                        whileTap={{ scale: 0.88 }}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-500/70 hover:bg-red-500/20 transition-colors">
                                                        <Trash2 size={14} />
                                                    </motion.button>
                                                )}

                                                {/* Status Indicator (Chevron or Edit Icon) */}
                                                <div className={`p-2 rounded-full transition-transform group-hover:translate-x-1 ${t.status === "active"
                                                    ? "text-emerald-400 bg-emerald-400/10"
                                                    : t.status === "draft"
                                                        ? "text-white/40 bg-white/5"
                                                        : "text-amber-400 bg-amber-400/10"
                                                    }`}>
                                                    {t.status === "draft" ? <LayoutGrid size={16} /> : <TrendingUp size={16} />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Player Avatars */}
                                        <div className="flex -space-x-2 relative z-10 pl-1">
                                            {(t.players || t.draftPlayers || []).slice(0, 6).map((p, i) => (
                                                <PlayerAvatar key={i} name={p}
                                                    className="w-7 h-7 text-[9px] ring-2 ring-[#0f172a]"
                                                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
                                                />
                                            ))}
                                            {(t.players || t.draftPlayers || []).length > 6 && (
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-[#0f172a] bg-white/10 text-white/60">
                                                    +{(t.players || t.draftPlayers || []).length - 6}
                                                </div>
                                            )}
                                        </div>

                                        {/* Winner Minimal Display */}
                                        {t.winner && (
                                            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500/60">Champion</span>
                                                <span className="text-xs font-black uppercase tracking-wide text-amber-400" style={{ textShadow: "0 0 12px rgba(255, 202, 40, 0.6)" }}>{t.winner}</span>
                                            </div>
                                        )}
                                    </motion.div>

                                ))}

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
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="rankings" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-4">
                            {globalLeaderboard.length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                        No Rankings Yet
                                    </p>
                                </div>
                            )}

                            {/* HERO PODIUM (1st Place) */}
                            {globalLeaderboard.length > 0 && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative mb-4">
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-3xl blur-xl" />
                                    <div className="relative bg-[#161b28] border border-amber-500/30 p-5 rounded-3xl overflow-hidden shadow-2xl shadow-amber-900/20">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Crown size={80} />
                                        </div>

                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <div className="absolute -inset-1 bg-gradient-to-br from-amber-300 to-orange-600 rounded-full animate-pulse opacity-50" />
                                                <PlayerAvatar name={globalLeaderboard[0].name} className="relative w-16 h-16 text-lg border-4 border-[#0f172a] shadow-xl" />
                                                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-[#0f172a] w-7 h-7 flex items-center justify-center rounded-full font-black text-sm border-2 border-[#0f172a]">
                                                    1
                                                </div>
                                            </div>

                                            <div className="flex-1">
                                                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Current #1</div>
                                                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">
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
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* RUNNER UPS (2nd & 3rd) */}
                            {globalLeaderboard.length >= 2 && (
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {globalLeaderboard.slice(1, 3).map((p, i) => (
                                        <motion.div key={p.name}
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + (i * 0.1) }}
                                            className="bg-[#161b28] border border-white/5 p-4 rounded-2xl relative overflow-hidden"
                                        >
                                            <div className="flex flex-col items-center text-center">
                                                <div className="relative mb-3">
                                                    <PlayerAvatar name={p.name} className="w-12 h-12 text-sm border-2 border-[#0f172a]" />
                                                    <div className="absolute -bottom-2 -right-1 w-6 h-6 flex items-center justify-center rounded-full font-black text-xs border-2 border-[#0f172a]"
                                                        style={{
                                                            background: i === 0 ? "#E2E8F0" : "#B45309",
                                                            color: i === 0 ? "#0f172a" : "#FFF"
                                                        }}>
                                                        {i + 2}
                                                    </div>
                                                </div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate w-full mb-1">{p.name}</h3>
                                                <div className="text-xs font-mono font-bold text-white/60">{p.rating}</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {/* THE REST (List) */}
                            {globalLeaderboard.length > 3 && (
                                <div className="space-y-1">
                                    <div className="px-4 py-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">Global Rankings</div>

                                    {globalLeaderboard.slice(3).map((p, i) => (
                                        <motion.div key={p.name}
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + (i * 0.05) }}
                                            className="flex items-center p-3 rounded-xl bg-white/5 border border-white/5"
                                        >
                                            <div className="w-8 text-center font-mono font-bold text-white/40 text-xs">{i + 4}</div>
                                            <PlayerAvatar name={p.name} className="w-8 h-8 text-[10px] mr-3" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-xs text-white uppercase tracking-wide truncate">{p.name}</div>
                                                <div className="text-[10px] text-white/40 font-mono">{p.w}W - {p.l}L</div>
                                            </div>
                                            <div className="font-mono font-bold text-sm text-white/80">{p.rating}</div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
