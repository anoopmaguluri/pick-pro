import React, { useRef, useCallback } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

// ─── shared motion config ─────────────────────────────────────────────────────
const SPRING_PRESS = { type: "spring", stiffness: 300, damping: 20, mass: 1 };
const SPRING_BLOB = { stiffness: 200, damping: 15, mass: 1 };

// ─── variant palette ──────────────────────────────────────────────────────────
const VARIANTS = {
    primary: {
        backgroundSize: "200% 200%",
        backgroundImage: "linear-gradient(135deg, rgba(255,202,40,0.95) 0%, rgba(245,124,0,0.96) 48%, rgba(255,202,40,0.95) 100%)",
        animation: "liquidShift 3.5s ease infinite",
        color: "#030712",
        border: "1px solid rgba(255,202,40,0.52)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35), 0 0 24px rgba(255,202,40,0.24)",
    },
    secondary: {
        background: "linear-gradient(145deg, rgba(255,202,40,0.2), rgba(245,124,0,0.12))",
        border: "1px solid rgba(255,202,40,0.28)",
        color: "rgba(255,248,225,0.95)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 20px rgba(255,202,40,0.14)",
    },
    ghost: {
        background: "rgba(2,6,23,0.52)",
        border: "1px solid rgba(255,202,40,0.18)",
        color: "rgba(255,255,255,0.78)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px rgba(0,0,0,0.26)",
    },
    danger: {
        background: "linear-gradient(145deg, rgba(239,68,68,0.28), rgba(185,28,28,0.2))",
        border: "1px solid rgba(248,113,113,0.35)",
        color: "rgba(254,226,226,0.95)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 20px rgba(248,113,113,0.2)",
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
    glossy = false,
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
            className={`liquid-btn neo-btn ${variant === "primary" ? "liquid-btn-primary" : ""} ${disabled ? "opacity-30 cursor-not-allowed" : ""} ${className}`}
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
                    zIndex: 0,
                }} />
            )}
            {glossy && <span aria-hidden className="neo-gloss-sweep" style={{ zIndex: 0 }} />}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {children}
            </span>
        </motion.button>
    );
}
