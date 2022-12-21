package fr.sncf.osrd.infra.implementation.reservation;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackInfraImpl;

public class ReservationInfraImpl extends DiTrackInfraImpl implements ReservationInfra {

    private final ImmutableMap<DiDetector, DetectionSection> sectionMap;
    private final ImmutableNetwork<DiDetector, ReservationRoute> infraRouteGraph;
    private final ImmutableMap<String, ReservationRoute> reservationRouteMap;
    private final ImmutableMultimap<DiTrackEdge, RouteEntry> routesOnEdges;
    private final ImmutableList<DetectionSection> detectionSections;

    /** Constructor */
    public ReservationInfraImpl(
            DiTrackInfra infra,
            ImmutableMap<DiDetector, DetectionSection> sectionMap,
            ImmutableNetwork<DiDetector, ReservationRoute> infraRouteGraph,
            ImmutableMap<String, ReservationRoute> reservationRouteMap,
            ImmutableMultimap<DiTrackEdge, RouteEntry> routesOnEdges,
            ImmutableList<DetectionSection> detectionSections
    ) {
        super(infra, infra.getDiTrackGraph());
        this.sectionMap = sectionMap;
        this.infraRouteGraph = infraRouteGraph;
        this.reservationRouteMap = reservationRouteMap;
        this.routesOnEdges = routesOnEdges;
        this.detectionSections = detectionSections;
    }

    @Override
    public ImmutableMap<DiDetector, DetectionSection> getSectionMap() {
        return sectionMap;
    }

    @Override
    public ImmutableList<DetectionSection> getDetectionSections() {
        return detectionSections;
    }

    @Override
    public ImmutableNetwork<DiDetector, ReservationRoute> getInfraRouteGraph() {
        return infraRouteGraph;
    }

    @Override
    public ImmutableMap<String, ReservationRoute> getReservationRouteMap() {
        return reservationRouteMap;
    }

    @Override
    public ImmutableMultimap<DiTrackEdge, RouteEntry> getRoutesOnEdges() {
        return routesOnEdges;
    }
}
