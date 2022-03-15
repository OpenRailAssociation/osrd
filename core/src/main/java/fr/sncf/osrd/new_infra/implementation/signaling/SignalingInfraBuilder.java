package fr.sncf.osrd.new_infra.implementation.signaling;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.signaling.*;
import fr.sncf.osrd.new_infra.implementation.reservation.ReservationInfraBuilder;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import java.util.Set;

public class SignalingInfraBuilder {

    private final RJSInfra rjsInfra;
    private final ReservationInfra reservationInfra;
    private final Set<SignalingModule> signalingModules;
    private ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> signalMap;
    private ImmutableMultimap<ReservationRoute, SignalingRoute> routeMap;

    public SignalingInfraBuilder(
            RJSInfra rjsInfra,
            ReservationInfra reservationInfra,
            Set<SignalingModule> signalingModules
    ) {
        this.rjsInfra = rjsInfra;
        this.reservationInfra = reservationInfra;
        this.signalingModules = signalingModules;
    }

    public static SignalingInfra fromReservationInfra(
            RJSInfra rjsInfra,
            ReservationInfra reservationInfra
    ) {
        var signalingModules = loadSignalingModules();
        return new SignalingInfraBuilder(rjsInfra, reservationInfra, signalingModules).build();
    }

    private static Set<SignalingModule> loadSignalingModules() {
        // TODO
        return Set.of();
    }

    public static SignalingInfra fromRJSInfra(RJSInfra rjsInfra) {
        return fromReservationInfra(rjsInfra, ReservationInfraBuilder.fromRJS(rjsInfra));
    }

    public SignalingInfra build() {
        signalMap = makeSignalMap();
        routeMap = makeRouteMap();
        ImmutableNetwork<DiDetector, SignalingRoute> signalingRouteGraph = makeSignalingRouteGraph();
        return new SignalingInfraImpl(reservationInfra, signalMap, routeMap, signalingRouteGraph);
    }

    private ImmutableNetwork<DiDetector, SignalingRoute> makeSignalingRouteGraph() {
        var networkBuilder = NetworkBuilder
                .directed()
                .allowsParallelEdges(true)
                .<DiDetector, SignalingRoute>immutable();
        var reservationGraph = reservationInfra.getInfraRouteGraph();
        for (var node : reservationGraph.nodes())
            networkBuilder.addNode(node);
        for (var entry : routeMap.entries()) {
            var nodes = reservationGraph.incidentNodes(entry.getKey());
            networkBuilder.addEdge(nodes, entry.getValue());
        }
        return networkBuilder.build();
    }

    private ImmutableMultimap<ReservationRoute, SignalingRoute> makeRouteMap() {
        var res = ImmutableMultimap.<ReservationRoute, SignalingRoute>builder();
        for (var module : signalingModules) {
            var moduleResults = module.createRoutes(reservationInfra, signalMap);
            for (var entry : moduleResults.entrySet())
                res.put(entry.getKey(), entry.getValue());
        }
        return res.build();
    }

    private ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> makeSignalMap() {
        var res = ImmutableMultimap.<RJSSignal, Signal<? extends SignalState>>builder();
        for (var module : signalingModules) {
            var moduleResults = module.createSignals(reservationInfra, rjsInfra);
            for (var entry : moduleResults.entrySet())
                res.put(entry.getKey(), entry.getValue());
        }
        return res.build();
    }
}
