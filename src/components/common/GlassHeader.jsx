import React from "react";

export default function GlassHeader({ children, className = "", style = {}, innerClassName = "", headerRef = null }) {
    return (
        <div
            ref={headerRef}
            className={`fixed top-0 inset-x-0 z-50 rounded-b-3xl overflow-hidden ${className}`}
            style={{
                background: "rgba(3,7,18,0.72)",
                backdropFilter: "blur(22px) saturate(180%)",
                WebkitBackdropFilter: "blur(22px) saturate(180%)",
                borderBottom: "1px solid rgba(120,132,156,0.22)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.06)",
                ...style,
            }}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                <div className="absolute -top-10 left-1/4 w-44 h-24 rounded-full blur-2xl" style={{ background: "rgba(255,202,40,0.08)" }} />
                <div className="absolute -top-12 right-1/4 w-44 h-24 rounded-full blur-2xl" style={{ background: "rgba(59,130,246,0.1)" }} />
            </div>

            <div className={`relative z-10 ${innerClassName}`}>
                {children}
            </div>
        </div>
    );
}
