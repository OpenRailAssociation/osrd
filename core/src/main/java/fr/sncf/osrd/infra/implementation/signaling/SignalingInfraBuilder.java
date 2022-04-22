package fr.sncf.osrd.infra.implementation.signaling;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.*;
import fr.sncf.osrd.infra.implementation.reservation.ReservationInfraBuilder;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.WarningRecorder;
import java.util.Collection;
import java.util.Set;
import java.util.function.Function;

public class SignalingInfraBuilder {

    private final RJSInfra rjsInfra;
    private final ReservationInfra reservationInfra;
    private final Set<SignalingModule> signalingModules;
    private final WarningRecorder warningRecorder;
    private ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> signalMap;
    private ImmutableMultimap<ReservationRoute, SignalingRoute> routeMap;

    /** Constructor */
    public SignalingInfraBuilder(
            RJSInfra rjsInfra,
            ReservationInfra reservationInfra,
            Set<SignalingModule> signalingModules,
            WarningRecorder warningRecorder
    ) {
        this.rjsInfra = rjsInfra;
        this.reservationInfra = reservationInfra;
        this.signalingModules = signalingModules;
        this.warningRecorder = warningRecorder;
    }

    /** Creates a signaling infra from railjson data and a reservation infra */
    public static SignalingInfra fromReservationInfra(
            RJSInfra rjsInfra,
            ReservationInfra reservationInfra,
            Set<SignalingModule> signalingModules,
            WarningRecorder warningRecorder
    ) {
        return new SignalingInfraBuilder(rjsInfra, reservationInfra, signalingModules, warningRecorder).build();
    }

    /** Creates a signaling infra from a railjson infra */
    public static SignalingInfra fromRJSInfra(
            RJSInfra rjsInfra,
            Set<SignalingModule> signalingModules,
            WarningRecorder warningRecorder
    ) {
        return fromReservationInfra(
                rjsInfra,
                ReservationInfraBuilder.fromRJS(rjsInfra, warningRecorder),
                signalingModules,
                warningRecorder
        );
    }

    /** Builds the signaling infra */
    private SignalingInfra build() {
        signalMap = makeSignalMap();
        routeMap = makeRouteMap();
        ImmutableNetwork<DiDetector, SignalingRoute> signalingRouteGraph = makeSignalingRouteGraph();
        return new SignalingInfraImpl(reservationInfra, signalMap, routeMap, signalingRouteGraph);
    }

    /** Creates the signaling route graph */
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

    /** Creates the route multimap, calling each module and merging the results */
    private ImmutableMultimap<ReservationRoute, SignalingRoute> makeRouteMap() {
        var res = loadAndMergeMultimap(m -> m.createRoutes(reservationInfra, signalMap));
        checkNoMissingValue(res, reservationInfra.getInfraRouteGraph().edges(), "route");
        return res;
    }

    /** Creates the signal multimap, calling each module and merging the results */
    private ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> makeSignalMap() {
        var res = loadAndMergeMultimap(m -> m.createSignals(reservationInfra, rjsInfra));
        checkNoMissingValue(res, rjsInfra.signals, "signal");
        return res;
    }

    /** Checks that every route or signal has one signaling object, generates a warning otherwise */
    private <T, U> void checkNoMissingValue(ImmutableMultimap<T, U> map, Collection<T> keys, String typeName) {
        for (var k : keys) {
            if (map.get(k).isEmpty()) {
                var message = String.format("%s {%s} has no linked signaling object", typeName, k);
                warningRecorder.register(new Warning(message));
            }
        }
    }

    /** Runs a module method and merges the results as a multimap */
    private <T, U> ImmutableMultimap<T, U> loadAndMergeMultimap(Function<SignalingModule, ImmutableMap<T, U>> f) {
        var res = ImmutableMultimap.<T, U>builder();
        for (var m : signalingModules) {
            var moduleResults = f.apply(m);
            for (var entry : moduleResults.entrySet())
                res.put(entry.getKey(), entry.getValue());
        }
        return res.build();
    }
}
