import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw } from "lucide-react";
import LiquidButton from "./LiquidButton";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="w-full max-w-5xl mx-auto h-[100dvh] relative overflow-hidden flex items-center justify-center px-5"
                    style={{ background: "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 80% 80%, rgba(236,72,153,0.08) 0%, transparent 50%), #030712" }}
                >
                    <div className="absolute top-16 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(99,102,241,0.14)" }} />
                    <div className="absolute bottom-16 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(236,72,153,0.12)" }} />

                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="w-full max-w-md rounded-[2rem] border border-white/10 relative overflow-hidden p-6 text-center"
                        style={{
                            background: "linear-gradient(165deg, rgba(6,10,22,0.96), rgba(3,8,20,0.98) 55%, rgba(10,16,32,0.94))",
                            boxShadow: "0 24px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
                        }}
                    >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-40 h-20 rounded-full blur-2xl" style={{ background: "rgba(239,68,68,0.14)" }} />
                        </div>

                        <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-5 border border-red-500/25 shadow-[0_0_30px_rgba(239,68,68,0.12)]">
                            <AlertTriangle size={34} className="text-red-400" />
                        </div>

                        <h1 className="text-2xl font-black uppercase text-white tracking-tight">
                            Something Went Wrong
                        </h1>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-300/80 mt-1">
                            Error State
                        </p>

                        <p className="text-sm font-bold text-white/45 leading-relaxed mt-4">
                            The app hit an unexpected issue. Reload to recover and continue the tournament.
                        </p>

                        <div className="mt-6 grid grid-cols-1 gap-3">
                            <LiquidButton
                                onClick={() => window.location.reload()}
                                variant="primary"
                                style={{ width: "100%", padding: "1rem", borderRadius: "1rem", fontSize: "0.72rem", letterSpacing: "0.12em" }}
                            >
                                <RotateCcw size={16} className="mr-1" />
                                Reload App
                            </LiquidButton>
                        </div>

                        {import.meta.env.DEV && (
                            <div className="mt-6 p-3 bg-red-900/10 border border-red-900/25 rounded-xl w-full overflow-hidden">
                                <p className="text-[10px] font-mono text-red-300/90 text-left line-clamp-4">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </motion.div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
