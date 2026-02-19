import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../services/firebase";

export const useTournaments = () => {
    const [tournaments, setTournaments] = useState({});
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const dbRef = ref(db);
        return onValue(dbRef, (snapshot) => {
            const val = snapshot.val();
            setTournaments(val?.tournaments || {});
            setRoster(val?.roster || []);
            setLoading(false);
        });
    }, []);

    return { tournaments, roster, loading };
};
