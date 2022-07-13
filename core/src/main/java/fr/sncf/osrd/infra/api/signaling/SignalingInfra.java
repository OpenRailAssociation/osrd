package fr.sncf.osrd.infra.api.signaling;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

public interface SignalingInfra extends ReservationInfra {
    /** Returns a mapping from RailJSON signals to loaded signals */
    ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> getSignalMap();

    /** Returns a mapping from the detection route to all its overlay signaling routes */
    ImmutableMultimap<ReservationRoute, SignalingRoute> getRouteMap();

    /** Returns the graph of signaling routes */
    ImmutableNetwork<DiDetector, SignalingRoute> getSignalingRouteGraph();

    /** Returns the route matching the ID and the signaling type, null if not found */
    SignalingRoute findSignalingRoute(String id, String signalingType);
}
