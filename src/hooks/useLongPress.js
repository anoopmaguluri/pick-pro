import { useRef } from "react";

export const useLongPress = (callback, ms = 500) => {
    const timer = useRef(null);
    const active = useRef(false);

    const start = (...args) => {
        active.current = false;
        timer.current = setTimeout(() => {
            active.current = true;
            callback(...args);
        }, ms);
    };

    const cancel = () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    };

    const isLongPressed = () => active.current;

    return { start, cancel, isLongPressed };
};
