import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "../../../hooks/useHaptic";
import { Plus, Trash2, UsersRound, UserPlus, Zap, Check, RotateCcw, Shuffle, X } from "lucide-react";
import PlayerAvatar from "../../common/PlayerAvatar";
import LiquidButton from "../../common/LiquidButton";
import LiquidTabBar from "../../common/LiquidTabBar";


export default function Setup({
    data,
    roster,
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
    matchFormat,
    setMatchFormat,
    selectedPlayers,
    prepareAutoTournament,
    commitAutoTournament,
    removeManualTeam,
}) {
    const { trigger: triggerHaptic } = useHaptic();
    const sortedRoster = [...roster].sort();

    // Auto Draft Review State
    const [previewData, setPreviewData] = useState(null);

    const benchedPlayers = sortedRoster.filter(p => !(data.draftPlayers || []).includes(p));
    const draftPlayers = data.draftPlayers || [];

    const handleAutoDraft = (fmt) => {
        const preview = prepareAutoTournament(fmt);
        setPreviewData(preview);
        triggerHaptic(50);
    };

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

    const availablePlayersForManual = draftPlayers.filter(
        (p) => !manualTeams.some((team) => team.p1 === p || team.p2 === p)
    );

    const glassCard = {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.07)"
    };

    return (
        <>
            <div className="space-y-5">
                {!isManualMode ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

                        {/* Draft Input Card */}
                        <div className="p-5 rounded-[2rem]" style={glassCard}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-2"
                                style={{ color: "rgba(255,202,40,0.7)" }}>
                                Draft Athletes
                                {draftPlayers.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black"
                                        style={{ background: "rgba(255,202,40,0.12)", color: "rgba(255,202,40,0.9)" }}>
                                        {draftPlayers.length}
                                    </span>
                                )}
                            </p>

                            <form onSubmit={addPlayer} className="flex gap-2 mb-5">
                                <input
                                    value={newPlayer}
                                    onChange={(e) => setNewPlayer(e.target.value)}
                                    placeholder="Enter name..."
                                    className="flex-1 rounded-xl px-4 py-3.5 text-sm font-bold text-white outline-none placeholder-white/20"
                                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", caretColor: "#FFCA28" }}
                                />
                                <LiquidButton type="submit" variant="primary" style={{ width: 48, height: 48, padding: 0, borderRadius: "0.75rem", minWidth: 0 }}>
                                    <Plus size={18} />
                                </LiquidButton>
                            </form>

                            {draftPlayers.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                                    {draftPlayers.map((p) => (
                                        <motion.div layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={p}
                                            className="flex justify-between items-center px-3 py-2.5 rounded-xl relative overflow-hidden"
                                            style={{
                                                background: "rgba(255,255,255,0.04)",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                backdropFilter: "blur(12px)",
                                            }}>
                                            {/* Green left accent */}
                                            <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                                                style={{ background: "linear-gradient(to bottom, #22c55e, #16a34a)", boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
                                            <div className="flex items-center gap-2 pl-2">
                                                <PlayerAvatar name={p} className="w-6 h-6 text-[8px] ring-1 ring-white/10" />
                                                <span className="text-[10px] font-black uppercase tracking-tight text-white truncate max-w-[60px]">{p}</span>
                                            </div>
                                            <button onClick={() => toggleDraftPlayer(p, false)} style={{ color: "rgba(255,255,255,0.2)" }}
                                                className="hover:text-red-400 transition-colors p-1">
                                                <Trash2 size={13} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center rounded-xl flex flex-col items-center gap-2"
                                    style={{ border: "1px dashed rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
                                    <UserPlus size={20} style={{ color: "rgba(255,255,255,0.12)" }} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)" }}>
                                        Add players to get started
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* The Bench */}
                        {benchedPlayers.length > 0 && (
                            <div className="p-5 rounded-[2rem]" style={{ ...glassCard, background: "rgba(0,0,0,0.3)" }}>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    <UsersRound size={11} /> The Bench — Tap to Draft
                                    <span className="ml-auto px-2 py-0.5 rounded-full text-[8px] font-black"
                                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                                        {benchedPlayers.length}
                                    </span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {benchedPlayers.map((p) => (
                                        <motion.button
                                            layout="position"
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            key={p} onClick={() => toggleDraftPlayer(p, true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all"
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                                            <PlayerAvatar name={p} className="w-5 h-5 text-[7px] opacity-50" />
                                            {p}
                                            <Plus size={10} className="opacity-40" />
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Start Options */}
                        {draftPlayers.length >= 4 && (
                            <>
                                {/* Divider */}
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }} />
                                    <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>
                                        Format
                                    </span>
                                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.08), transparent)" }} />
                                </div>

                                {/* Format Toggle - LiquidTabBar */}
                                <div className="mb-2">
                                    <LiquidTabBar
                                        tabs={[
                                            { id: "singles", label: "Singles" },
                                            { id: "doubles", label: "Doubles" }
                                        ]}
                                        activeTab={matchFormat}
                                        onChange={setMatchFormat}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <LiquidButton onClick={() => handleAutoDraft(matchFormat)} variant="primary"
                                        className="flex-1"
                                        style={{ borderRadius: "1rem", padding: "1rem" }}>
                                        <Zap size={16} fill="currentColor" />
                                        Auto Draft
                                    </LiquidButton>

                                    <LiquidButton onClick={() => setIsManualMode(true)} variant="secondary"
                                        className="flex-1"
                                        style={{ borderRadius: "1rem", padding: "1rem" }}>
                                        <UsersRound size={16} />
                                        Manual Teams
                                    </LiquidButton>
                                </div>
                            </>
                        )}
                    </motion.div>
                ) : (
                    <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-5">
                        <div className="flex justify-between items-center">
                            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                                Manual Team Selection
                            </p>
                            <button onClick={() => setIsManualMode(false)}
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: "rgba(255,202,40,0.8)" }}>
                                ← Cancel
                            </button>
                        </div>

                        {/* ── MANUAL DRAFT BUILDER ────────────────────────────────────── */}
                        <div className="p-4 rounded-[1.5rem]" style={glassCard}>
                            <h3 className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"
                                style={{ color: "rgba(255,202,40,0.6)" }}>
                                <span>Building Team {manualTeams.length + 1}</span>
                                <span className="px-2 py-0.5 rounded-full text-[8px]"
                                    style={{ background: "rgba(255,202,40,0.1)", color: "rgba(255,202,40,0.7)" }}>
                                    {selectedPlayers.length}/2
                                </span>
                            </h3>

                            <div className="flex items-center gap-2">
                                {/* Slot 1 */}
                                <div className="flex-1 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
                                    style={{
                                        background: firstPick ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                                        border: firstPick ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.08)",
                                        backdropFilter: "blur(12px)",
                                        animation: !firstPick ? "slotPulse 2s ease-in-out infinite" : "none",
                                    }}>
                                    {firstPick ? (
                                        <motion.div layoutId="pick1" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                            <PlayerAvatar name={firstPick} className="w-6 h-6 text-[8px] ring-1 ring-amber-400/30" />
                                            {firstPick}
                                        </motion.div>
                                    ) : (
                                        <span className="text-white/15 text-[10px] font-black uppercase tracking-widest">Player 1</span>
                                    )}
                                </div>

                                <div className="text-white/15 font-black text-xs">+</div>

                                {/* Slot 2 */}
                                <div className="flex-1 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
                                    style={{
                                        background: secondPick ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                                        border: secondPick ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.08)",
                                        backdropFilter: "blur(12px)",
                                        animation: !secondPick && firstPick ? "slotPulse 2s ease-in-out infinite" : "none",
                                    }}>
                                    {secondPick ? (
                                        <motion.div layoutId="pick2" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                            <PlayerAvatar name={secondPick} className="w-6 h-6 text-[8px] ring-1 ring-amber-400/30" />
                                            {secondPick}
                                        </motion.div>
                                    ) : (
                                        <span className="text-white/15 text-[10px] font-black uppercase tracking-widest">Player 2</span>
                                    )}
                                </div>

                                {/* Undo Button */}
                                {selectedPlayers.length > 0 && (
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleManualUndo}
                                        className="h-14 w-14 rounded-2xl flex items-center justify-center"
                                        style={{
                                            background: "rgba(239,68,68,0.08)",
                                            border: "1px solid rgba(239,68,68,0.15)",
                                            color: "rgba(239,68,68,0.6)",
                                            boxShadow: "0 0 12px rgba(239,68,68,0.08)",
                                        }}>
                                        <RotateCcw size={18} />
                                    </motion.button>
                                )}
                            </div>
                        </div>

                        {/* Completed Teams List */}
                        {manualTeams.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-[9px] font-black uppercase tracking-widest pl-1 flex items-center gap-2"
                                    style={{ color: "rgba(255,255,255,0.25)" }}>
                                    Ready for Battle
                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black"
                                        style={{ background: "rgba(34,197,94,0.1)", color: "rgba(34,197,94,0.7)" }}>
                                        {manualTeams.length}
                                    </span>
                                </h3>
                                <div className="space-y-2">
                                    {manualTeams.map((t, i) => (
                                        <motion.div key={i} layout
                                            initial={{ scale: 0.95, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex items-center justify-between p-3 rounded-xl relative overflow-hidden"
                                            style={{
                                                background: "rgba(255,255,255,0.04)",
                                                border: "1px solid rgba(255,255,255,0.07)",
                                                backdropFilter: "blur(12px)",
                                            }}>
                                            <div className="flex items-center gap-3">
                                                {/* Amber numbered badge */}
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                                                    style={{
                                                        background: "linear-gradient(135deg, rgba(255,202,40,0.2), rgba(245,124,0,0.15))",
                                                        border: "1px solid rgba(255,202,40,0.2)",
                                                        color: "rgba(255,202,40,0.9)",
                                                    }}>
                                                    {i + 1}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex -space-x-1.5">
                                                        <PlayerAvatar name={t.p1} className="w-6 h-6 text-[8px] ring-1 ring-white/10 z-10" />
                                                        <PlayerAvatar name={t.p2} className="w-6 h-6 text-[8px] ring-1 ring-white/10 z-0" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-white/80 uppercase">
                                                        <span>{t.p1}</span>
                                                        <span className="text-white/15">+</span>
                                                        <span>{t.p2}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => removeManualTeam(i)} className="p-2 text-white/20 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Available Players */}
                        <div className="grid grid-cols-2 gap-3 mb-20">
                            {availablePlayersForManual.map((p) => (
                                <motion.button whileTap={{ scale: 0.93 }} key={p} onClick={() => handleManualSelect(p)}
                                    className="flex items-center gap-2 pl-2 pr-4 py-2 rounded-full font-black text-[11px] uppercase transition-all"
                                    style={selectedPlayers.includes(p)
                                        ? { background: "linear-gradient(135deg, #FFCA28, #F57C00)", color: "#030712", boxShadow: "0 4px 14px rgba(255,202,40,0.3)" }
                                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }
                                    }>
                                    <PlayerAvatar name={p} className={`w-8 h-8 text-[10px] ${selectedPlayers.includes(p) ? "" : "ring-2 ring-white/10"}`} />
                                    {p}
                                </motion.button>
                            ))}
                        </div>

                        {/* Progress indicator + Start button */}
                        {manualTeams.length > 0 && (
                            <div className="space-y-3">
                                {/* Progress chip */}
                                <div className="flex items-center justify-center gap-2 py-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest"
                                        style={{ color: "rgba(255,255,255,0.2)" }}>
                                        {manualTeams.length} {manualTeams.length === 1 ? "team" : "teams"} ready
                                        {availablePlayersForManual.length > 0 && (
                                            <> · {availablePlayersForManual.length} {availablePlayersForManual.length === 1 ? "player" : "players"} remaining</>
                                        )}
                                    </span>
                                </div>

                                {availablePlayersForManual.length < 2 && (
                                    <LiquidButton onClick={() => handleFormatSelection(manualTeams)} variant="primary"
                                        style={{ width: "100%", padding: "1.2rem", borderRadius: "1rem", fontSize: "0.8rem" }}>
                                        ⚡ Start Matches
                                    </LiquidButton>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
            {/* ── PREVIEW MODAL OVERLAY ────────────────────────────────────── */}
            <AnimatePresence>
                {previewData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
                    >
                        {/* ── PAIRS REVIEW: FULL SCREEN / MODAL ── */}
                        {previewData.format === "pairs" ? (
                            <motion.div
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="w-full max-w-md bg-[#030712] border-t sm:border border-white/10 sm:rounded-3xl p-6 pb-10 flex flex-col max-h-[90vh]"
                                style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-2xl font-black italic uppercase text-white tracking-tight">
                                            <span className="text-amber-400">Team</span> Review
                                        </h2>
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                            {previewData.teams.length} Teams Generated
                                        </p>
                                    </div>
                                    <button onClick={() => { setPreviewData(null); triggerHaptic(50); }}
                                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 pb-6 pr-1 custom-scrollbar">
                                    {previewData.teams?.map((t, i) => (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.04 }}
                                            key={i}
                                            className="relative p-0.5 rounded-2xl overflow-hidden group"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative flex items-center bg-[#0a0f1d] p-3 rounded-2xl border border-white/5">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-amber-500/20 mr-4">
                                                    {i + 1}
                                                </div>

                                                <div className="flex-1 flex flex-col justify-center gap-1.5">
                                                    {/* P1 */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <PlayerAvatar name={t.p1} className="w-5 h-5 text-[8px]" />
                                                            <span className="font-bold text-xs text-white tracking-wide uppercase">{t.p1}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-px bg-white/5 w-full" />
                                                    {/* P2 */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <PlayerAvatar name={t.p2} className="w-5 h-5 text-[8px]" />
                                                            <span className="font-bold text-xs text-white tracking-wide uppercase">{t.p2}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-6 border-t border-white/10 mt-auto">
                                    <LiquidButton onClick={() => handleAutoDraft(matchFormat)} variant="secondary"
                                        className="flex-1" style={{ borderRadius: "1rem", padding: "1.1rem" }}>
                                        <Shuffle size={18} />
                                        <span className="ml-2 font-bold">Regen</span>
                                    </LiquidButton>

                                    <LiquidButton onClick={confirmPreview} variant="primary"
                                        className="flex-[1.5]" style={{ borderRadius: "1rem", padding: "1.1rem" }}>
                                        <Check size={18} />
                                        <span className="ml-2 font-black">Confirm Teams</span>
                                    </LiquidButton>
                                </div>
                            </motion.div>
                        ) : (
                            /* ── SINGLES/MIXER: SIMPLE CONFIRMATION ── */
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                className="w-[85vw] max-w-sm bg-[#0a0f1d] border border-white/10 rounded-3xl p-6 relative overflow-hidden"
                                style={{ boxShadow: "0 0 50px rgba(0,0,0,0.8)" }}
                            >
                                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />

                                <div className="relative z-10 text-center space-y-6">
                                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                                        <Zap size={40} className="text-amber-400" fill="currentColor" />
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-black italic uppercase text-white mb-2 tracking-tight">
                                            {previewData.format === "singles" ? "Singles" : "Mixer"} <span className="text-amber-500">Ready</span>
                                        </h3>
                                        <p className="text-sm font-bold text-white/50 leading-relaxed px-2">
                                            Generating <strong className="text-white">{previewData.matches.length} matches</strong> for <strong className="text-white">{previewData.players.length} players</strong>.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button
                                            onClick={() => setPreviewData(null)}
                                            className="h-12 rounded-xl text-xs font-bold uppercase tracking-wider text-white/40 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                                            Cancel
                                        </button>
                                        <LiquidButton onClick={confirmPreview} variant="primary"
                                            style={{ borderRadius: "0.8rem", padding: "0", fontSize: "0.9rem", height: "3rem" }}>
                                            <span className="font-black">Start Event</span>
                                        </LiquidButton>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )
                }
            </AnimatePresence>
        </>
    );
}
