export const useHaptic = () => {
    const trigger = (pattern) => {
        if (typeof window !== "undefined" && window.navigator?.vibrate) {
            window.navigator.vibrate(pattern);
        }
    };
    return { trigger };
};
