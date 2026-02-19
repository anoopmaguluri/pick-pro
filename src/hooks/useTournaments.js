import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../services/firebase";

export const useTournaments = () => {
    const [tournaments, setTournaments] = useState({});
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const tournamentsRef = ref(db, "tournaments");
        const rosterRef = ref(db, "roster");

        const unsubTournaments = onValue(tournamentsRef, (snapshot) => {
            setTournaments(snapshot.val() || {});
            setLoading(false);
        });

        const unsubRoster = onValue(rosterRef, (snapshot) => {
            setRoster(snapshot.val() || []);
        });

        return () => {
            unsubTournaments();
            unsubRoster();
        };
    }, []);

    return { tournaments, roster, loading };
};
