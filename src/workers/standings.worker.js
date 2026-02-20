import { calculateStandings } from "../utils/standingsCalculator";

self.onmessage = function (e) {
    const { requestId, data } = e.data || {};

    try {
        const standings = calculateStandings(data);
        self.postMessage({ status: "success", requestId, standings });
    } catch (error) {
        self.postMessage({
            status: "error",
            requestId,
            error: error?.message || "Standings worker failed",
        });
    }
};
