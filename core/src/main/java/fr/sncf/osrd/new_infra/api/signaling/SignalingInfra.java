package fr.sncf.osrd.new_infra.api.signaling;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

public interface SignalingInfra extends ReservationInfra {
    /** Returns a mapping from RailJSON signals to loaded signals */
    ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> getSignalMap();

    /** Returns a mapping from the detection route to all its overlay signaling routes */
    ImmutableMultimap<ReservationRoute, SignalingRoute> getRouteMap();

    /** Returns the graph of signaling routes */
    ImmutableNetwork<DiDetector, SignalingRoute> getSignalingRouteGraph();
}
