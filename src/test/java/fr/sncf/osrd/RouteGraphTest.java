package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;
import fr.sncf.osrd.utils.SortedArraySet;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;

public class RouteGraphTest {
    /**
     * One tiv with 2 routes
     *         R1
     * A   ----------->   B
     * |---D1---D2---D3---|
     *     <-----------
     *         R2
     */
    @Test
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST_OF_RETURN_VALUE"})
    public void simpleRouteGraphBuild() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var trackSection = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", 100);
        var detectorBuilder = trackSection.waypoints.builder();
        var d1 = new Detector(0, "D1");
        var d2 = new Detector(1, "D2");
        var d3 = new Detector(2, "D3");
        detectorBuilder.add(40, d1);
        detectorBuilder.add(50, d2);
        detectorBuilder.add(75, d3);
        detectorBuilder.build();

        // Craft tvdSections
        var tvdSections = new HashMap<String, TVDSection>();
        var tvd123Waypoints = new ArrayList<Waypoint>(Arrays.asList(d1, d2, d3));
        var tvdSection123 = new TVDSection("TVDSection123", tvd123Waypoints, false);
        tvdSections.put("TVDSection123", tvdSection123);

        // Build DetectorGraph
        var waypointGraph = Infra.buildWaypointGraph(trackGraph, tvdSections);

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(waypointGraph);

        var waypointsR1 = new ArrayList<Waypoint>(Arrays.asList(d1, d2, d3));
        var tvdSectionsR1 = new SortedArraySet<TVDSection>();
        tvdSectionsR1.add(tvdSection123);
        routeGraphBuilder.makeRoute("R1", waypointsR1, tvdSectionsR1);

        var waypointsR2 = new ArrayList<Waypoint>(Arrays.asList(d3, d2, d1));
        var tvdSectionsR2 = new SortedArraySet<TVDSection>();
        tvdSectionsR2.add(tvdSection123);
        routeGraphBuilder.makeRoute("R2", waypointsR2, tvdSectionsR2);

        var routeGraph =  routeGraphBuilder.build();

        assertEquals(2, routeGraph.getEdgeCount());

        // Check R1
        var route1 = routeGraph.getEdge(0);
        assertEquals(35, route1.length, 0.1);
        assertEquals(2, route1.tvdSectionPaths.size());
        assertEquals(d1.index, route1.tvdSectionPaths.get(0).startNode);
        assertEquals(d3.index, route1.tvdSectionPaths.get(1).endNode);

        // Check R2
        var route2 = routeGraph.getEdge(1);
        assertEquals(35, route2.length, 0.1);
        assertEquals(2, route2.tvdSectionPaths.size());
        assertEquals(d3.index, route2.tvdSectionPaths.get(0).endNode);
        assertEquals(d1.index, route2.tvdSectionPaths.get(1).startNode);
    }
}
