import React from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import LiquidButton from "../../common/LiquidButton";

const columnLayout = "grid-cols-[26px_minmax(0,1fr)_34px_30px_30px_42px_56px]";
const parseTeamPlayers = (team) => {
    const clean = (value) => (typeof value === "string" ? value.trim() : "");

    const fromP1 = clean(team?.p1);
    const fromP2 = clean(team?.p2);
    if (fromP1 || fromP2) return [fromP1, fromP2].filter(Boolean);

    const rawName = clean(team?.name);
    if (!rawName) return [];

    const split = rawName.split("/").map((part) => part.trim()).filter(Boolean);
    if (split.length >= 2) return [split[0], split[1]];
    return [rawName];
};

export default function StandingsTable({
    standings,
    isAdmin,
    isKnockoutReady,
    generateKnockouts,
    isKnockoutStarted,
    qualifyCount: qCount = 2,
    isTournamentOver,
    enableInternalScroll = false,
}) {
    const knockoutLabel = qCount >= 4
        ? "Generate Semis + Final"
        : "Generate Grand Final";
    const showKnockoutButton = isAdmin && isKnockoutReady && !isKnockoutStarted;

    const maxWins = Math.max(1, ...standings.map((team) => Number(team.w) || 0));
    const anyMatchesPlayed = standings.some((team) => (Number(team.p) || 0) > 0);

    return (
        <motion.div
            key="standings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={enableInternalScroll ? "h-full min-h-0 flex flex-col" : ""}
        >
            <div
                className={`rounded-[2rem] relative overflow-hidden ${enableInternalScroll ? "flex-1 min-h-0 flex flex-col" : ""}`}
                style={{
                    background: "linear-gradient(165deg, rgba(7,11,22,0.92), rgba(3,8,20,0.98) 58%, rgba(8,14,30,0.94))",
                    border: "1px solid rgba(120,132,156,0.16)",
                    backdropFilter: "blur(26px)",
                    boxShadow: "0 18px 36px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -18px 24px rgba(2,6,23,0.3)",
                }}
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,202,40,0.12),transparent_42%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_94%_100%,rgba(148,163,184,0.1),transparent_42%)]" />
                    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(transparent_50%,rgba(255,255,255,1)_50%)] bg-[length:100%_4px]" />
                </div>

                <div
                    className="px-4 py-4 sticky top-0 z-20 shrink-0"
                    style={{
                        borderBottom: "1px solid rgba(120,132,156,0.16)",
                        background: "linear-gradient(92deg, rgba(255,202,40,0.12), rgba(15,23,42,0.92) 48%, rgba(148,163,184,0.12))",
                        backdropFilter: "blur(12px)",
                    }}
                >
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />

                    <div className="flex items-center justify-between gap-2">
                        <span
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em]"
                            style={{ color: "rgba(254,243,199,0.95)" }}
                        >
                            <Trophy size={11} />
                            {isTournamentOver ? "Final Standings" : "Live Standings"}
                        </span>

                        <div className="flex gap-1.5">
                            <span
                                className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.14em]"
                                style={{
                                    background: "rgba(15,23,42,0.62)",
                                    border: "1px solid rgba(120,132,156,0.3)",
                                    color: "rgba(226,232,240,0.9)",
                                }}
                            >
                                Teams {standings.length}
                            </span>
                            <span
                                className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.14em]"
                                style={{
                                    background: "rgba(255,202,40,0.16)",
                                    border: "1px solid rgba(255,202,40,0.34)",
                                    color: "rgba(254,243,199,0.95)",
                                }}
                            >
                                Top {qCount}
                            </span>
                        </div>
                    </div>

                    <div
                        className={`mt-3 grid ${columnLayout} gap-1.5 md:gap-2 items-center text-[8px] font-black uppercase tracking-[0.15em]`}
                        style={{ color: "rgba(191,207,227,0.54)" }}
                    >
                        <span className="text-center">#</span>
                        <span>Team</span>
                        <span className="text-center">Pts</span>
                        <span className="text-center">MP</span>
                        <span className="text-center">W</span>
                        <span className="text-center">PD</span>
                        <span className="text-center">PF-PA</span>
                    </div>
                </div>

                <div
                    className={`relative z-10 px-3 pb-3 ${enableInternalScroll ? "flex-1 min-h-0 overflow-y-auto" : ""}`}
                    style={enableInternalScroll ? { scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-y" } : undefined}
                >
                    {standings.map((team, idx) => {
                        const players = parseTeamPlayers(team);
                        const primaryPlayer = players[0] || team.name;
                        const secondaryPlayer = players[1] || null;
                        const teamIdentity = secondaryPlayer
                            ? `${primaryPlayer} + ${secondaryPlayer}`
                            : primaryPlayer;

                        const matchesPlayed = Number(team.p) || 0;
                        const wins = Number(team.w) || 0;
                        const pointDiff = Number(team.pd) || 0;
                        const pf = Number(team.pf) || 0;
                        const pa = Number(team.pa) || 0;
                        const points = wins * 2;

                        const isConfirmedQ = team.status === "Q";
                        const isConfirmedE = team.status === "E";
                        const qualifyProbability = Number(team.analysis?.probability);
                        const hasProbability = Number.isFinite(qualifyProbability);

                        const isProjectedQ = anyMatchesPlayed && !isConfirmedQ && hasProbability && qualifyProbability >= 60;
                        const isProjectedE = anyMatchesPlayed && !isConfirmedE && hasProbability && qualifyProbability <= 40;
                        const showCutoff = anyMatchesPlayed && idx === qCount && !isKnockoutStarted && !isConfirmedQ && !isConfirmedE;

                        const winProgress = Math.min(100, Math.max(0, (wins / maxWins) * 100));
                        const formResults = Array.isArray(team.form) ? team.form.slice(-6) : [];
                        const formTrail = formResults.length > 0 ? formResults : [null, null, null, null, null, null];

                        let barColor = "linear-gradient(180deg, rgba(148,163,184,0.9), rgba(100,116,139,0.72))";
                        let progressColor = "linear-gradient(90deg, rgba(148,163,184,0.15), rgba(148,163,184,0.02))";
                        let rowGlow = "0 8px 18px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.07)";

                        if (isConfirmedQ) {
                            barColor = "linear-gradient(180deg, rgba(255,202,40,0.95), rgba(245,124,0,0.82))";
                            progressColor = "linear-gradient(90deg, rgba(255,202,40,0.24), rgba(255,202,40,0.03))";
                            rowGlow = "0 10px 20px rgba(74,40,3,0.2), inset 0 1px 0 rgba(255,255,255,0.08)";
                        } else if (isProjectedQ) {
                            barColor = "linear-gradient(180deg, rgba(255,202,40,0.86), rgba(245,158,11,0.68))";
                            progressColor = "linear-gradient(90deg, rgba(255,202,40,0.15), rgba(255,202,40,0.02))";
                        } else if (isConfirmedE || isProjectedE) {
                            barColor = "linear-gradient(180deg, rgba(148,163,184,0.92), rgba(71,85,105,0.76))";
                            progressColor = "linear-gradient(90deg, rgba(148,163,184,0.14), rgba(148,163,184,0.02))";
                        }

                        const playerNameClass = `text-[10px] md:text-[11px] font-black uppercase tracking-[0.09em] truncate ${isConfirmedE ? "line-through decoration-slate-300/40" : ""}`;
                        const playerNameStyle = { color: "rgba(241,245,249,0.96)" };

                        return (
                            <React.Fragment key={team.name}>
                                {showCutoff && (
                                    <div
                                        className="mx-1 my-2 rounded-xl px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em]"
                                        style={{
                                            color: "rgba(226,232,240,0.92)",
                                            background: "rgba(15,23,42,0.62)",
                                            border: "1px solid rgba(148,163,184,0.32)",
                                        }}
                                    >
                                        Cutoff Zone
                                    </div>
                                )}

                                <motion.div
                                    layout
                                    className="relative rounded-2xl mt-2 overflow-hidden"
                                    style={{
                                        border: "1px solid rgba(100,116,139,0.2)",
                                        background: "linear-gradient(116deg, rgba(15,23,42,0.68), rgba(2,6,23,0.84) 56%, rgba(15,23,42,0.72))",
                                        opacity: isConfirmedE ? 0.62 : 1,
                                        boxShadow: `${rowGlow}, inset 0 0 0 1px rgba(255,255,255,0.02)`,
                                    }}
                                >
                                    <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${winProgress}%`, background: progressColor }} />
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: barColor }} />

                                    <div className={`relative z-10 px-3 py-3 grid ${columnLayout} gap-1.5 md:gap-2 items-center`}>
                                        <div className="flex justify-center">
                                            <span
                                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black tabular-nums"
                                                style={{
                                                    background: idx < 3 ? "rgba(255,202,40,0.2)" : "rgba(30,41,59,0.74)",
                                                    border: idx < 3 ? "1px solid rgba(255,202,40,0.4)" : "1px solid rgba(100,116,139,0.34)",
                                                    color: idx < 3 ? "rgba(254,243,199,0.98)" : "rgba(203,213,225,0.92)",
                                                }}
                                            >
                                                {idx + 1}
                                            </span>
                                        </div>

                                        <div className="min-w-0" title={teamIdentity}>
                                            <p className={playerNameClass} style={playerNameStyle}>
                                                {primaryPlayer}
                                            </p>
                                            {secondaryPlayer && (
                                                <p className={`${playerNameClass} mt-0.5`} style={playerNameStyle}>
                                                    {secondaryPlayer}
                                                </p>
                                            )}
                                            <div className="flex gap-1 mt-1">
                                                {formTrail.map((result, formIdx) => (
                                                    <div
                                                        key={formIdx}
                                                        className="rounded-full"
                                                        style={{
                                                            width: 5,
                                                            height: 5,
                                                            background: result === "W"
                                                                ? "rgba(74,222,128,0.94)"
                                                                : result === "L"
                                                                    ? "rgba(251,146,60,0.78)"
                                                                    : "rgba(148,163,184,0.45)",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <span className="text-center text-[11px] font-black tabular-nums text-amber-200">{points}</span>
                                        <span className="text-center text-[11px] font-bold tabular-nums" style={{ color: "rgba(203,213,225,0.86)" }}>{matchesPlayed}</span>
                                        <span className="text-center text-[12px] font-black tabular-nums" style={{ color: "rgba(248,250,252,0.96)" }}>{wins}</span>
                                        <span className={`text-center text-[11px] font-black tabular-nums ${pointDiff > 0 ? "text-cyan-300" : pointDiff < 0 ? "text-amber-300" : "text-slate-300/70"}`}>
                                            {pointDiff > 0 ? "+" : ""}
                                            {pointDiff}
                                        </span>
                                        <span className="text-center text-[10px] font-black tabular-nums" style={{ color: "rgba(226,232,240,0.9)" }}>
                                            {pf}
                                            <span className="mx-0.5 text-white/30">-</span>
                                            {pa}
                                        </span>
                                    </div>
                                </motion.div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {showKnockoutButton && (
                <LiquidButton
                    onClick={generateKnockouts}
                    variant="primary"
                    className="w-full mt-3"
                    style={{
                        borderRadius: "1.05rem",
                        padding: "1rem",
                        fontSize: "0.75rem",
                        letterSpacing: "0.1em",
                    }}
                >
                    ⚡ {knockoutLabel}
                </LiquidButton>
            )}
        </motion.div>
    );
}
