import React from "react";
import { getGradient, getMonogram } from "../../utils/formatting";

const PlayerAvatar = ({
    name,
    className = "",
    label,
    labelLength = 1,
    title,
}) => {
    const fallbackLabel = getMonogram(name, labelLength);
    const content = String(label || fallbackLabel || "?").toUpperCase();
    const compactClass = content.length > 1 ? "text-[0.7em] tracking-[0.05em]" : "";

    return (
        <div
            title={title || name || content}
            className={`relative flex items-center justify-center rounded-full text-white font-black bg-gradient-to-br ${getGradient(
                name
            )} ${className} shadow-[0_0_10px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.3)] ring-1 ring-white/20`}
        >
            <span className={`drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] z-10 ${compactClass}`}>
                {content}
            </span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
        </div>
    );
};

export default PlayerAvatar;
