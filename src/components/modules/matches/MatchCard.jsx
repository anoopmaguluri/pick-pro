import React, { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, CheckCircle2 } from "lucide-react";
import PlayerAvatar from "../../common/PlayerAvatar";
import { getMatchState, getPhaseLabel } from "../../../utils/scoringRules";

// ─── constants ────────────────────────────────────────────────────────────────
const WIN_TARGET = 11;
const HOLD_MS = 480;
const SPRING_POP = { type: "spring", stiffness: 520, damping: 22, mass: 0.5 };
const SPRING_CARD = { type: "spring", stiffness: 320, damping: 30 };
const PIP_COUNT = WIN_TARGET; // always render exactly 11 pips

// ─── Pip Bar ─────────────────────────────────────────────────────────────────
// Fixed-size circular pips – fills min(score, 11) from the outer edge inward.
// In deuce zone all 11 glow; the score number + PhaseBanner carry context.
function PipBar({ score, side, isDeuceZone }) {
    const filled = Math.min(score, PIP_COUNT);
    const reversed = side === "B";          // B fills right → left

    return (
        <div
            className="flex items-center gap-[3px]"
            style={{ flexDirection: reversed ? "row-reverse" : "row" }}
        >
            {Array.from({ length: PIP_COUNT }).map((_, i) => {
                const active = i < filled;
                return (
                    <motion.div
                        key={i}
                        animate={{
                            scale: active ? 1 : 0.55,
                            opacity: active ? 1 : 0.18,
                        }}
                        transition={{
                            ...SPRING_POP,
                            delay: active ? i * 0.015 : 0,
                        }}
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            flexShrink: 0,
                            background: active
                                ? isDeuceZone
                                    ? "linear-gradient(135deg, #FFCA28, #F57C00)"
                                    : "rgba(255,255,255,0.72)"
                                : "rgba(255,255,255,0.12)",
                            boxShadow: active && isDeuceZone
                                ? "0 0 6px rgba(255,202,40,0.7)"
                                : "none",
                            animation: active && isDeuceZone ? "deucePulse 1.5s ease-in-out infinite" : "none",
                        }}
                    />
                );
            })}
        </div>
    );
}

// ─── Phase Banner (sweeps across the centre divider) ─────────────────────────
function PhaseBanner({ phase, label }) {
    const colors = {
        deuce: { from: "rgba(251,191,36,0.38)", via: "rgba(251,191,36,0.10)", color: "#FCD34D", glow: "rgba(251,191,36,0.55)" },
        advantage: { from: "rgba(74,222,128,0.32)", via: "rgba(74,222,128,0.08)", color: "#4ADE80", glow: "rgba(74,222,128,0.45)" },
        finished: { from: "rgba(168,85,247,0.28)", via: "rgba(168,85,247,0.06)", color: "#C084FC", glow: "rgba(168,85,247,0.40)" },
        playing: { from: "rgba(249,115,22,0.32)", via: "rgba(249,115,22,0.07)", color: "#FB923C", glow: "rgba(249,115,22,0.50)" },
    }[phase];
    if (!colors || !label) return null;

    return (
        <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
            style={{
                background: `linear-gradient(90deg, ${colors.from}, ${colors.via}, ${colors.from})`,
                borderTop: `1px solid ${colors.glow}`,
                borderBottom: `1px solid ${colors.glow}`,
                boxShadow: `0 0 20px ${colors.glow}`,
                paddingTop: 5,
                paddingBottom: 5,
                transformOrigin: "center",
            }}
        >
            <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "0.65rem",
                fontWeight: 900,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: colors.color,
                textShadow: `0 0 16px ${colors.glow}`,
                whiteSpace: "nowrap",
            }}>
                {label}
            </span>
        </motion.div>
    );
}

