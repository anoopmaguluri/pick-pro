import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

// ─── constants ───────────────────────────────────────────────────────────────
const PILL_INSET = 4;    // px — gap between pill and container edge
const DRAG_THRESH = 8;    // px — movement before drag mode activates
const TAP_MAX_MS = 250;  // ms — pointer-down duration treated as a tap
// Pill corner radii — rest matches container (1.5rem=24px) minus padding (5px)
const BASE_RADIUS = 19;   // px — pill corners at rest  (= 24 - 5)
const LEAD_RADIUS = 7;    // px — leading (pushing) edge during drag
const TRAIL_RADIUS = 28;   // px — larger stretch radius
const SPRING_SNAP = { type: "spring", stiffness: 220, damping: 25, mass: 1 }; // softer snap
const SPRING_BLOB = { stiffness: 180, damping: 18, mass: 1 }; // very fluid blob
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LiquidTabBar — iOS 26-style pill tab bar.
 *
 * Tap   → pill springs to tapped tab
 * Drag  → pill tracks finger RELATIVE to drag-start position (no jump),
 *          with fluid edge morphing: leading edge flattens, trailing edge bulges
 * Release → spring-snaps to nearest tab
 *
 * @param {{ id: string, label: string, icon?: React.ReactNode }[]} tabs
 * @param {string}   activeTab
 * @param {Function} onChange  — (id: string) => void
 */
