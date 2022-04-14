package fr.sncf.osrd.infra.implementation.signaling;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.reservation.ReservationInfraImpl;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

public class SignalingInfraImpl extends ReservationInfraImpl implements SignalingInfra {

    private final ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> signalMap;
    private final ImmutableMultimap<ReservationRoute, SignalingRoute> routeMap;
    private final ImmutableNetwork<DiDetector, SignalingRoute> signalingRouteGraph;

    /** Constructor */
    public SignalingInfraImpl(
            ReservationInfra reservationInfra,
            ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> signalMap,
            ImmutableMultimap<ReservationRoute, SignalingRoute> routeMap,
            ImmutableNetwork<DiDetector, SignalingRoute> signalingRouteGraph
    ) {
        super(
                reservationInfra,
                reservationInfra.getSectionMap(),
                reservationInfra.getInfraRouteGraph(),
                reservationInfra.getReservationRouteMap(),
                reservationInfra.getRoutesOnEdges()
        );
        this.signalMap = signalMap;
        this.routeMap = routeMap;
        this.signalingRouteGraph = signalingRouteGraph;
    }

    @Override
    public ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> getSignalMap() {
        return signalMap;
    }

    @Override
    public ImmutableMultimap<ReservationRoute, SignalingRoute> getRouteMap() {
        return routeMap;
    }

    @Override
    public ImmutableNetwork<DiDetector, SignalingRoute> getSignalingRouteGraph() {
        return signalingRouteGraph;
    }
}
