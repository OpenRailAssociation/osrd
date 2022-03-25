package fr.sncf.osrd.new_infra.implementation.signaling;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.reservation.*;
import fr.sncf.osrd.new_infra.api.signaling.Signal;
import fr.sncf.osrd.new_infra.api.signaling.SignalState;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.new_infra.implementation.reservation.ReservationInfraImpl;
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
                reservationInfra.getReservationRouteMap()
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
