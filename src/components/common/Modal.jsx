import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import LiquidButton from "./LiquidButton";

export default function Modal({
    show,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirm",
    isDestructive = false,
}) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                    style={{ background: "rgba(3,7,18,0.85)", backdropFilter: "blur(20px)" }}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 16, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.94, opacity: 0 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="w-full p-8 rounded-[2.5rem] text-center relative overflow-hidden"
                        style={{
                            background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            backdropFilter: "blur(40px)",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)"
                        }}
                    >
                        {/* Glass sheen */}
                        <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
                            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)" }} />

                        {/* Icon */}
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 relative z-10"
                            style={isDestructive
                                ? { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.2)", boxShadow: "0 0 20px rgba(239,68,68,0.1)" }
                                : { background: "rgba(255,202,40,0.12)", border: "1px solid rgba(255,202,40,0.2)", boxShadow: "0 0 20px rgba(255,202,40,0.1)" }
                            }>
                            <AlertTriangle size={24} style={{ color: isDestructive ? "#ef4444" : "#FFCA28" }} />
                        </div>

                        <h2 className="text-xl font-black mb-2 uppercase italic tracking-tight text-white relative z-10">
                            {title}
                        </h2>
                        <p className="text-sm mb-8 leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {message}
                        </p>

                        <div className="flex gap-3 relative z-10">
                            <LiquidButton onClick={onCancel} variant="ghost"
                                style={{ flex: 1, borderRadius: "1rem", padding: "1rem" }}>
                                Cancel
                            </LiquidButton>
                            {onConfirm && (
                                <LiquidButton onClick={onConfirm}
                                    variant={isDestructive ? "danger" : "primary"}
                                    style={{ flex: 1, borderRadius: "1rem", padding: "1rem" }}>
                                    {confirmText}
                                </LiquidButton>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
