package fr.sncf.osrd.new_infra.api.signaling;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.graph.Network;
import fr.sncf.osrd.new_infra.api.detection.DirDetector;
import fr.sncf.osrd.new_infra.api.detection.Route;
import fr.sncf.osrd.new_infra.api.detection.RouteInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

public interface SignalingInfra extends RouteInfra {
    ImmutableMap<RJSSignal, Signal<?>> getSignalMap();
    ImmutableMap<Route, ImmutableList<SignalingRoute>> getRouteMap();
    Network<DirDetector, SignalingRoute> getSignalingRouteGraph();
}
