package fr.sncf.osrd.new_infra.api.signaling;

import fr.sncf.osrd.new_infra.api.detection.Route;
import fr.sncf.osrd.new_infra.api.detection.RouteInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import java.util.Map;
import java.util.Set;

public interface SignalingModule {

    Map<RJSSignal, Signal<?>> createSignals(RouteInfra infra, RJSInfra rjsInfra);
    Map<Route, SignalingRoute> createRoutes(RouteInfra infra, Map<RJSSignal, Set<Signal<?>>> signalMap);
}