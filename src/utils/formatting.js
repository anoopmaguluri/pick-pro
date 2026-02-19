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
