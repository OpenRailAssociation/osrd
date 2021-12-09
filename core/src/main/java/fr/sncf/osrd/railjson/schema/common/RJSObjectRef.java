package fr.sncf.osrd.railjson.schema.common;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.railjson.parser.TrackBuilder;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class RJSObjectRef<T extends Identified> {
    public ID<T> id;
    public String type;

    public RJSObjectRef(ID<T> id, String type) {
        this.id = id;
        this.type = type;
    }

    public RJSObjectRef(String id, String type) {
        this(new ID<>(id), type);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, type);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != RJSObjectRef.class)
            return false;
        var o = (RJSObjectRef<?>) obj;
        return id.equals(o.id) && type.equals(o.type);
    }

    @Override
    public String toString() {
        return String.format("RJSObjectRef { type=%s, id=%s }", type, id.id);
    }


    private <U> U parseRef(Map<String, U> cachedObjects, String expectedType) throws InvalidInfraException {
        return parseRef(cachedObjects, Set.of(expectedType));
    }

    private <U> U parseRef(Map<String, U> cachedObjects, Set<String> expectedTypes) throws InvalidInfraException {
        if (!expectedTypes.contains(type))
            throw new InvalidInfraException(String.format(
                    "Mismatched ref type: expected %s, got (type=%s, id=%s)",
                    expectedTypes, type, id
            ));
        return cachedObjects.get(id.id);
    }

    public TrackSection getTrack(Map<String, TrackSection> tracks) throws InvalidInfraException {
        return parseRef(tracks, "track_section");
    }

    public TrackBuilder getTrackBuilder(Map<String, TrackBuilder> tracks) throws InvalidInfraException {
        return parseRef(tracks, "track_section");
    }

    public Detector getDetector(HashMap<String, Waypoint> waypoints) throws InvalidInfraException {
        return (Detector) parseRef(waypoints, "detector");
    }

    public BufferStop getBufferStop(HashMap<String, Waypoint> waypoints) throws InvalidInfraException {
        return (BufferStop) parseRef(waypoints, "buffer_stop");
    }

    public Waypoint getWaypoint(HashMap<String, Waypoint> waypoints) throws InvalidInfraException {
        return parseRef(waypoints, Set.of("detector", "buffer_stop"));
    }

    public TVDSection getTVDSection(HashMap<String, TVDSection> tvdSectionsMap) throws InvalidInfraException {
        return parseRef(tvdSectionsMap, "tvd_section");
    }

    public RJSSwitchType getSwitchType(HashMap<String, RJSSwitchType> switchTypeMap) throws InvalidInfraException {
        return parseRef(switchTypeMap, "switch_type");
    }
}
