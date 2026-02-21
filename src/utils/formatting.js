// --- PREMIUM UI HELPERS ---
export const avatarGradients = [
    "from-pink-500 to-rose-600",
    "from-violet-500 to-indigo-600",
    "from-blue-400 to-cyan-600",
    "from-teal-400 to-emerald-600",
    "from-amber-400 to-orange-600",
    "from-red-500 to-red-700",
    "from-fuchsia-500 to-purple-700",
    "from-sky-400 to-blue-700",
    "from-lime-400 to-green-700",
    "from-yellow-400 to-amber-600",
    "from-emerald-400 to-teal-700",
    "from-cyan-400 to-sky-600",
    "from-purple-500 to-pink-600",
    "from-rose-400 to-red-600",
    "from-orange-500 to-red-600",
];

export const getGradient = (name) => {
    if (!name) return avatarGradients[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = name.charCodeAt(i) + ((hash << 5) - hash) + name.charCodeAt(0) * 13;
    return avatarGradients[Math.abs(hash) % avatarGradients.length];
};

export const getMonogram = (name, maxChars = 1) => {
    const safeMax = Math.max(1, Number(maxChars) || 1);
    const text = String(name || "").trim();
    if (!text) return "?";

    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, safeMax).toUpperCase();
    }

    const initials = parts.map((part) => part.charAt(0)).join("").slice(0, safeMax);
    return (initials || parts[0].slice(0, safeMax)).toUpperCase();
};

export const getIdentityCode = (name, length = 3) => {
    const size = Math.max(2, Number(length) || 3);
    const text = String(name || "").trim() || "NA";

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }

    return hash.toString(36).toUpperCase().padStart(size, "0").slice(0, size);
};

export const getIdentityTag = (name) => `${getMonogram(name, 2)}-${getIdentityCode(name, 3)}`;
