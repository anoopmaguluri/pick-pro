import React from "react";
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
                <div className="max-w-md mx-auto h-[100dvh] bg-[#030712] flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                        <AlertTriangle size={40} className="text-red-500" />
                    </div>

                    <h1 className="text-2xl font-black italic uppercase text-white mb-2 tracking-tight">
                        Something <span className="text-red-500">Snapped</span>
                    </h1>

                    <p className="text-sm font-bold text-white/40 leading-relaxed mb-8">
                        The app encountered an unexpected error. This usually happens if the connection drops or data gets corrupted.
                    </p>

                    <LiquidButton
                        onClick={() => window.location.reload()}
                        variant="primary"
                        style={{ width: "100%", padding: "1.2rem", borderRadius: "1rem" }}
                    >
                        <RotateCcw size={18} className="mr-2" />
                        Reload App
                    </LiquidButton>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-4 bg-red-900/10 border border-red-900/20 rounded-xl w-full overflow-hidden">
                            <p className="text-[10px] font-mono text-red-400 text-left line-clamp-4">
                                {this.state.error?.toString()}
                            </p>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
