import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "../../../hooks/useHaptic";
import { Plus, Trash2, UsersRound, UserPlus, Zap, Check, RotateCcw, Shuffle, X } from "lucide-react";
import PlayerAvatar from "../../common/PlayerAvatar";
import LiquidButton from "../../common/LiquidButton";
import LiquidTabBar from "../../common/LiquidTabBar";
import GlassModal from "../../common/GlassModal";


// ── MEMOIZED COMPONENTS ──

const DraftPlayerItem = React.memo(({ p, onRemove }) => (
    <motion.div layout initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="flex justify-between items-center px-3 py-2.5 rounded-xl relative overflow-hidden group"
        style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.2)",
        }}>
        {/* Animated glowing border effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.15), transparent)" }} />

        {/* Neon left accent */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: "linear-gradient(to bottom, #4ade80, #16a34a)", boxShadow: "0 0 12px rgba(74,222,128,0.6)" }} />

        <div className="flex items-center gap-2 pl-2 relative z-10">
            <PlayerAvatar name={p} className="w-7 h-7 text-[9px] ring-2 ring-white/15 shadow-lg" />
            <span className="text-[11px] font-black uppercase tracking-tight text-white truncate max-w-[70px]" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{p}</span>
        </div>
        <button onClick={() => onRemove(p)} style={{ color: "rgba(255,255,255,0.2)" }}
            className="hover:text-red-400 transition-colors p-1">
            <Trash2 size={13} />
        </button>
    </motion.div>
));

const BenchPlayerItem = React.memo(({ p, onAdd }) => (
    <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={() => onAdd(p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase overflow-hidden whitespace-nowrap cursor-pointer hover:text-white transition-all group origin-left"
        style={{
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.5)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)"
        }}
        whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }}
        whileTap={{ scale: 0.95 }}
    >
        <PlayerAvatar name={p} className="w-5 h-5 text-[7px] opacity-60 shrink-0 group-hover:opacity-100 transition-opacity" />
        <span className="group-hover:text-white transition-colors">{p}</span>
        <Plus size={10} className="opacity-40 group-hover:opacity-100 group-hover:text-amber-400 transition-colors" />
    </motion.div>
));

