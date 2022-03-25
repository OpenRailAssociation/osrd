package fr.sncf.osrd.new_infra.implementation.reservation;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.*;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.DiTrackInfraImpl;

public class ReservationInfraImpl extends DiTrackInfraImpl implements ReservationInfra {

    private final ImmutableMap<DiDetector, DetectionSection> sectionMap;
    private final ImmutableNetwork<DiDetector, ReservationRoute> infraRouteGraph;
    private final ImmutableMap<String, ReservationRoute> reservationRouteMap;

    /** Constructor */
    public ReservationInfraImpl(
            DiTrackInfra infra,
            ImmutableMap<DiDetector, DetectionSection> sectionMap,
            ImmutableNetwork<DiDetector, ReservationRoute> infraRouteGraph,
            ImmutableMap<String, ReservationRoute> reservationRouteMap
    ) {
        super(infra, infra.getDiTrackGraph());
        this.sectionMap = sectionMap;
        this.infraRouteGraph = infraRouteGraph;
        this.reservationRouteMap = reservationRouteMap;
    }

    @Override
    public ImmutableMap<DiDetector, DetectionSection> getSectionMap() {
        return sectionMap;
    }

    @Override
    public ImmutableNetwork<DiDetector, ReservationRoute> getInfraRouteGraph() {
        return infraRouteGraph;
    }

    @Override
    public ImmutableMap<String, ReservationRoute> getReservationRouteMap() {
        return reservationRouteMap;
    }
}
