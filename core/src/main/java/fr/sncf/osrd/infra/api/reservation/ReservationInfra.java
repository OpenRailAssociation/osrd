package fr.sncf.osrd.infra.api.reservation;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackInfra;

public interface ReservationInfra extends TrackInfra, DiTrackInfra {
    /** Looks up a detector by ID */
    ImmutableMap<String, Detector> getDetectorMap();

    /** Returns a map from detector directions to their next detection section */
    ImmutableMap<DiDetector, DetectionSection> getSectionMap();

    /** Returns the detection routes infrastructure graph */
    ImmutableNetwork<DiDetector, ReservationRoute> getInfraRouteGraph();

    /** Returns a mapping from route ID to route */
    ImmutableMap<String, ReservationRoute> getReservationRouteMap();


    /** Returns the map of all routes passing by any given directed edge.
     * If the route starts before the track, the offset is the length of the route before the track (negative).
     * Otherwise, the offset is the start of the route on the directed edge. */
    ImmutableMultimap<DiTrackEdge, RouteEntry> getRoutesOnEdges();

    /** A pair of route + offset of the start */
    record RouteEntry(ReservationRoute route, double startOffset) {}
}
