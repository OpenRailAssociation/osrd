package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import java.util.List;
import java.util.Map;


@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject implements Identified {
    public String id;

    /** The track direction for which the signal applies */
    public EdgeDirection direction;

    /** The distance at which the signal becomes visible */
    @Json(name = "sight_distance")
    public double sightDistance;

    /** Detector linked with the signal, may be empty if the signal doesn't directly protect a zone */
    @Json(name = "linked_detector")
    public String linkedDetector;

    /** Each logical signal can be of a different type, and simulated independently */
    @Json(name = "logical_signals")
    public List<LogicalSignal> logicalSignals;

    /** Constructor */
    public RJSSignal(
            String track,
            double position,
            String id,
            EdgeDirection direction,
            double sightDistance,
            String linkedDetector
    ) {
        this.position = position;
        this.track = track;
        this.id = id;
        this.direction = direction;
        this.sightDistance = sightDistance;
        this.linkedDetector = linkedDetector;
    }

    @Override
    public String getID() {
        return id;
    }

    public static class LogicalSignal {
        /**
         * The signaling system in which the signal works.
         * each signaling system has a set of roles, such as movement authority or speed limits transmission.
         */
        @Json(name = "signaling_system")
        public String signalingSystem;

        /**
         * The schema for allowed settings is defined by the signaling system.
         * It's a list of key=value entries.
         */
        @Json(name = "settings")
        public Map<String, String> settings;

        /**
         * An optional list of next signaling systems with which the signal is allowed to interface.
         * This list will be used to look up drivers. If missing, the driver list is deduced from surrounding signals.
         * Drivers define how signals are driven by interfacing with the next signal's signaling system,
         * and computing the signal state. There can only be a unique driver for each (input, output)
         * signaling system pair.
         */
        @Json(name = "next_signaling_systems")
        public List<String> nextSignalingSystems;
    }
}
