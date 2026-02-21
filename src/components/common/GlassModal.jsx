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
    React.useEffect(() => {
        if (!isOpen || !onClose) return;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const iconNode = React.isValidElement(icon)
        ? React.cloneElement(icon, { size: 24, className: iconColorClass })
        : icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-[#020617]/72 backdrop-blur-2xl"
                    onClick={onClose || undefined}
                    role="dialog"
                    aria-modal="true"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(event) => event.stopPropagation()}
                        className="w-[92vw] max-w-[420px] rounded-[2rem] relative overflow-hidden flex flex-col border border-white/10"
                        style={{
                            background: "linear-gradient(165deg, rgba(6,10,22,0.96), rgba(3,8,20,0.98) 55%, rgba(10,16,32,0.94))",
                            boxShadow: "0 24px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
                            maxHeight: "88vh",
                        }}
                    >
                        {/* Subtle top glow */}
                        <div className={`absolute top-0 left-0 right-0 h-40 bg-gradient-to-b ${glowClass} pointer-events-none`} />
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent pointer-events-none" />
                        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent pointer-events-none" />

                        {/* Top Right Close Button */}
                        {onClose && (
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                aria-label="Close modal"
                                className="absolute top-3.5 right-3.5 w-9 h-9 flex items-center justify-center rounded-[0.85rem] z-20 transition-colors"
                                style={{
                                    background: "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(2,6,23,0.92))",
                                    border: "1px solid rgba(120,132,156,0.36)",
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 6px 14px rgba(2,6,23,0.45)",
                                    color: "rgba(226,232,240,0.92)",
                                }}
                            >
                                <X size={16} strokeWidth={2.5} />
                            </motion.button>
                        )}

                        <div className="relative z-10 flex flex-col h-full">
                            {/* Centered Header Section */}
                            <div className="flex flex-col items-center text-center space-y-3 px-6 pt-7 pb-4">
                                {icon && (
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${iconBgClass}`}>
                                        {iconNode}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-[21px] font-black uppercase tracking-tight text-white leading-none mb-1.5 flex justify-center items-center gap-2">
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
                                <div className="px-6 pb-4 flex-1 min-h-0 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                                    {children}
                                </div>
                            )}

                            {/* Action Buttons */}
                            {actions && (
                                <div
                                    className="px-6 pb-6 pt-4 mt-auto"
                                    style={{
                                        borderTop: "1px solid rgba(120,132,156,0.2)",
                                        background: "linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.38))",
                                    }}
                                >
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
