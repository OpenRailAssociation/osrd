package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import org.junit.jupiter.api.Test;

public class FloydWarshallTests {

    private static RouteGraph getGraph() throws Exception {
        var infra = RailJSONParser.parse(Helpers.getExampleInfra("tiny_infra/infra.json"));
        return infra.routeGraph;
    }

    @Test
    public void testDistanceNoLongerThanRoute() throws Exception {
        var graph = getGraph();
        var fw = FloydWarshall.from(graph);
        for (var route : graph.routeMap.values()) {
            for (var neighbor : graph.getNeighbors(route)) {
                assert fw.distance(route.index, neighbor.index) <= route.length;
            }
        }
    }

    @Test
    public void testLongestPath() throws Exception {
        var graph = getGraph();
        var fw = FloydWarshall.from(graph);
        var path = fw.getLongestPath();
        assert path.size() == 3;
        assert path.get(0).id.equals("rt.buffer_stop_c->tde.track-bar");
        assert path.get(1).id.equals("rt.tde.track-bar->tde.switch_foo-track");
        assert path.get(2).id.equals("rt.tde.switch_foo-track->buffer_stop_a");
    }

    @Test
    public void testNoPath() throws Exception {
        var graph = getGraph();
        var fw = FloydWarshall.from(graph);
        var route1 = graph.routeMap.get("rt.buffer_stop_a->tde.foo_a-switch_foo");
        var route2 = graph.routeMap.get("rt.buffer_stop_b->tde.foo_b-switch_foo");
        assert Double.isInfinite(fw.distance(route1.index, route2.index));
    }
}
