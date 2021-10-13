package fr.sncf.osrd.railml.tracksectiongraph;

import fr.sncf.osrd.utils.graph.BiGraph;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.HashMap;
import java.util.List;

public class RMLTrackSectionGraph extends BiGraph<TrackNetElement> {

    public final HashMap<String, TrackNetElement> trackNetElementMap = new HashMap<>();

    @Override
    public List<NetRelation> getNeighborRels(TrackNetElement edge, EdgeEndpoint endpoint) {
        if (endpoint == EdgeEndpoint.BEGIN)
            return edge.beginNetRelation;
        return edge.endNetRelation;
    }

    @Override
    public void registerEdge(TrackNetElement edge) {
        super.registerEdge(edge);
        trackNetElementMap.put(edge.id, edge);
    }
}
