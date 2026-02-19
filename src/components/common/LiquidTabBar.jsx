import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";

// ─── constants ───────────────────────────────────────────────────────────────
const DRAG_THRESH = 8;    // px — movement before drag mode activates
const BASE_RADIUS = 18;   // px — pill corners at rest
const LEAD_RADIUS = 7;    // px — leading (pushing) edge during drag
const TRAIL_RADIUS = 28;   // px — larger stretch radius
const SPRING_SNAP = { stiffness: 400, damping: 30, mass: 1 }; // snappy snap
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

    // ── MotionValues for performant animation (no re-renders) ────────────────
    const pillSlot = useSpring(activeIdx, SPRING_SNAP);
    const blobV = useSpring(0, SPRING_BLOB);

    const isDragging = useRef(false);
    const hasCaptured = useRef(false);
    const dragStartSlot = useRef(0);    // value of pillSlot when drag started
    const dragStartX = useRef(0);       // clientX when drag started
    const rawStartX = useRef(0);        // clientX at pointer down
    const lastX = useRef(0);
    const lastT = useRef(0);

    // ── derived transforms ───────────────────────────────────────────────────
    const input = [-1, 0, 1];
    const rtl = useTransform(blobV, input, [`${TRAIL_RADIUS}px`, `${BASE_RADIUS}px`, `${LEAD_RADIUS}px`]);
    const rbl = useTransform(blobV, input, [`${TRAIL_RADIUS}px`, `${BASE_RADIUS}px`, `${LEAD_RADIUS}px`]);
    const rtr = useTransform(blobV, input, [`${LEAD_RADIUS}px`, `${BASE_RADIUS}px`, `${TRAIL_RADIUS}px`]);
    const rbr = useTransform(blobV, input, [`${LEAD_RADIUS}px`, `${BASE_RADIUS}px`, `${TRAIL_RADIUS}px`]);

    const scaleX = useTransform(blobV, input, [1.05, 1, 1.05]);
    const scaleY = useTransform(blobV, input, [0.95, 1, 0.95]);

    // Map slot (0..tabCount-1) to percentage (0%..100% - pillWidth)
    // tabSlotW = 100 / tabCount
    // left = val * tabSlotW
    const tabSlotW = 100 / tabCount;
    const pillLeft = useTransform(pillSlot, val => `${val * tabSlotW}%`);
    const pillWidth = `${tabSlotW}%`;

    // ── sync activeTab prop ──────────────────────────────────────────────────
    useEffect(() => {
        // Only animate to new tab if we aren't currently dragging it
        if (!isDragging.current) {
            pillSlot.set(activeIdx);
        }
    }, [activeIdx, pillSlot]);

    // ── helpers ──────────────────────────────────────────────────────────────
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const snapToInt = (f) => clamp(Math.round(f), 0, tabCount - 1);
    const getRect = () => containerRef.current?.getBoundingClientRect();

    // ── pointer handlers ─────────────────────────────────────────────────────
    const onPointerDown = useCallback((e) => {
        containerRef.current?.setPointerCapture(e.pointerId);
        hasCaptured.current = true;
        isDragging.current = false;

        rawStartX.current = e.clientX;
        lastX.current = e.clientX;
        lastT.current = performance.now();

        // Stop any ongoing spring animation for direct control
        // note: useSpring doesn't have .stop(), strictly speaking, 
        // but setting it to its current value behaves similarly for immediate updates 
        // if we were using a raw MotionValue. 
        // For useSpring, we just let it be, but we'll override via .set() during drag.

        dragStartSlot.current = pillSlot.get();
        blobV.set(0);
    }, [pillSlot, blobV]);

    const onPointerMove = useCallback((e) => {
        if (!hasCaptured.current) return;

        const now = performance.now();
        const dt = now - lastT.current;
        const velocity = dt > 0 ? (e.clientX - lastX.current) / dt : 0;
        lastX.current = e.clientX;
        lastT.current = now;

        const moved = e.clientX - rawStartX.current;

        // Check drag threshold
        if (!isDragging.current) {
            if (Math.abs(moved) > DRAG_THRESH) {
                isDragging.current = true;
                dragStartX.current = e.clientX;
                dragStartSlot.current = pillSlot.get();
            } else {
                return; // Treat as tap preparation, no movement yet
            }
        }

        // ── DRAG LOGIC ──
        const rect = getRect();
        if (!rect) return;

        const pxPerSlot = rect.width / tabCount;
        const deltaSlots = (e.clientX - dragStartX.current) / pxPerSlot;

        // direct set for responsiveness
        const newSlot = clamp(dragStartSlot.current + deltaSlots, 0, tabCount - 1);
        pillSlot.jump(newSlot); // jump() skips spring physics for direct tracking

        // Blob deformation based on velocity
        // normalized relative to standard interaction speed
        blobV.set(clamp(velocity * 4, -1, 1));

    }, [tabCount, pillSlot, blobV]);

    const onPointerUp = useCallback((e) => {
        if (!hasCaptured.current) return;
        hasCaptured.current = false;
        blobV.set(0);

        if (isDragging.current) {
            // Drag end: snap to nearest
            const current = pillSlot.get();
            const snapped = snapToInt(current);
            pillSlot.set(snapped); // Spring to snap
            onChange(tabs[snapped].id);
        } else {
            // Tap: resolve target
            const rect = getRect();
            if (rect) {
                const relativeX = e.clientX - rect.left;
                const clickedSlot = Math.floor((relativeX / rect.width) * tabCount);
                const target = clamp(clickedSlot, 0, tabCount - 1);

                pillSlot.set(target);
                onChange(tabs[target].id);
            }
        }
        isDragging.current = false;
    }, [tabCount, pillSlot, blobV, onChange, tabs]);

    return (
        <div
            ref={containerRef}
            className={`relative flex ${className}`}
            style={{
                borderRadius: "1.5rem", // 24px
                padding: "6px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                // Remove strong glass effects to match input
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
                boxShadow: "none",
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
            onPointerLeave={onPointerUp}
        >
            {/* ── LIQUID GLASS PILL ──────────────────────────────────────────── */}
            <motion.div
                className="absolute pointer-events-none"
                style={{
                    top: 3,
                    bottom: 3,
                    width: `calc(${pillWidth} - 6px)`,
                    left: useTransform(pillLeft, l => `calc(${l} + 3px)`), // Use left directly
                    // x: 0 - removed x transform
                }}
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
                        borderRadius: `${BASE_RADIUS}px`,
                        background: "linear-gradient(135deg, rgba(255, 202, 40, 0.85) 0%, rgba(255, 111, 0, 0.95) 100%)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        boxShadow: "inset 0 1px 0.5px rgba(255,255,255,0.6), inset 0 -2px 1px rgba(0,0,0,0.2), 0 4px 16px rgba(255, 160, 0, 0.5), 0 8px 24px -4px rgba(0,0,0,0.3)",
                    }}
                />
            </motion.div>

            {/* ── TAB LABELS ─────────────────────────────────────────────────── */}
            {tabs.map((tab, idx) => {
                // Determine active state purely for color prop or use text color animation via CSS/Motion
                const isActive = activeIdx === idx;
                return (
                    <div
                        key={tab.id}
                        className="relative z-10 flex flex-1 items-center justify-center gap-1.5"
                        style={{
                            padding: "10px 6px 11px 6px",
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            // We can animate this color too if we want, but simple prop update is usually fine for text
                            color: isActive ? "#0F172A" : "rgba(255,255,255,0.4)",
                            transition: "color 0.2s ease",
                            pointerEvents: "none",
                        }}
                    >
                        {tab.icon && (
                            <span style={{
                                opacity: isActive ? 1 : 0.32,
                                display: "flex",
                                alignItems: "center",
                                flexShrink: 0,
                                transition: "opacity 0.2s ease",
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
