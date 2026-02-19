import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * A highly polished, reusable modal component enforcing the Next-Gen aesthetic.
 * Features: Deep backdrop blur, subtle top glow, centered icon & title, and uniform spacing.
 *
 * @param {boolean} isOpen - Controls visibility and AnimatePresence
 * @param {function} onClose - Triggered by the top-right X or backdrop click
 * @param {ReactNode} icon - SVG/Lucide icon to center above the title
 * @param {string} title - The main heading text
 * @param {ReactNode|string} subtitle - Optional secondary text below the title
 * @param {ReactNode} children - The main content of the modal (e.g., lists, form inputs)
 * @param {ReactNode} actions - The bottom row of buttons
 * @param {string} iconColorClass - Tailwind color class for the icon (default: "text-amber-400")
 * @param {string} iconBgClass - Tailwind compound class for the icon's background/glow (default: amber gradient)
 */
export default function GlassModal({
    isOpen,
    onClose,
    icon,
    title,
    subtitle,
    children,
    actions,
    iconColorClass = "text-amber-400",
    iconBgClass = "bg-gradient-to-br from-amber-400/20 to-orange-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    glowClass = "from-amber-500/10 via-amber-500/5 to-transparent"
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="w-[85vw] max-w-sm bg-[#050814]/90 border border-white/10 rounded-[2rem] p-6 relative overflow-hidden flex flex-col"
                        style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)", maxHeight: "90vh" }}
                    >
                        {/* Subtle top glow */}
                        <div className={`absolute top-0 left-0 right-0 h-40 bg-gradient-to-b ${glowClass} pointer-events-none`} />

                        {/* Top Right Close Button */}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors z-20"
                            >
                                <X size={14} />
                            </button>
                        )}

                        <div className="relative z-10 flex flex-col h-full space-y-5">
                            {/* Centered Header Section */}
                            <div className="flex flex-col items-center text-center space-y-3 pt-2">
                                {icon && (
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${iconBgClass}`}>
                                        {React.cloneElement(icon, { size: 24, className: iconColorClass, fill: "currentColor" })}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-[22px] font-black uppercase tracking-tight text-white leading-none mb-1.5 flex justify-center items-center gap-2">
                                        {title}
                                    </h3>
                                    {subtitle && (
                                        <div className="text-[11px] font-bold text-white/40 leading-relaxed px-4">
                                            {subtitle}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Flexible Content Area (Scrollable if needed) */}
                            {children && (
                                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                                    {children}
                                </div>
                            )}

                            {/* Sticky Action Buttons */}
                            {actions && (
                                <div className="pt-2 mt-auto">
                                    {actions}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
