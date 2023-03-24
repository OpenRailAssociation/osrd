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

    public static class SignalSighting {
        public String signal;
        public double time;
        public double offset;
        public String state;

        /**
         * Constructor
         * */
        public SignalSighting(String signal, double time, double offset, String state) {
            this.signal = signal;
            this.time = time;
            this.offset = offset;
            this.state = state;
        }
    }

    @Json(name = "signal_sightings")
    public final List<SignalSighting> signalSightings;

    public static class ZoneUpdate {
        public String zone;
        public double time;
        public double offset;
        public boolean isEntry;

        /**
         * Constructor
         */
        public ZoneUpdate(String zone, double time, double offset, boolean isEntry) {
            this.zone = zone;
            this.time = time;
            this.offset = offset;
            this.isEntry = isEntry;
        }
    }

    @Json(name = "zone_updates")
    public final List<ZoneUpdate> zoneUpdates;

    @Json(name = "mechanical_energy_consumed")
    public final double mechanicalEnergyConsumed;

    /** Creates the serializable result for a given train */
    public ResultTrain(
            List<ResultSpeed> speeds,
            List<ResultPosition> headPositions,
            List<ResultStops> stops, Map<String,
            ResultOccupancyTiming> routeOccupancies,
            double mechanicalEnergyConsumed,
            List<SignalSighting> signalSightings,
            List<ZoneUpdate> zoneUpdates
    ) {
        this.speeds = speeds;
        this.headPositions = headPositions;
        this.stops = stops;
        this.routeOccupancies = routeOccupancies;
        this.mechanicalEnergyConsumed = mechanicalEnergyConsumed;
        this.signalSightings = signalSightings;
        this.zoneUpdates = zoneUpdates;
    }
}