// ─── Half Zone ────────────────────────────────────────────────────────────────
// Single team's side. Tap = +1, hold HOLD_MS = −1.
// Interaction is BLOCKED once phase === "finished" (winner determined) until
// the match is officially finalized, preventing runaway score entry.
function HalfZone({ team, score, side, matchState, isAdmin, isDone, onScore, isWinnerHighlight }) {
    const longTimer = useRef(null);
    const didLongPress = useRef(false);
    const pendingScore = useRef(false); // guard: only one tap fires per gesture

    const isWinner = isDone && matchState.winner === side;
    const isLoser = isDone && matchState.winner !== null && !isWinner;
    const hasAdv = matchState.phase === "advantage" && matchState.advantageTeam === side;

    // ── tap is blocked once a winner is mathematically determined
    //    subtract (undo) is ALWAYS allowed while match is not yet finalized
    const tapBlocked = isDone || matchState.phase === "finished";
    const subtractBlocked = isDone;

    // ── pointer handlers ──────────────────────────────────────────────────────
    const onDown = useCallback((e) => {
        e.stopPropagation();
        // Only start a gesture if at least one action is possible
        if (!isAdmin || (tapBlocked && subtractBlocked)) return;
        didLongPress.current = false;
        pendingScore.current = !tapBlocked; // only mark pending-add if tap is allowed

        longTimer.current = setTimeout(() => {
            didLongPress.current = true;
            pendingScore.current = false;
            if (!subtractBlocked && score > 0) onScore(side, -1);  // undo
            longTimer.current = null;
        }, HOLD_MS);
    }, [isAdmin, tapBlocked, subtractBlocked, score, side, onScore]);

    const onUp = useCallback((e) => {
        e.stopPropagation();
        if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
        if (!isAdmin) return;
        // Fire +1 only if tap was pending (not a long-press, and add is still allowed)
        if (pendingScore.current && !didLongPress.current && !tapBlocked) {
            pendingScore.current = false;
            onScore(side, 1);
        }
        pendingScore.current = false;
    }, [isAdmin, tapBlocked, side, onScore]);

    const onCancel = useCallback(() => {
        if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
        pendingScore.current = false;
    }, []);

    return (
        <div
            className="flex-1 flex flex-col select-none touch-manipulation relative overflow-hidden"
            style={{
                cursor: isAdmin && !tapBlocked ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent",
            }}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onPointerLeave={onCancel}
        >
            {/* Winner radial glow */}
            < AnimatePresence >
                {isWinner && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: side === "A"
                                ? "radial-gradient(ellipse at 20% 50%, rgba(255,202,40,0.18) 0%, transparent 70%)"
                                : "radial-gradient(ellipse at 80% 50%, rgba(255,202,40,0.18) 0%, transparent 70%)",
                        }}
                    />
                )}
            </AnimatePresence >

            {/* Loser overlay */}
            {
                isLoser && (
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "rgba(3,7,18,0.48)" }} />
                )
            }

            <div className="flex flex-col items-center justify-between h-full px-4 py-5">
                {/* Top: avatars + name */}
                <div className="flex flex-col items-center gap-1.5">
                    {isWinnerHighlight && isWinner && (
                        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                            <Crown size={18} style={{ color: "#FFCA28", filter: "drop-shadow(0 0 10px rgba(255,202,0,0.9))" }} />
                        </motion.div>
                    )}
                    <div className="flex -space-x-2">
                        <PlayerAvatar name={team.p1} className="w-8 h-8 text-[10px] z-10 ring-2 ring-white/10" />
                        {team.p2 && <PlayerAvatar name={team.p2} className="w-8 h-8 text-[10px] z-0 ring-2 ring-white/10" />}
                    </div>
                    <p className="text-center text-[9px] font-black uppercase tracking-tight leading-tight"
                        style={{
                            color: hasAdv ? "#4ADE80" : isWinner ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                            maxWidth: 90,
                        }}>
                        {team.name}
                    </p>
                </div>

                {/* Score number */}
                <div className="relative my-3">
                    <AnimatePresence mode="popLayout">
                        <motion.span
                            key={score}
                            initial={{ scale: 1.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            transition={SPRING_POP}
                            className="block tabular-nums"
                            style={{
                                fontFamily: "'DM Mono', 'Space Mono', monospace",
                                fontSize: "4.5rem",
                                lineHeight: 1,
                                fontWeight: 900,
                                color: isWinner ? "#FFCA28"
                                    : hasAdv ? "#4ADE80"
                                        : isLoser ? "rgba(255,255,255,0.12)"
                                            : "rgba(255,255,255,0.9)",
                                textShadow: isWinner ? "0 0 40px rgba(255,202,40,0.7)"
                                    : hasAdv ? "0 0 24px rgba(74,222,128,0.6)"
                                        : "none",
                            }}
                        >
                            {score}
                        </motion.span>
                    </AnimatePresence>



                </div>

                {/* Pip bar */}
                <PipBar score={score} side={side} isDeuceZone={matchState.isDeuceZone} />
            </div>
        </div >
    );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────
export default function MatchCard({ match, idx, type = "pool", isAdmin, onScore, onConfirm }) {
    const isKnockout = type === "knockout";
    const isWinnerHighlight = isKnockout && match.id === "final" && match.done;
    const matchState = getMatchState(match.sA, match.sB);
    const { phase, winner } = matchState;

    const phaseLabel = !match.done
        ? getPhaseLabel(phase, matchState.advantageTeam, matchState.gamePointTeam, match.tA.name, match.tB.name)
        : null;

    const canFinalize = isAdmin && !match.done && phase === "finished";

    const cardBg = isWinnerHighlight
        ? "linear-gradient(135deg, rgba(255,202,40,0.14), rgba(245,124,0,0.07))"
        : match.done ? "rgba(255,255,255,0.02)"
            : "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))";

    const cardBorder = isWinnerHighlight
        ? "1.5px solid rgba(255,202,40,0.4)"
        : match.done ? "1px solid rgba(255,255,255,0.05)"
            : "1px solid rgba(255,255,255,0.1)";

    return (
        <div
            className="relative rounded-[2.5rem] overflow-hidden transition-transform duration-300 hover:-translate-y-1"
            style={{
                background: cardBg,
                border: cardBorder,
                boxShadow: match.done
                    ? "0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)"
                    : "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)",
                backdropFilter: "blur(20px)",
                animation: !match.done && !isWinnerHighlight ? "breatheGlow 3s ease-in-out infinite" : "none",
            }}
        >
            {/* Glass sheen */}
            {!match.done && (
                <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)" }} />
            )}

            {/* Knockout chip */}
            {isKnockout && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1 rounded-b-xl text-[8px] font-black uppercase tracking-widest whitespace-nowrap z-20"
                    style={isWinnerHighlight
                        ? { background: "linear-gradient(135deg, #FFCA28, #F57C00)", color: "#030712" }
                        : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "none" }
                    }>
                    {match.type}
                </div>
            )}

            {/* Split HUD */}
            <div className="flex relative" style={{ minHeight: 210 }}>
                {/* Team A */}
                <HalfZone
                    team={match.tA} score={match.sA} side="A"
                    matchState={matchState}
                    isAdmin={isAdmin} isDone={match.done}
                    onScore={onScore}
                    isWinnerHighlight={isWinnerHighlight}
                />

                {/* Centre divider + phase banner */}
                <div className="relative flex flex-col items-center justify-center" style={{ width: 1, flexShrink: 0 }}>
                    {/* Gradient line */}
                    <div className="absolute inset-y-0 w-px"
                        style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.15) 75%, transparent 100%)" }} />

                    {/* Phase banner anchored to mid-card vertically */}
                    <div className="absolute" style={{ width: "100vw", left: "50%", transform: "translateX(-50%)", top: "50%", marginTop: -14 }}>
                        <AnimatePresence mode="wait">
                            {phaseLabel && <PhaseBanner key={phase} phase={phase} label={phaseLabel} />}
                        </AnimatePresence>
                    </div>

                    {/* Diamond VS marker */}
                    <div className="relative z-10 flex items-center justify-center"
                        style={{
                            width: 20, height: 20,
                            transform: "rotate(45deg)",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 3,
                        }}>
                        <span className="text-[6px] font-black"
                            style={{ color: "rgba(255,255,255,0.25)", transform: "rotate(-45deg)" }}>VS</span>
                    </div>
                </div>

                {/* Team B */}
                <HalfZone
                    team={match.tB} score={match.sB} side="B"
                    matchState={matchState}
                    isAdmin={isAdmin} isDone={match.done}
                    onScore={onScore}
                    isWinnerHighlight={isWinnerHighlight}
                />
            </div>

            {/* Admin glow ring */}
            {isAdmin && !match.done && (
                <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(255,202,40,0.07)" }} />
            )}

            {/* Finalize button — only when winner is mathematically determined */}
            <AnimatePresence>
                {canFinalize && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={SPRING_CARD}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-2">
                            <motion.button
                                whileTap={{ scale: 0.94 }}
                                whileHover={{ scale: 1.02 }}
                                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                                onClick={onConfirm}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[1.3rem] relative overflow-hidden"
                                style={{
                                    fontFamily: "'Space Grotesk', sans-serif",
                                    fontSize: "0.62rem",
                                    fontWeight: 800,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                    color: "#fff",
                                    border: "1px solid rgba(34,197,94,0.45)",
                                    boxShadow: "0 4px 20px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                                }}
                            >
                                {/* Shimmer sweep */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.3rem]">
                                    <div className="absolute -inset-full"
                                        style={{
                                            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
                                            animation: "shimmer 2.5s ease-in-out infinite",
                                        }} />
                                </div>
                                <CheckCircle2 size={14} strokeWidth={2.5} className="relative z-10" />
                                <span className="relative z-10">Finalize — {winner === "A" ? match.tA.name : match.tB.name} Wins</span>
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
