package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
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

    /**
     * A signal sighting represents the time and offset at which a train first sees a signal.
     * The state of the signal is also recorded.
     */
    public static class SignalSighting {
        public String signal;
        public double time;
        public double offset;
        public String state;

        public SignalSighting(String signal, double time, double offset, String state) {
            this.signal = signal;
            this.time = time;
            this.offset = offset;
            this.state = state;
        }
    }

    @Json(name = "signal_sightings")
    public final List<SignalSighting> signalSightings;

    /**
     * A ZoneUpdate represents either an entry or an exit of a zone by the train,
     * with the time of the event and the offset of the train head along its path
     * at that time.
     */
    public static class ZoneUpdate {
        public String zone;
        public double time;
        public double offset;
        public boolean isEntry;

        public ZoneUpdate(String zone, double time, double offset, boolean isEntry) {
            this.zone = zone;
            this.time = time;
            this.offset = offset;
            this.isEntry = isEntry;
        }
    }

    @Json(name = "zone_updates")
    public final List<ZoneUpdate> zoneUpdates;

    /** A SpacingRequirement represents a requirement for a zone to be free between
     * the given times in order for the train to process unimpeded.
     */
    public static class SpacingRequirement {
        public String zone;
        @Json(name = "begin_time")
        public double beginTime;

        @Json(name = "end_time")
        public double endTime;

        public SpacingRequirement(String zone, double beginTime, double endTime) {
            this.zone = zone;
            this.beginTime = beginTime;
            this.endTime = endTime;
        }
    }

    @Json(name = "spacing_requirements")
    public final List<SpacingRequirement> spacingRequirements;

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
            List<ZoneUpdate> zoneUpdates,
            List<SpacingRequirement> spacingRequirements) {
        this.speeds = speeds;
        this.headPositions = headPositions;
        this.stops = stops;
        this.routeOccupancies = routeOccupancies;
        this.mechanicalEnergyConsumed = mechanicalEnergyConsumed;
        this.signalSightings = signalSightings;
        this.zoneUpdates = zoneUpdates;
        this.spacingRequirements = spacingRequirements;
    }

    public ResultTrain withDepartureTime(Double departureTime) {
        return new ResultTrain(speeds, headPositions.stream().map(pos -> pos.withAddedTime(departureTime)).toList(),
                stops, routeOccupancies, mechanicalEnergyConsumed, signalSightings, zoneUpdates, spacingRequirements);
    }
}
