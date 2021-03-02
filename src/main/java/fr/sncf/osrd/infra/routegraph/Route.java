package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.utils.graph.BiNEdge;

import java.util.List;

public class Route extends BiNEdge<Route> {
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final String id;
    /** List of tvdSectionPath forming the route */
    public final List<TVDSectionPath> tvdSectionPaths;

    protected Route(String id, RouteGraph graph, double length, List<TVDSectionPath> tvdSectionPaths) {
        super(
                graph.nextEdgeIndex(),
                tvdSectionPaths.get(0).startNode,
                tvdSectionPaths.get(tvdSectionPaths.size() - 1).startNode,
                length
        );
        graph.registerEdge(this);
        this.id = id;
        this.tvdSectionPaths = tvdSectionPaths;
    }
}
