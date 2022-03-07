package fr.sncf.osrd.new_infra.api.signaling;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.detection.DiDetector;
import fr.sncf.osrd.new_infra.api.detection.DetectionRoute;
import fr.sncf.osrd.new_infra.api.detection.DetectionInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

public interface SignalingInfra extends DetectionInfra {
    /** Returns a mapping from RailJSON signals to loaded signals */
    ImmutableMap<RJSSignal, Signal<?>> getSignalMap();

    /** Returns a mapping from the detection route to all its overlay signaling routes */
    ImmutableMultimap<DetectionRoute, SignalingRoute> getRouteMap();

    /** Returns the graph of signaling routes */
    ImmutableNetwork<DiDetector, SignalingRoute> getSignalingRouteGraph();
}
