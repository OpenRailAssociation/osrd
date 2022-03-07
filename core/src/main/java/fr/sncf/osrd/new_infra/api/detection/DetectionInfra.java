package fr.sncf.osrd.new_infra.api.detection;

import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;

public interface DetectionInfra extends TrackInfra, DiTrackInfra {
    ImmutableNetwork<DiDetector, DetectionRoute> getInfraRouteGraph();
}
