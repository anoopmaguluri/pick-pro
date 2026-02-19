import React, { useRef, useCallback } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

// ─── shared motion config ─────────────────────────────────────────────────────
const SPRING_PRESS = { type: "spring", stiffness: 300, damping: 20, mass: 1 };
const SPRING_BLOB = { stiffness: 200, damping: 15, mass: 1 };

// ─── variant palette ──────────────────────────────────────────────────────────
const VARIANTS = {
    primary: {
        backgroundSize: "200% 200%",
        backgroundImage: "linear-gradient(135deg, #FFCA28 0%, #FF6F00 50%, #FFCA28 100%)",
        animation: "liquidShift 3.5s ease infinite",
        color: "#030712",
        boxShadow: "0 8px 32px -6px rgba(255,160,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.1)",
    },
    secondary: {
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.13)",
        color: "rgba(255,255,255,0.9)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)",
    },
    ghost: {
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.5)",
    },
    danger: {
        background: "linear-gradient(135deg, #dc2626, #ef4444)",
        color: "white",
        boxShadow: "0 4px 20px rgba(239,68,68,0.3)",
    },
};

/**
 * LiquidButton
 *
 * Press feel: uniform symmetric squeeze (scaleX + scaleY) with a single
 * borderRadius spring — no asymmetric per-corner morphing that creates
 * uneven side edges on the pill.
 */
export default function LiquidButton({
    children,
    onClick,
    variant = "primary",
    className = "",
    style = {},
    disabled = false,
    ...rest
}) {
    const btnRef = useRef(null);

    // ── uniform blob spring (0 = rest, 1 = pressed) ──────────────────────────
    const blobV = useSpring(0, SPRING_BLOB);

    // Symmetric squeeze — all four corners stay equal, no side-edge weirdness
    const scaleX = useTransform(blobV, [0, 1], [1, 0.94]);
    const scaleY = useTransform(blobV, [0, 1], [1, 1.05]);
    const borderRadius = useTransform(blobV, [0, 1], ["1rem", "1.6rem"]);

    // ── CSS ripple at exact touch point ──────────────────────────────────────
    const spawnRipple = useCallback((e) => {
        const btn = btnRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left;
        const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top;
        const size = Math.max(rect.width, rect.height) * 1.6;
        const ripple = document.createElement("span");
        ripple.className = "liquid-ripple";
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px;`;
        btn.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    }, []);

    const handlePointerDown = useCallback((e) => {
        if (disabled) return;
        blobV.set(1);
        spawnRipple(e);
    }, [disabled, blobV, spawnRipple]);

    const handlePointerUp = useCallback(() => {
        blobV.set(0);
    }, [blobV]);

    return (
        <motion.button
            ref={btnRef}
            onPointerDown={!disabled ? handlePointerDown : undefined}
            onPointerUp={!disabled ? handlePointerUp : undefined}
            onPointerLeave={!disabled ? handlePointerUp : undefined}
            onClick={!disabled ? onClick : undefined}
            disabled={disabled}
            whileHover={!disabled ? { scale: 1.025 } : {}}
            transition={SPRING_PRESS}
            className={`liquid-btn ${variant === "primary" ? "liquid-btn-primary" : ""} ${disabled ? "opacity-30 cursor-not-allowed" : ""} ${className}`}
            style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontSize: "0.62rem",
                padding: "0.85rem 1.5rem",
                border: "none",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                scaleX,
                scaleY,
                borderRadius,
                ...VARIANTS[variant],
                ...style,
            }}
            {...rest}
        >
            {variant === "primary" && (
                <span aria-hidden style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 60%)", // brighter gloss
                    pointerEvents: "none",
                }} />
            )}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {children}
            </span>
        </motion.button>
    );
}