export default function Setup({
    data,
    roster,
    newPlayer,
    setNewPlayer,
    addPlayer,
    toggleDraftPlayer,
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
    const sortedRoster = React.useMemo(() => [...roster].sort(), [roster]);

    // Auto Draft Review State
    const [previewData, setPreviewData] = useState(null);

    // Toast Notification State
    const [toastMsg, setToastMsg] = useState(null);

    // Auto-dismiss toast
    React.useEffect(() => {
        if (!toastMsg) return;
        const timer = setTimeout(() => setToastMsg(null), 1500);
        return () => clearTimeout(timer);
    }, [toastMsg]);

    const draftPlayers = data.draftPlayers || [];

    // Memoize these lists to prevent recalc on every render
    const benchedPlayers = React.useMemo(() =>
        sortedRoster.filter(p => !draftPlayers.includes(p)),
        [sortedRoster, draftPlayers]);

    // Optimize callbacks
    const handleRemove = React.useCallback((p) => {
        triggerHaptic(20);
        toggleDraftPlayer(p, false);
        setToastMsg({ type: 'remove', text: `${p} sent to Bench` });
    }, [toggleDraftPlayer, triggerHaptic]);

    const handleAdd = React.useCallback((p) => {
        triggerHaptic(20);
        toggleDraftPlayer(p, true);
        setToastMsg({ type: 'add', text: `${p} drafted` });
    }, [toggleDraftPlayer, triggerHaptic]);

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

    const availablePlayersForManual = React.useMemo(() =>
        draftPlayers.filter((p) => !manualTeams.some((team) => team.p1 === p || team.p2 === p)),
        [draftPlayers, manualTeams]);

    const glassCard = {
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.07)"
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-5 md:space-y-8 relative z-10 md:p-8">
            {!isManualMode ? (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={benchedPlayers.length > 0 ? "md:grid md:grid-cols-12 md:gap-8 md:items-start space-y-6 md:space-y-0" : "max-w-2xl mx-auto space-y-6"}>

                    {/* LEFT COLUMN: Draft Input & Settings */}
                    <div className={benchedPlayers.length > 0 ? "md:col-span-7 space-y-6 flex flex-col" : "space-y-6 flex flex-col"}>
                        <div className="p-6 rounded-[2rem]" style={glassCard}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 leading-none" style={{ color: "rgba(255,202,40,0.7)" }}>
                                <span>Draft Athletes</span>
                                {draftPlayers.length > 0 && (
                                    <span className="px-2 py-[2px] rounded-full text-[8px] font-black leading-none" style={{ background: "rgba(255,202,40,0.12)", color: "rgba(255,202,40,0.9)" }}>
                                        {draftPlayers.length}
                                    </span>
                                )}
                            </p>

                            <form onSubmit={addPlayer} className="flex gap-2 mb-5 relative">
                                <div className="flex-1 relative">
                                    <div className="absolute inset-0 rounded-xl bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] pointer-events-none" />
                                    <input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} placeholder="Enter name..."
                                        className="w-full relative rounded-xl px-5 py-4 text-sm font-bold text-white outline-none placeholder-white/30 bg-transparent"
                                        style={{ border: "1px solid rgba(255,255,255,0.05)", caretColor: "#FFCA28" }}
                                        onFocus={(e) => e.target.style.borderColor = 'rgba(255,202,40,0.5)'}
                                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'} />
                                    <div className="absolute inset-0 rounded-xl pointer-events-none opacity-20 overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-[200%] animate-[scan_4s_linear_infinite]" />
                                    </div>
                                </div>
                                <button type="submit" className="w-[52px] flex-shrink-0 flex items-center justify-center rounded-xl relative overflow-hidden group transition-transform active:scale-95"
                                    style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,202,40,0.3)" }}>
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-600/20 group-hover:opacity-100 opacity-60 transition-opacity" />
                                    <Plus size={20} className="relative z-10 text-amber-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                                </button>
                            </form>

                            {draftPlayers.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {draftPlayers.map((p) => (
                                            <DraftPlayerItem key={p} p={p} onRemove={handleRemove} />
                                        ))}
                                    </AnimatePresence>
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

                        {/* Format Selection (Inside Left Column) */}
                        {draftPlayers.length >= 4 && (
                            <>
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }} />
                                    <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>Format</span>
                                    <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.08), transparent)" }} />
                                </div>
                                <div className="mb-2">
                                    <LiquidTabBar
                                        tabs={[
                                            { id: "singles", label: "Singles" },
                                            { id: "doubles", label: "Doubles" }
                                        ]}
                                        activeTab={matchFormat} onTabChange={setMatchFormat}
                                        containerStyle={{ background: "rgba(255,255,255,0.03)", backdropFilter: "none", padding: "4px" }}
                                        activeTabStyle={{ background: "rgba(255,255,255,0.1)" }}
                                        inactiveTabStyle={{ color: "rgba(255,255,255,0.4)" }}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <LiquidButton onClick={() => handleAutoDraft(matchFormat)} variant="primary" className="flex-1" style={{ borderRadius: "1rem", padding: "1rem" }}>
                                        <Zap size={16} fill="currentColor" />
                                        <span className="ml-1.5 font-bold">Auto Draft</span>
                                    </LiquidButton>
                                    <LiquidButton onClick={() => setIsManualMode(true)} variant="secondary" className="flex-1" style={{ borderRadius: "1rem", padding: "1rem" }}>
                                        <UsersRound size={16} /> <span className="ml-1.5 font-bold">Manual Teams</span>
                                    </LiquidButton>
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT COLUMN: The Bench */}
                    {benchedPlayers.length > 0 && (
                        <div className="md:col-span-5 md:sticky md:top-[120px]">
                            <div className="p-5 rounded-[2rem] relative overflow-hidden"
                                style={{
                                    background: "rgba(0,0,0,0.2)", // cleaner tray
                                    border: "1px solid rgba(255,255,255,0.03)",
                                    boxShadow: "inset 0 10px 30px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.02)"
                                }}>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
                                <p className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 leading-none" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    <UsersRound size={11} /> The Bench — Tap to Draft
                                    <span className="ml-auto px-2 py-[2px] rounded-full text-[8px] font-black leading-none" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                                        {benchedPlayers.length}
                                    </span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {benchedPlayers.map((p) => (
                                            <BenchPlayerItem key={p} p={p} onAdd={handleAdd} />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-5">
                    <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Manual Team Selection</p>
                        <button onClick={() => setIsManualMode(false)} className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,202,40,0.8)" }}>
                            ← Cancel
                        </button>
                    </div>

                    <div className="md:grid md:grid-cols-12 md:gap-8 md:items-start space-y-5 md:space-y-0">
                        {/* LEFT COLUMN: Available Players */}
                        <div className="md:col-span-6 space-y-3">
                            <p className="text-[9px] font-black uppercase tracking-widest pl-2" style={{ color: "rgba(255,255,255,0.25)" }}>Available Athletes</p>
                            <div className="grid grid-cols-2 gap-3 mb-20 lg:mb-0">
                                {availablePlayersForManual.map((p) => (
                                    <motion.button whileTap={{ scale: 0.93 }} key={p} onClick={() => handleManualSelect(p)}
                                        className="flex items-center gap-2 pl-2 pr-4 py-2 rounded-full font-black text-[11px] uppercase transition-all relative overflow-hidden group"
                                        style={selectedPlayers.includes(p)
                                            ? { background: "linear-gradient(135deg, rgba(255,202,40,0.15), rgba(245,124,0,0.15))", border: "1px solid rgba(255,202,40,0.5)", color: "#FFCA28", boxShadow: "0 0 20px rgba(255,202,40,0.2), inset 0 0 10px rgba(255,202,40,0.1)" }
                                            : { background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" }
                                        }>
                                        {selectedPlayers.includes(p) && <div className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />}
                                        <PlayerAvatar name={p} className={`relative z-10 w-8 h-8 text-[10px] ${selectedPlayers.includes(p) ? "ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "opacity-60 group-hover:opacity-100 transition-opacity"}`} />
                                        <span className="relative z-10">{p}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: The Builder & Completed Teams */}
                        <div className="md:col-span-6 space-y-5 md:sticky md:top-[120px]">
                            <div className="p-4 rounded-[1.5rem]" style={glassCard}>
                                <h3 className="text-[9px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 leading-none" style={{ color: "rgba(255,202,40,0.6)" }}>
                                    <span>Building Team {manualTeams.length + 1}</span>
                                    <span className="px-2 py-[2px] rounded-full text-[8px] leading-none" style={{ background: "rgba(255,202,40,0.1)", color: "rgba(255,202,40,0.7)" }}>{selectedPlayers.length}/2</span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden group"
                                        style={{
                                            background: firstPick ? "rgba(245,158,11,0.15)" : "rgba(0,0,0,0.6)",
                                            border: firstPick ? "1px solid rgba(255,202,40,0.4)" : "1px dashed rgba(255,255,255,0.15)",
                                            boxShadow: firstPick ? "inset 0 0 20px rgba(245,158,11,0.2), 0 0 15px rgba(245,158,11,0.1)" : "inset 0 4px 10px rgba(0,0,0,0.8)",
                                        }}>
                                        {!firstPick && <div className="absolute inset-0 pointer-events-none opacity-30"><div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent animate-[scan_3s_linear_infinite]" /></div>}
                                        {firstPick ? (
                                            <motion.div layoutId="pick1" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                                <PlayerAvatar name={firstPick} className="w-6 h-6 text-[8px] ring-1 ring-amber-400/30" />{firstPick}
                                            </motion.div>
                                        ) : (
                                            <span className="text-white/15 text-[10px] font-black uppercase tracking-widest">Player 1</span>
                                        )}
                                    </div>
                                    <div className="text-white/15 font-black text-xs">+</div>
                                    <div className="flex-1 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden group"
                                        style={{
                                            background: secondPick ? "rgba(245,158,11,0.15)" : "rgba(0,0,0,0.6)",
                                            border: secondPick ? "1px solid rgba(255,202,40,0.4)" : "1px dashed rgba(255,255,255,0.15)",
                                            boxShadow: secondPick ? "inset 0 0 20px rgba(245,158,11,0.2), 0 0 15px rgba(245,158,11,0.1)" : "inset 0 4px 10px rgba(0,0,0,0.8)",
                                        }}>
                                        {!secondPick && firstPick && <div className="absolute inset-0 pointer-events-none opacity-30"><div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent animate-[scan_3s_linear_infinite]" /></div>}
                                        {secondPick ? (
                                            <motion.div layoutId="pick2" className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs">
                                                <PlayerAvatar name={secondPick} className="w-6 h-6 text-[8px] ring-1 ring-amber-400/30" />{secondPick}
                                            </motion.div>
                                        ) : (
                                            <span className="text-white/15 text-[10px] font-black uppercase tracking-widest">Player 2</span>
                                        )}
                                    </div>
                                    {selectedPlayers.length > 0 && (
                                        <motion.button whileTap={{ scale: 0.9 }} onClick={handleManualUndo} className="h-14 w-14 rounded-2xl flex items-center justify-center"
                                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.6)", boxShadow: "0 0 12px rgba(239,68,68,0.08)" }}>
                                            <RotateCcw size={18} />
                                        </motion.button>
                                    )}
                                </div>
                            </div>

                            {manualTeams.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-[9px] font-black uppercase tracking-widest pl-1 flex items-center gap-2 leading-none" style={{ color: "rgba(255,255,255,0.25)" }}>
                                        Ready for Battle
                                        <span className="px-2 py-[2px] rounded-full text-[8px] font-black leading-none" style={{ background: "rgba(34,197,94,0.1)", color: "rgba(34,197,94,0.7)" }}>{manualTeams.length}</span>
                                    </h3>
                                    <div className="space-y-2">
                                        <AnimatePresence initial={false}>
                                            {manualTeams.map((t, i) => (
                                                <motion.div key={i} layout initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                                    className="flex items-center justify-between p-3 rounded-xl relative overflow-hidden"
                                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                                                            style={{ background: "linear-gradient(135deg, rgba(255,202,40,0.2), rgba(245,124,0,0.15))", border: "1px solid rgba(255,202,40,0.2)", color: "rgba(255,202,40,0.9)" }}>
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex -space-x-1.5">
                                                                <PlayerAvatar name={t.p1} className="w-6 h-6 text-[8px] ring-1 ring-white/10 z-10" />
                                                                <PlayerAvatar name={t.p2} className="w-6 h-6 text-[8px] ring-1 ring-white/10 z-0" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-white/80 uppercase">
                                                                <span>{t.p1}</span> <span className="text-white/15">+</span> <span>{t.p2}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeManualTeam(i)} className="p-2 text-white/20 hover:text-red-400 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}

                            {manualTeams.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center gap-2 py-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                            {manualTeams.length} {manualTeams.length === 1 ? "team" : "teams"} ready
                                            {availablePlayersForManual.length > 0 && (
                                                <> · {availablePlayersForManual.length} {availablePlayersForManual.length === 1 ? "player" : "players"} remaining</>
                                            )}
                                        </span>
                                    </div>
                                    {availablePlayersForManual.length < 2 && (
                                        <LiquidButton onClick={() => handleFormatSelection(manualTeams)} variant="primary" style={{ width: "100%", padding: "1.2rem", borderRadius: "1rem", fontSize: "0.8rem" }}>
                                            ⚡ Start Matches
                                        </LiquidButton>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* PREVIEW MODAL */}
            {/* PREVIEW MODAL */}
            <GlassModal
                isOpen={!!previewData}
                onClose={() => setPreviewData(null)}
                icon={<Zap />}
                title={
                    <>
                        {previewData?.format === "singles" ? "Singles" : "Doubles"}
                        <span className="px-1.5 py-[2px] rounded text-[8px] font-black tracking-widest bg-amber-500/20 text-amber-400 uppercase border border-amber-500/20 ml-2">
                            Ready
                        </span>
                    </>
                }
                subtitle={
                    previewData ? (
                        <>
                            Generating <strong className="text-white/80">{previewData.matches.length} matches</strong> for <strong className="text-white/80">{previewData.players.length} players</strong>.
                        </>
                    ) : null
                }
                actions={
                    <div className="flex gap-2 w-full pt-1">
                        <button onClick={() => handleAutoDraft(matchFormat)}
                            className="w-14 shrink-0 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 transition-colors group"
                            title="Regenerate Teams"
                        >
                            <Shuffle size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                        <LiquidButton onClick={confirmPreview} variant="primary" style={{ flex: 1, borderRadius: "1rem", padding: "1.1rem", fontSize: "0.9rem" }}>
                            <span className="font-black">Start Event</span>
                        </LiquidButton>
                    </div>
                }
            >
                {/* GENERATED TEAMS REVIEW LIST */}
                {previewData?.teams && previewData.teams.length > 0 && (
                    <div className="mt-2 text-left">
                        <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 pl-1 flex items-center justify-between">
                            <span>Generated Teams</span>
                            <span>{previewData.teams.length} total</span>
                        </div>
                        <div className="space-y-2 pr-1">
                            {previewData.teams.map((team, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-black text-white/40 shrink-0">
                                        {idx + 1}
                                    </div>
                                    <span className="text-[11px] font-black text-white uppercase tracking-wider truncate flex-1 flex items-center gap-1.5">
                                        {team.p1} <span className="text-white/20 text-[9px]">AND</span> {team.p2}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </GlassModal>

            {/* FLOATING TOAST NOTIFICATION */}
            <AnimatePresence>
                {toastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="fixed bottom-32 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-full flex items-center gap-2 pointer-events-none"
                        style={{
                            background: "rgba(3,7,18,0.85)",
                            backdropFilter: "blur(20px)",
                            border: `1px solid ${toastMsg.type === 'add' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                            boxShadow: `0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 20px ${toastMsg.type === 'add' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)'}`
                        }}
                    >
                        {toastMsg.type === 'add' ? (
                            <Check size={14} className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                        ) : (
                            <RotateCcw size={14} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                        )}
                        <span className="text-[11px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                            {toastMsg.text}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
