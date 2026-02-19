import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "../../../hooks/useHaptic";
import { Plus, Trash2, UsersRound, Zap, Check, RotateCcw, Shuffle, X } from "lucide-react";
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

    // --- ANIMATION VARIANTS ---
    const listVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.03 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 }
    };

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
                            <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: "rgba(255,202,40,0.7)" }}>
                                Draft Athletes
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
                                <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                                    {draftPlayers.map((p) => (
                                        <motion.div layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={p}
                                            className="flex justify-between items-center px-3 py-2 rounded-xl"
                                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                            <div className="flex items-center gap-2">
                                                <PlayerAvatar name={p} className="w-6 h-6 text-[8px]" />
                                                <span className="text-[10px] font-black uppercase tracking-tight text-white truncate max-w-[60px]">{p}</span>
                                            </div>
                                            <button onClick={() => toggleDraftPlayer(p, false)} style={{ color: "rgba(255,255,255,0.2)" }}
                                                className="hover:text-red-400 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Draft is empty</p>
                                </div>
                            )}
                        </div>

                        {/* The Bench */}
                        {benchedPlayers.length > 0 && (
                            <div className="p-5 rounded-[2rem]" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    <UsersRound size={11} /> The Bench — Tap to Draft
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {/* Removed AnimatePresence to fix layout jank */}
                                    {benchedPlayers.map((p) => (
                                        <motion.button
                                            layout="position"
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            key={p} onClick={() => toggleDraftPlayer(p, true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all"
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                                            <PlayerAvatar name={p} className="w-5 h-5 text-[7px] grayscale opacity-50" />
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
                                {/* Format Toggle - LiquidTabBar */}
                                <div className="mb-4">
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
                        <div className="mb-6">
                            <h3 className="text-white/40 font-black text-[10px] uppercase tracking-widest pl-1 mb-3">
                                Building Team {manualTeams.length + 1}
                            </h3>

                            <div className="flex items-center gap-2">
                                {/* Slot 1 */}
                                <div className={`flex-1 h-14 rounded-2xl flex items-center justify-center border transition-all relative overflow-hidden ${firstPick ? "bg-amber-500/20 border-amber-500/30" : "bg-white/5 border-white/10"}`}>
                                    {firstPick ? (
                                        <motion.div layoutId="pick1" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                            <PlayerAvatar name={firstPick} className="w-6 h-6 text-[8px]" />
                                            {firstPick}
                                        </motion.div>
                                    ) : (
                                        <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">Player 1</span>
                                    )}
                                </div>

                                <div className="text-white/20 font-black text-xs">+</div>

                                {/* Slot 2 */}
                                <div className={`flex-1 h-14 rounded-2xl flex items-center justify-center border transition-all relative overflow-hidden ${secondPick ? "bg-amber-500/20 border-amber-500/30" : "bg-white/5 border-white/10"}`}>
                                    {secondPick ? (
                                        <motion.div layoutId="pick2" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                            <PlayerAvatar name={secondPick} className="w-6 h-6 text-[8px]" />
                                            {secondPick}
                                        </motion.div>
                                    ) : (
                                        <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">Player 2</span>
                                    )}
                                </div>

                                {/* Undo Button - Always visible if selection exists */}
                                {selectedPlayers.length > 0 && (
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleManualUndo}
                                        className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                        <RotateCcw size={18} />
                                    </motion.button>
                                )}
                            </div>
                        </div>

                        {/* Completed Teams List */}
                        {manualTeams.length > 0 && (
                            <div className="mb-6 space-y-2">
                                <h3 className="text-white/40 font-black text-[10px] uppercase tracking-widest pl-1">
                                    Ready for Battle
                                </h3>
                                <div className="space-y-2">
                                    {manualTeams.map((t, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-white/30">#{i + 1}</span>
                                                <div className="flex items-center gap-2 text-xs font-bold text-white/80 uppercase">
                                                    <span>{t.p1}</span>
                                                    <span className="text-white/20">+</span>
                                                    <span>{t.p2}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => removeManualTeam(i)} className="p-2 text-white/20 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 mb-20">
                            {availablePlayersForManual.map((p) => (
                                <motion.button whileTap={{ scale: 0.93 }} key={p} onClick={() => handleManualSelect(p)}
                                    className="flex items-center gap-2 pl-2 pr-4 py-2 rounded-full font-black text-[11px] uppercase transition-all"
                                    style={selectedPlayers.includes(p)
                                        ? { background: "linear-gradient(135deg, #FFCA28, #F57C00)", color: "#030712", boxShadow: "0 4px 14px rgba(255,202,40,0.3)" }
                                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }
                                    }>
                                    <PlayerAvatar name={p} className="w-8 h-8 text-[10px]" />
                                    {p}
                                </motion.button>
                            ))}
                        </div>

                        {availablePlayersForManual.length < 2 && manualTeams.length > 0 && (
                            <LiquidButton onClick={() => handleFormatSelection(manualTeams)} variant="primary"
                                style={{ width: "100%", padding: "1.2rem", borderRadius: "1rem", fontSize: "0.8rem" }}>
                                ⚡ Start Matches
                            </LiquidButton>
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
            </AnimatePresence >
        </>
    );
}
