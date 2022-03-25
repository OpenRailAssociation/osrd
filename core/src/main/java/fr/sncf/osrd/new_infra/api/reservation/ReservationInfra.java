package fr.sncf.osrd.new_infra.api.reservation;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;

public interface ReservationInfra extends TrackInfra, DiTrackInfra {
    /** Looks up a detector by ID */
    ImmutableMap<String, Detector> getDetectorMap();

    /** Returns a map from detector directions to their next detection section */
    ImmutableMap<DiDetector, DetectionSection> getSectionMap();

    /** Returns the detection routes infrastructure graph */
    ImmutableNetwork<DiDetector, ReservationRoute> getInfraRouteGraph();

    /** Returns a mapping from route ID to route */
    ImmutableMap<String, ReservationRoute> getReservationRouteMap();
}
