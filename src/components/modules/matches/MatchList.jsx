import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Swords, Hourglass } from "lucide-react";
import MatchCard from "./MatchCard";

// Section divider label
function SectionLabel({ icon, label, gold }) {
    return (
        <div className="flex items-center justify-center gap-2 my-5">
            <div className="h-px flex-1" style={{
                background: gold
                    ? "linear-gradient(to right, transparent, rgba(255,202,40,0.3))"
                    : "linear-gradient(to right, transparent, rgba(255,255,255,0.08))"
            }} />
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                style={gold
                    ? { color: "rgba(255,202,40,0.85)", border: "1px solid rgba(255,202,40,0.2)", background: "rgba(255,202,40,0.07)" }
                    : { color: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.08)", background: "transparent" }
                }>
                {icon}
                {label}
            </span>
            <div className="h-px flex-1" style={{
                background: gold
                    ? "linear-gradient(to left, transparent, rgba(255,202,40,0.3))"
                    : "linear-gradient(to left, transparent, rgba(255,255,255,0.08))"
            }} />
        </div>
    );
}

export default function MatchList({
    matches,
    knockouts,
    isAdmin,
    adjustScore,
    confirmMatch,
    confirmKnockout,
}) {
    const semis = (knockouts || []).filter((k) => k.id === "sf1" || k.id === "sf2");
    const finals = (knockouts || []).filter((k) => k.id === "final");
    const hasSemis = semis.length > 0;
    const hasFinal = finals.length > 0;
    const finalPending = finals[0]?.pending;
    const finalKIdx = (knockouts || []).findIndex((k) => k.id === "final");

    return (
        <motion.div key="fixtures" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">

            {/* ── GRAND FINAL (always first) ───────────────────────────────── */}
            <AnimatePresence>
                {hasFinal && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                        <SectionLabel icon={<Trophy size={10} />} label="Grand Final" gold />

                        {finalPending ? (
                            <motion.div
                                className="flex items-center justify-center gap-3 py-8 rounded-[2rem]"
                                style={{ background: "rgba(255,202,40,0.04)", border: "1px dashed rgba(255,202,40,0.2)" }}
                            >
                                <Hourglass size={16} style={{ color: "rgba(255,202,40,0.5)" }} />
                                <p className="text-[10px] font-black uppercase tracking-widest"
                                    style={{ color: "rgba(255,202,40,0.5)" }}>
                                    Waiting for Semi Finals
                                </p>
                            </motion.div>
                        ) : (
                            finals.map((m) => (
                                <MatchCard
                                    key="k-final"
                                    match={m} idx={finalKIdx} type="knockout" isAdmin={isAdmin}
                                    onScore={(team, delta) => adjustScore(finalKIdx, team, delta, true)}
                                    onConfirm={() => confirmKnockout(finalKIdx)}
                                />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SEMI FINALS ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {hasSemis && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                        <SectionLabel icon={<Swords size={10} />} label="Semi Finals" gold />
                        <div className="space-y-4">
                            {semis.map((m, idx) => (
                                <MatchCard
                                    key={`k-${m.id}`}
                                    match={m} idx={idx} type="knockout" isAdmin={isAdmin}
                                    onScore={(team, delta) => adjustScore(idx, team, delta, true)}
                                    onConfirm={() => confirmKnockout(idx)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── POOL PLAY ────────────────────────────────────────────────── */}
            {matches && matches.length > 0 ? (
                <>
                    {(hasSemis || hasFinal) && (
                        <SectionLabel icon={<Swords size={10} />} label={`Pool Play · ${matches.length}`} />
                    )}
                    {matches.map((m, idx) => (
                        <MatchCard
                            key={`m-${m.id || "no-id"}-${idx}`}
                            match={m} idx={idx} type="pool" isAdmin={isAdmin}
                            onScore={(team, delta) => adjustScore(idx, team, delta, false)}
                            onConfirm={() => confirmMatch(idx)}
                        />
                    ))}
                </>
            ) : (
                !hasSemis && !hasFinal && (
                    <div className="py-20 text-center">
                        <p className="text-[11px] font-black uppercase tracking-widest"
                            style={{ color: "rgba(255,255,255,0.15)" }}>
                            No Matches Scheduled
                        </p>
                    </div>
                )
            )}
        </motion.div>
    );
}
