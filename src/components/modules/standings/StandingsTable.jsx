import React from "react";
import { motion } from "framer-motion";
import { Swords, Trophy } from "lucide-react";
import PlayerAvatar from "../../common/PlayerAvatar";
import LiquidButton from "../../common/LiquidButton";

export default function StandingsTable({
    standings,
    isAdmin,
    handleStandingsLongPress,
    isKnockoutReady,
    generateKnockouts,
    isKnockoutStarted,
    qualifyCount: qCount = 2,
}) {
    // Label for the knockout-generate button based on qualifier count
    const knockoutLabel = qCount >= 4
        ? "⚡ Generate Semis + Final"
        : "⚡ Generate Grand Final";

    return (
        <motion.div key="standings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Table Card */}
            <div className="rounded-[2rem] overflow-hidden mb-6"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)" }}>

                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, rgba(255,202,40,0.1), transparent)" }}>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,202,40,0.8)" }}>
                        Live Standings
                    </span>
                    <div className="flex gap-5 text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
                        <span style={{ minWidth: 24, textAlign: "center" }}>W</span>
                        <span style={{ minWidth: 24, textAlign: "center" }}>PD</span>
                        <span style={{ minWidth: 24, textAlign: "center" }}>P</span>
                    </div>
                </div>

                {/* Rows */}
                {standings.map((t, i) => {
                    const rankColors = [
                        { color: "#FFD700", shadow: "rgba(255,215,0,0.5)" },
                        { color: "#C0C0C0", shadow: "rgba(192,192,192,0.4)" },
                        { color: "#CD7F32", shadow: "rgba(205,127,50,0.4)" },
                    ];
                    const rank = rankColors[i];
                    const isQ = t.status === "Q";
                    const isE = t.status === "E";

                    // Only show cutoff separator when there are actually Q OR E rows (not all pending)
                    const hasDefiniteStatuses = standings.some((s) => s.status === "Q" || s.status === "E");
                    const showCutoff = hasDefiniteStatuses && i === qCount && !isKnockoutStarted;

                    return (
                        <React.Fragment key={t.name}>
                            {showCutoff && (
                                <div className="flex items-center gap-2 px-5 py-1.5"
                                    style={{ background: "rgba(239,68,68,0.06)", borderTop: "1px solid rgba(239,68,68,0.14)", borderBottom: "1px solid rgba(239,68,68,0.14)" }}>
                                    <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: "rgba(239,68,68,0.6)" }}>
                                        — Elimination Zone —
                                    </div>
                                </div>
                            )}
                            <motion.div layout
                                className="flex items-center px-5 py-3.5 relative"
                                style={{
                                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                                    background: isQ ? "linear-gradient(135deg, rgba(34,197,94,0.06), transparent)" : "transparent",
                                    opacity: isE ? 0.35 : 1,
                                }}
                            >
                                {/* Rank */}
                                <div className="w-6 text-center font-black text-sm mr-4 shrink-0" style={{
                                    color: rank ? rank.color : "rgba(255,255,255,0.2)",
                                    textShadow: rank ? `0 0 12px ${rank.shadow}` : "none"
                                }}>
                                    {i + 1}
                                </div>

                                {/* Avatars */}
                                <div className="flex -space-x-1.5 mr-3 shrink-0">
                                    {t.p1
                                        ? <><PlayerAvatar name={t.p1} className="w-8 h-8 text-[10px] z-10" />{t.p2 && <PlayerAvatar name={t.p2} className="w-8 h-8 text-[10px] z-0" />}</>
                                        : <PlayerAvatar name={t.name} className="w-8 h-8 text-[10px]" />
                                    }
                                </div>

                                {/* Name + Form */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-black uppercase tracking-tight text-white truncate leading-tight">
                                        {t.name}
                                    </p>
                                    <div className="flex gap-0.5 mt-1">
                                        {t.form.slice(-6).map((res, fIdx) => (
                                            <div key={fIdx}
                                                className={`w-1.5 h-1.5 rounded-full ${res === "W" ? "bg-green-400" : "bg-red-500/50"}`}
                                                style={res === "W" ? { boxShadow: "0 0 4px rgba(74,222,128,0.6)" } : {}}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-5 shrink-0">
                                    <span className="w-6 text-center text-sm font-black text-white">{t.w}</span>
                                    <span className={`w-6 text-center text-xs font-bold ${t.pd > 0 ? "text-green-400" : t.pd < 0 ? "text-red-400" : "text-white/30"}`}>
                                        {t.pd > 0 ? "+" : ""}{t.pd}
                                    </span>
                                    <span className="w-6 text-center text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>{t.p}</span>
                                </div>

                                {/* Q badge — green bar on right */}
                                {isQ && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full"
                                        style={{ background: "linear-gradient(to bottom, #22c55e, #16a34a)", boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />
                                )}
                                {/* E badge — red dot */}
                                {isE && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full"
                                        style={{ background: "linear-gradient(to bottom, #ef4444, #dc2626)", boxShadow: "0 0 6px rgba(239,68,68,0.5)", opacity: 0.5 }} />
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

            {isAdmin && (
                <div className="mt-4 text-center" onContextMenu={(e) => { e.preventDefault(); handleStandingsLongPress(); }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>
                        Long press to edit
                    </p>
                </div>
            )}
        </motion.div>
    );
}
