import React from "react";
import { motion } from "framer-motion";
import { Swords, Trophy } from "lucide-react";
import PlayerAvatar from "../../common/PlayerAvatar";
import LiquidButton from "../../common/LiquidButton";

export default function StandingsTable({
    standings,
    isAdmin,
    // handleStandingsLongPress, // Removed
    isKnockoutReady,
    generateKnockouts,
    isKnockoutStarted,
    qualifyCount: qCount = 2,
}) {
    // Label for the knockout-generate button based on qualifier count
    const knockoutLabel = qCount >= 4
        ? "⚡ Generate Semis + Final"
        : "⚡ Generate Grand Final";

    // Derive max wins for progress bar normalisation
    const maxWins = Math.max(1, ...standings.map((t) => t.w));

    return (
        <motion.div key="standings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Command Center Panel */}
            <div className="rounded-[2rem] overflow-hidden mb-6 relative group"
                style={{
                    background: "linear-gradient(180deg, rgba(3,7,18,0.7) 0%, rgba(0,0,0,0.9) 100%)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    backdropFilter: "blur(24px)",
                    boxShadow: "0 24px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 30px rgba(255,255,255,0.02)",
                }}>

                {/* Top edge sci-fi glow */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

                {/* Scanner line effect (very subtle texture) */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(transparent_50%,rgba(255,255,255,1)_50%)] bg-[length:100%_4px]" />

                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between relative z-10"
                    style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: "linear-gradient(90deg, rgba(255,202,40,0.08) 0%, transparent 100%)",
                    }}>
                    <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest leading-none"
                        style={{ color: "rgba(255,202,40,0.8)" }}>
                        {/* Pulsing LIVE dot */}
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                style={{ background: "#22c55e" }} />
                            <span className="relative inline-flex rounded-full h-2 w-2"
                                style={{ background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />
                        </span>
                        Live Standings
                    </span>
                    <div className="flex gap-3 text-[9px] font-black uppercase tracking-wider leading-none"
                        style={{ color: "rgba(255,255,255,0.25)" }}>
                        <span style={{ width: 24, textAlign: "center" }}>MP</span>
                        <span style={{ width: 24, textAlign: "center" }}>W</span>
                        <span style={{ width: 32, textAlign: "center" }}>PD</span>
                        <span style={{ width: 24, textAlign: "center" }}>PTS</span>
                    </div>
                </div>

                {/* Rows */}
                {standings.map((t, i) => {
                    const rankColors = [
                        { color: "#FFD700", shadow: "rgba(255,215,0,0.6)", glow: "0 0 16px rgba(255,215,0,0.5)" },
                        { color: "#C0C0C0", shadow: "rgba(192,192,192,0.5)", glow: "0 0 12px rgba(192,192,192,0.4)" },
                        { color: "#CD7F32", shadow: "rgba(205,127,50,0.5)", glow: "0 0 12px rgba(205,127,50,0.4)" },
                    ];
                    const rank = rankColors[i];

                    const anyMatchesPlayed = standings.some(s => s.p > 0);

                    // ── STATUS LOGIC ──
                    // Projected Status: only show if games have been played and probability is convincing
                    const isProjectedQ = anyMatchesPlayed && (t.status === "Q" || (t.analysis && t.analysis.probability >= 60));
                    const isProjectedE = anyMatchesPlayed && (t.status === "E" || (t.analysis && t.analysis.probability <= 40));

                    // Confirmed Status: mathematically guaranteed (from determineStatus logic)
                    const isConfirmedQ = t.status === "Q";
                    const isConfirmedE = t.status === "E";

                    // Win-rate for progress bar (relative to max wins)
                    const winProgress = maxWins > 0 ? (t.w / maxWins) * 100 : 0;

                    const showCutoff = anyMatchesPlayed && i === qCount && !isKnockoutStarted && !isConfirmedQ && !isConfirmedE;

                    return (
                        <React.Fragment key={t.name}>
                            {showCutoff && (
                                <div className="flex items-center gap-2 px-5 py-1.5"
                                    style={{
                                        background: "rgba(239,68,68,0.06)",
                                        borderTop: "1px solid rgba(239,68,68,0.14)",
                                        borderBottom: "1px solid rgba(239,68,68,0.14)",
                                    }}>
                                    <div className="text-[8px] font-black uppercase tracking-widest"
                                        style={{ color: "rgba(239,68,68,0.6)" }}>
                                        — Elimination Zone —
                                    </div>
                                </div>
                            )}
                            <motion.div layout
                                className="flex items-center px-5 py-4 relative overflow-hidden group hover:bg-white/[0.02] transition-colors"
                                style={{
                                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                                    background: "transparent",
                                    borderLeft: isProjectedQ ? "3px solid #4ADE80" : isProjectedE ? "3px solid #F87171" : "3px solid transparent",
                                    opacity: isConfirmedE ? 0.45 : 1,
                                    boxShadow: isProjectedQ ? "inset 10px 0 20px -10px rgba(74,222,128,0.2)" : isProjectedE ? "inset 10px 0 20px -10px rgba(248,113,113,0.15)" : "none",
                                }}
                            >
                                {/* Win-rate progress bar (background) */}
                                <div className="absolute inset-y-0 left-0 pointer-events-none"
                                    style={{
                                        width: `${winProgress}%`,
                                        background: isProjectedQ
                                            ? "linear-gradient(90deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.01) 100%)"
                                            : "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
                                        transition: "width 0.5s ease",
                                    }} />

                                {/* Rank */}
                                <div className="w-6 text-center font-black text-sm mr-3 shrink-0 relative z-10 flex items-center justify-center leading-none" style={{
                                    color: rank ? rank.color : "rgba(255,255,255,0.2)",
                                    textShadow: rank ? rank.glow : "none",
                                }}>
                                    {i + 1}
                                </div>

                                {/* Avatars */}
                                <div className="flex -space-x-1.5 mr-3 shrink-0 relative z-10 items-center">
                                    {t.p1
                                        ? <><PlayerAvatar name={t.p1} className="w-8 h-8 text-[10px] z-10 ring-2 ring-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />{t.p2 && <PlayerAvatar name={t.p2} className="w-8 h-8 text-[10px] z-0 ring-2 ring-[#030712] shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />}</>
                                        : <PlayerAvatar name={t.name} className="w-8 h-8 text-[10px] ring-2 ring-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
                                    }
                                </div>

                                {/* Name + Form Streak */}
                                <div className="flex-1 min-w-0 relative z-10 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 leading-none">
                                        <p className={`text-[12px] font-black uppercase tracking-tight text-white truncate leading-none ${isConfirmedE ? "line-through decoration-red-500/40" : ""}`}>
                                            {t.name}
                                        </p>
                                        {/* Confirmed Qualification Icon */}
                                        {isConfirmedQ && (
                                            <span className="text-[10px] text-green-400 leading-none">✓</span>
                                        )}
                                        {/* Confirmed Elimination Icon - Optional, or just rely on transparency/line-through */}
                                        {isConfirmedE && (
                                            <span className="text-[10px] text-red-400/50 leading-none">🔒</span>
                                        )}
                                    </div>

                                    {/* Streak bar */}
                                    <div className="flex gap-[3px] mt-1.5">
                                        {t.form.slice(-6).map((res, fIdx) => (
                                            <div key={fIdx}
                                                className="rounded-sm"
                                                style={{
                                                    width: 6,
                                                    height: 4,
                                                    background: res === "W"
                                                        ? "linear-gradient(135deg, #4ADE80, #22c55e)"
                                                        : "rgba(239,68,68,0.6)",
                                                    boxShadow: res === "W"
                                                        ? "0 0 8px rgba(74,222,128,0.6)"
                                                        : "0 0 4px rgba(239,68,68,0.4)",
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-3 shrink-0 relative z-10 items-center">
                                    <span className="w-6 text-center text-xs font-bold text-white/40 leading-none">{t.p}</span>
                                    <span className="w-6 text-center text-sm font-black text-white leading-none">{t.w}</span>
                                    <span className={`w-8 text-center text-xs font-bold leading-none ${t.pd > 0 ? "text-green-400" : t.pd < 0 ? "text-red-400" : "text-white/30"}`}>
                                        {t.pd > 0 ? "+" : ""}{t.pd}
                                    </span>
                                    <span className="w-6 text-center text-sm font-black text-amber-400 leading-none">{t.w}</span>
                                </div>

                                {/* Status Bars (Right Edge) */}
                                {isProjectedQ && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full"
                                        style={{
                                            background: "linear-gradient(to bottom, #22c55e, #16a34a)",
                                            boxShadow: isConfirmedQ ? "0 0 8px rgba(34,197,94,0.6)" : "none",
                                            opacity: isConfirmedQ ? 1 : 0.4
                                        }} />
                                )}
                                {isProjectedE && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full"
                                        style={{
                                            background: "linear-gradient(to bottom, #ef4444, #dc2626)",
                                            boxShadow: isConfirmedE ? "0 0 6px rgba(239,68,68,0.5)" : "none",
                                            opacity: isConfirmedE ? 0.6 : 0.2
                                        }} />
                                )}
                            </motion.div>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Generate Knockouts button */}
            {isAdmin && isKnockoutReady && !isKnockoutStarted && (
                <LiquidButton onClick={generateKnockouts} variant="primary"
                    className="w-full"
                    style={{ borderRadius: "1rem", padding: "1rem", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                    {knockoutLabel}
                </LiquidButton>
            )}

            {/* Long press section removed */}
        </motion.div>
    );
}
