import React from "react";
import { AlertTriangle } from "lucide-react";
import LiquidButton from "./LiquidButton";
import GlassModal from "./GlassModal";

export default function Modal({
    show,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirm",
    isDestructive = false,
}) {
    return (
        <GlassModal
            isOpen={show}
            onClose={onCancel}
            icon={<AlertTriangle />}
            iconColorClass={isDestructive ? "text-red-500" : "text-amber-400"}
            iconBgClass={isDestructive
                ? "bg-gradient-to-br from-red-500/20 to-red-900/10 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                : "bg-gradient-to-br from-amber-400/20 to-orange-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
            }
            glowClass={isDestructive
                ? "from-red-500/10 via-red-500/5 to-transparent"
                : "from-amber-500/10 via-amber-500/5 to-transparent"
            }
            title={title}
            subtitle={message}
            actions={
                <div className="flex gap-3 w-full">
                    <LiquidButton onClick={onCancel} variant="ghost"
                        style={{ flex: 1, borderRadius: "1rem", padding: "1rem" }}>
                        Cancel
                    </LiquidButton>
                    {onConfirm && (
                        <LiquidButton onClick={onConfirm}
                            variant={isDestructive ? "danger" : "primary"}
                            style={{ flex: 1, borderRadius: "1rem", padding: "1rem" }}>
                            {confirmText}
                        </LiquidButton>
                    )}
                </div>
            }
        />
    );
}
