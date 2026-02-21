import React from "react";

export default function GlassHeader({
    children,
    className = "",
    style = {},
    innerClassName = "",
    headerRef = null,
    clarity = "glass",
    showAmbient = true,
}) {
    const isIOSWebKit = React.useMemo(() => {
        if (typeof navigator === "undefined") return false;
        const ua = navigator.userAgent || "";
        const isiOSDevice = /iP(hone|ad|od)/i.test(ua);
        const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
        return isiOSDevice || isTouchMac;
    }, []);
    const isSolid = clarity === "solid";

    return (
        <div
            ref={headerRef}
            className={`fixed top-0 inset-x-0 z-50 rounded-b-3xl overflow-hidden ${className}`}
            style={{
                background: isSolid
                    ? "linear-gradient(180deg, rgba(3,7,18,0.97) 0%, rgba(3,7,18,0.95) 65%, rgba(3,7,18,0.92) 100%)"
                    : "rgba(3,7,18,0.72)",
                backdropFilter: isSolid ? "none" : (isIOSWebKit ? "none" : "blur(22px) saturate(180%)"),
                WebkitBackdropFilter: isSolid ? "none" : (isIOSWebKit ? "none" : "blur(22px) saturate(180%)"),
                borderBottom: isSolid ? "1px solid rgba(120,132,156,0.34)" : "1px solid rgba(120,132,156,0.22)",
                boxShadow: isSolid
                    ? "0 12px 30px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.07)"
                    : (isIOSWebKit
                        ? "0 6px 20px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)"
                        : "0 8px 28px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.06)"),
                ...style,
            }}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                {showAmbient && (
                    <>
                        <div className="absolute -top-10 left-1/4 w-44 h-24 rounded-full blur-2xl" style={{ background: "rgba(255,202,40,0.08)" }} />
                        <div className="absolute -top-12 right-1/4 w-44 h-24 rounded-full blur-2xl" style={{ background: "rgba(59,130,246,0.1)" }} />
                    </>
                )}
            </div>

            <div className={`relative z-10 ${innerClassName}`}>
                {children}
            </div>
        </div>
    );
}
