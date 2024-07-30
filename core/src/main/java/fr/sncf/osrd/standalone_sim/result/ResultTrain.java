package fr.sncf.osrd.standalone_sim.result;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class ResultTrain {
    public final List<ResultSpeed> speeds;

    @Json(name = "head_positions")
    public final List<ResultPosition> headPositions;

    public final List<ResultStops> stops;

    /**
     * A signal sighting represents the time and offset at which a train first sees a signal. The
     * state of the signal is also recorded.
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

        public SignalSighting withAddedTime(double timeToAdd) {
            return new SignalSighting(signal, time + timeToAdd, offset, state);
        }
    }

    @Json(name = "signal_sightings")
    public final List<SignalSighting> signalSightings;

    /**
     * A ZoneUpdate represents either an entry or an exit of a zone by the train, with the time of
     * the event and the offset of the train head along its path at that time.
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

        public ZoneUpdate withAddedTime(double timeToAdd) {
            return new ZoneUpdate(zone, time + timeToAdd, offset, isEntry);
        }
    }

    @Json(name = "zone_updates")
    public final List<ZoneUpdate> zoneUpdates;

    /**
     * A SpacingRequirement represents a requirement for a zone to be free between the given times
     * in order for the train to process unimpeded.
     */
    public static final class SpacingRequirement {
        public String zone;

        @Json(name = "begin_time")
        public double beginTime;

        @Json(name = "end_time")
        public double endTime;

        // whether the requirement end_time is final. it's metadata, and **shouldn't be used for conflict detection**
        public transient boolean isComplete;

        public SpacingRequirement(String zone, double beginTime, double endTime, boolean isComplete) {
            this.zone = zone;
            this.beginTime = beginTime;
            this.endTime = endTime;
            this.isComplete = isComplete;
            assert !Double.isNaN(beginTime);
            assert !Double.isNaN(endTime);
            assert Double.isFinite(beginTime);
        }

        public SpacingRequirement withAddedTime(double timeToAdd) {
            return new SpacingRequirement(zone, beginTime + timeToAdd, endTime + timeToAdd, isComplete);
        }

        @Override
        public String toString() {
            return "SpacingRequirement{" + "zone='" + zone + '\'' + ", beginTime=" + beginTime + ", endTime=" + endTime
                    + '}';
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            final SpacingRequirement that = (SpacingRequirement) o;
            return Double.compare(beginTime, that.beginTime) == 0
                    && Double.compare(endTime, that.endTime) == 0
                    && isComplete == that.isComplete
                    && Objects.equals(zone, that.zone);
        }

        @Override
        public int hashCode() {
            return Objects.hash(zone, beginTime, endTime, isComplete);
        }
    }

    @Json(name = "spacing_requirements")
    public final List<SpacingRequirement> spacingRequirements;

    public static class RoutingZoneRequirement {
        public String zone;

        @Json(name = "entry_detector")
        public String entryDetector;

        @Json(name = "exit_detector")
        public String exitDetector;

        public Map<String, String> trackNodes;

        @Json(name = "end_time")
        public double endTime;

        public RoutingZoneRequirement(
                String zone, String entryDetector, String exitDetector, Map<String, String> trackNodes, double endTime) {
            this.zone = zone;
            this.entryDetector = entryDetector;
            this.exitDetector = exitDetector;
            this.trackNodes = trackNodes;
            this.endTime = endTime;
        }
    }

    /**
     * A routing represents a requirement for a zone to be in the compatible configuration between
     * the given times in order for the train to process unimpeded. The tuple (entry_detector,
     * exit_detector, track nodes) is the zone configuration.
     */
    public static class RoutingRequirement {
        public String route;

        @Json(name = "begin_time")
        public double beginTime;

        public List<RoutingZoneRequirement> zones;

        public RoutingRequirement(String route, double beginTime, List<RoutingZoneRequirement> zones) {
            this.route = route;
            this.beginTime = beginTime;
            this.zones = zones;
        }

        public RoutingRequirement withAddedTime(double timeToAdd) {
            return new RoutingRequirement(route, beginTime + timeToAdd, zones);
        }
    }

    @Json(name = "routing_requirements")
    public final List<RoutingRequirement> routingRequirements;

    @Json(name = "mechanical_energy_consumed")
    public final double mechanicalEnergyConsumed;

    /** Creates the serializable result for a given train */
    public ResultTrain(
            List<ResultSpeed> speeds,
            List<ResultPosition> headPositions,
            List<ResultStops> stops,
            double mechanicalEnergyConsumed,
            List<SignalSighting> signalSightings,
            List<ZoneUpdate> zoneUpdates,
            List<SpacingRequirement> spacingRequirements,
            List<RoutingRequirement> routingRequirements) {
        this.speeds = speeds;
        this.headPositions = headPositions;
        this.stops = stops;
        this.mechanicalEnergyConsumed = mechanicalEnergyConsumed;
        this.signalSightings = signalSightings;
        this.zoneUpdates = zoneUpdates;
        this.spacingRequirements = spacingRequirements;
        this.routingRequirements = routingRequirements;
    }

    /** Shift the position curve by a given departure time */
    public ResultTrain withDepartureTime(Double departureTime) {
        return new ResultTrain(
                speeds.stream().map(speed -> speed.withAddedTime(departureTime)).toList(),
                headPositions.stream()
                        .map(pos -> pos.withAddedTime(departureTime))
                        .toList(),
                stops.stream().map(stop -> stop.withAddedTime(departureTime)).toList(),
                mechanicalEnergyConsumed,
                signalSightings.stream()
                        .map(sighting -> sighting.withAddedTime(departureTime))
                        .toList(),
                zoneUpdates.stream()
                        .map(update -> update.withAddedTime(departureTime))
                        .toList(),
                spacingRequirements.stream()
                        .map(req -> req.withAddedTime(departureTime))
                        .toList(),
                routingRequirements.stream()
                        .map(req -> req.withAddedTime(departureTime))
                        .toList());
    }
}