export default function LiquidTabBar({
    tabs,
    activeTab,
    onChange,
    className = "",
    style = {},
}) {
    const containerRef = useRef(null);
    const tabCount = tabs.length;
    const activeIdx = Math.max(0, tabs.findIndex((t) => t.id === activeTab));

    // Continuous pill slot (float 0 .. tabCount-1) — drives pill's CSS calc left
    const [pillSlot, setPillSlot] = useState(activeIdx);
    const pillSlotRef = useRef(activeIdx);           // always current value for drag math

    const isDragging = useRef(false);
    const isPointerDown = useRef(false);
    const pointerDownT = useRef(0);
    const capturedId = useRef(null);

    // Relative drag tracking — avoids the left→right jump
    const dragStartSlot = useRef(0);    // pillSlot at the moment drag begins
    const dragStartX = useRef(0);    // clientX at the moment drag begins (after threshold)
    const rawStartX = useRef(0);    // clientX at pointerDown (for threshold check)

    // Velocity tracking for blob spring
    const lastX = useRef(0);
    const lastT = useRef(0);
    const rawVel = useRef(0);

    const [dragging, setDragging] = useState(false);

    // ── sync when external activeTab changes (not mid-drag) ─────────────────
    useEffect(() => {
        if (!isDragging.current) {
            setPillSlot(activeIdx);
            pillSlotRef.current = activeIdx;
        }
    }, [activeIdx]);

    // ── blob spring: velocity → per-corner border-radius morph ──────────────
    const blobV = useSpring(0, SPRING_BLOB);

    // Leading corners flatten, trailing corners bulge
    const rtl = useTransform(blobV, [-1, 0, 1], [`${TRAIL_RADIUS}px`, `${BASE_RADIUS}px`, `${LEAD_RADIUS}px`]);
    const rbl = useTransform(blobV, [-1, 0, 1], [`${TRAIL_RADIUS}px`, `${BASE_RADIUS}px`, `${LEAD_RADIUS}px`]);
    const rtr = useTransform(blobV, [-1, 0, 1], [`${LEAD_RADIUS}px`, `${BASE_RADIUS}px`, `${TRAIL_RADIUS}px`]);
    const rbr = useTransform(blobV, [-1, 0, 1], [`${LEAD_RADIUS}px`, `${BASE_RADIUS}px`, `${TRAIL_RADIUS}px`]);

    // Squeeze / Stretch (X stretches, Y squeezes on movement)
    const scaleX = useTransform(blobV, [-1, 0, 1], [1.05, 1, 1.05]);
    const scaleY = useTransform(blobV, [-1, 0, 1], [0.95, 1, 0.95]);

    // ── helpers ──────────────────────────────────────────────────────────────
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const snapToInt = (f) => clamp(Math.round(f), 0, tabCount - 1);

    const getRect = () => containerRef.current?.getBoundingClientRect();
    const tabSlotPxFrom = (rect) => rect.width / tabCount;

    /** Absolute clientX → float slot index  (used only for TAP resolution) */
    const absoluteSlot = useCallback((clientX, rect) => {
        const raw = (clientX - rect.left) / rect.width * tabCount;
        return clamp(raw, 0, tabCount - 1);
    }, [tabCount]);

    // ── pointer handlers ─────────────────────────────────────────────────────
    const onPointerDown = useCallback((e) => {
        containerRef.current?.setPointerCapture(e.pointerId);
        capturedId.current = e.pointerId;
        isPointerDown.current = true;
        isDragging.current = false;
        rawStartX.current = e.clientX;
        lastX.current = e.clientX;
        lastT.current = performance.now();
        pointerDownT.current = performance.now();
        rawVel.current = 0;

        setDragging(false);
        blobV.set(0);
    }, [blobV]);

    const onPointerMove = useCallback((e) => {
        if (!isPointerDown.current || e.pointerId !== capturedId.current) return;

        // Velocity for blob
        const now = performance.now();
        const dt = now - lastT.current;
        if (dt > 0) rawVel.current = (e.clientX - lastX.current) / dt;
        lastX.current = e.clientX;
        lastT.current = now;

        const moved = e.clientX - rawStartX.current;

        if (!isDragging.current) {
            // Not yet dragging — wait for threshold
            if (Math.abs(moved) < DRAG_THRESH) return;

            // ─── DRAG ACTIVATED ───────────────────────────────────────────
            // Record the exact pill slot and pointer X at this moment.
            // All subsequent movement is relative to HERE — no jump.
            isDragging.current = true;
            dragStartSlot.current = pillSlotRef.current;
            dragStartX.current = e.clientX;
            setDragging(true);
        }

        // ── relative drag tracking ─────────────────────────────────────────
        const rect = getRect();
        if (!rect) return;
        const tabSlotPx = tabSlotPxFrom(rect);
        const deltaSlot = (e.clientX - dragStartX.current) / tabSlotPx;
        const newSlot = clamp(dragStartSlot.current + deltaSlot, 0, tabCount - 1);

        setPillSlot(newSlot);
        pillSlotRef.current = newSlot;

        // Drive blob spring from normalised velocity
        blobV.set(clamp(rawVel.current * 8, -1, 1));
    }, [tabCount, blobV]);

    const onPointerUp = useCallback((e) => {
        if (e.pointerId !== capturedId.current) return;

        isPointerDown.current = false;

        if (isDragging.current) {
            // Snap to nearest tab
            const snapped = snapToInt(pillSlotRef.current);
            setPillSlot(snapped);
            pillSlotRef.current = snapped;
            onChange(tabs[snapped].id);
        } else {
            // ── TAP: use clientX to decide which tab was tapped ──────────
            // Use whole-container zone hit-test, not the pill position.
            const rect = getRect();
            if (rect) {
                const slot = absoluteSlot(e.clientX, rect);
                const snapped = snapToInt(slot);
                setPillSlot(snapped);
                pillSlotRef.current = snapped;
                onChange(tabs[snapped].id);
            }
        }

        isDragging.current = false;
        setDragging(false);
        blobV.set(0);
    }, [tabs, onChange, absoluteSlot, blobV]);

    // ── render ───────────────────────────────────────────────────────────────
    const tabSlotW = 100 / tabCount;
    const pillLeft = `calc(${pillSlot * tabSlotW}% + ${PILL_INSET}px)`;
    const pillW = `calc(${tabSlotW}% - ${PILL_INSET * 2}px)`;

    return (
        <div
            ref={containerRef}
            className={`relative flex ${className}`}
            style={{
                borderRadius: "1.5rem",
                padding: "5px",
                background: "rgba(0, 0, 0, 0.2)", // Dark glass container
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "none",
                cursor: "pointer",
                ...style,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            {/* ── LIQUID GLASS PILL ──────────────────────────────────────────── */}
            <motion.div
                className="absolute top-[3px] bottom-[3px] pointer-events-none"
                style={{ width: pillW }}
                animate={{ left: pillLeft }}
                transition={dragging ? { duration: 0 } : SPRING_SNAP}
            >
                <motion.div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderTopLeftRadius: rtl,
                        borderBottomLeftRadius: rbl,
                        borderTopRightRadius: rtr,
                        borderBottomRightRadius: rbr,
                        scaleX,
                        scaleY,
                        borderRadius: "9999px", // pill shape
                        background: "linear-gradient(135deg, rgba(255, 202, 40, 0.85) 0%, rgba(255, 111, 0, 0.95) 100%)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        boxShadow: [
                            "inset 0 1px 0.5px rgba(255,255,255,0.6)", // sharp top rim
                            "inset 0 -2px 1px rgba(0,0,0,0.2)",       // deep bottom
                            "0 4px 16px rgba(255, 160, 0, 0.5)",      // glow
                            "0 8px 24px -4px rgba(0,0,0,0.3)"         // drop shadow
                        ].join(", "),
                    }}
                />
            </motion.div>

            {/* ── TAB LABELS ─────────────────────────────────────────────────── */}
            {tabs.map((tab, idx) => {
                const isActive = Math.round(pillSlot) === idx;
                return (
                    <div
                        key={tab.id}
                        className="relative z-10 flex flex-1 items-center justify-center gap-1.5"
                        style={{
                            padding: "10px 6px",
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: "0.6rem",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: isActive ? "#0F172A" : "rgba(255,255,255,0.4)",
                            textShadow: "none",
                            transition: "color 0.28s ease, text-shadow 0.28s ease",
                            pointerEvents: "none",
                        }}
                    >
                        {tab.icon && (
                            <span style={{
                                opacity: isActive ? 1 : 0.32,
                                display: "flex",
                                alignItems: "center",
                                flexShrink: 0,
                                transition: "opacity 0.28s ease",
                            }}>
                                {tab.icon}
                            </span>
                        )}
                        {tab.label}
                    </div>
                );
            })}
        </div>
    );
}
