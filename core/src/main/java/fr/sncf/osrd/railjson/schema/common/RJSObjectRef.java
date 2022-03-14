package fr.sncf.osrd.railjson.schema.common;

import com.google.common.collect.ImmutableMap;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.new_infra.implementation.reservation.DetectorImpl;
import fr.sncf.osrd.railjson.parser.TrackBuilder;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@ExcludeFromGeneratedCodeCoverage
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
        checkType(expectedTypes);
        return cachedObjects.get(id.id);
    }

    private void checkType(Set<String> expectedTypes) {
        if (!expectedTypes.contains(type))
            throw new InvalidInfraException(String.format(
                    "Mismatched ref type: expected %s, got (type=%s, id=%s)",
                    expectedTypes, type, id
            ));
    }

    public TrackSection getTrack(Map<String, TrackSection> tracks) throws InvalidInfraException {
        return parseRef(tracks, "TrackSection");
    }

    public fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection getTrack(
            HashMap<String, fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection> tracks
    ) {
        return parseRef(tracks, "TrackSection");
    }

    public fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection getTrack(TrackInfra trackInfra) {
        checkType(Set.of("TrackSection"));
        return trackInfra.getTrackSection(id.id);
    }

    public Route getRoute(Map<String, Route> routes) throws InvalidInfraException {
        return parseRef(routes, "Route");
    }

    public TrackBuilder getTrackBuilder(Map<String, TrackBuilder> tracks) throws InvalidInfraException {
        return parseRef(tracks, "TrackSection");
    }

    public Detector getDetector(HashMap<String, Waypoint> waypoints) throws InvalidInfraException {
        return (Detector) parseRef(waypoints, "Detector");
    }

    public fr.sncf.osrd.new_infra.api.reservation.Detector getDetector(Map<String, DetectorImpl> detectors) {
        return parseRef(detectors, "Detector");
    }

    public Waypoint getWaypoint(HashMap<String, Waypoint> waypoints) throws InvalidInfraException {
        return parseRef(waypoints, Set.of("Detector", "BufferStop"));
    }

    public RJSSwitchType getSwitchType(HashMap<String, RJSSwitchType> switchTypeMap) throws InvalidInfraException {
        return parseRef(switchTypeMap, "SwitchType");
    }
}
