package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Collection;
import java.util.List;
import java.util.Map;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class ResultTrain {
    public final List<ResultSpeed> speeds;
    @Json(name = "head_positions")
    public final List<ResultPosition> headPositions;
    public final List<ResultStops> stops;
    @Json(name = "route_occupancies")
    public final Map<String, ResultOccupancyTiming> routeOccupancies;
    @Json(name = "signal_updates")
    public final Collection<SignalUpdate> signalUpdates;

    /** Creates the serializable result for a given train */
    public ResultTrain(
            List<ResultSpeed> speeds,
            List<ResultPosition> headPositions,
            List<ResultStops> stops, Map<String,
            ResultOccupancyTiming> routeOccupancies,
            Collection<SignalUpdate> signalUpdates
    ) {
        this.speeds = speeds;
        this.headPositions = headPositions;
        this.stops = stops;
        this.routeOccupancies = routeOccupancies;
        this.signalUpdates = signalUpdates;
    }
}
