package fr.sncf.osrd.new_infra.api.detection;

import com.google.common.graph.Network;
import fr.sncf.osrd.new_infra.api.tracks.TrackInfra;

public interface RouteInfra extends TrackInfra {
    Network<DirDetector, Route> getInfraRouteGraph();
}
