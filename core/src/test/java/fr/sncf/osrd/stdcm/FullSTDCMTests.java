package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.Helpers.parseRollingStockDir;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.stdcm.STDCMPathfinding;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Set;

public class FullSTDCMTests {

    /** Simple test on tiny infra with no occupancy.
     * This is the same test as the one testing the STDCM API, but calling the methods directly */
    @Test
    public void testTinyInfra() throws IOException, URISyntaxException {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var firstRoute = infra.findSignalingRoute("rt.buffer_stop_b->tde.foo_b-switch_foo", "BAL3");
        var secondRoute = infra.findSignalingRoute("rt.tde.foo_b-switch_foo->buffer_stop_c", "BAL3");
        var res = STDCMPathfinding.findPath(
                infra,
                RJSRollingStockParser.parse(parseRollingStockDir(getResourcePath("rolling_stocks/")).get(0)),
                0,
                0,
                Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 100)),
                Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 10125)),
                ImmutableMultimap.of(),
                2.
        );
        assertNotNull(res);
    }

    /** We try to fit a train in a short opening between two trains.
     * We create a train at t=0, get the minimum delay we need (how long its longest occupancy block lasts),
     * add a train at `2 * min delay`, and try to fit a train between the two. */
    @Test
    public void testTinyInfraSmallOpening() throws IOException, URISyntaxException {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var firstRoute = infra.findSignalingRoute("rt.buffer_stop_b->tde.foo_b-switch_foo", "BAL3");
        var secondRoute = infra.findSignalingRoute("rt.tde.foo_b-switch_foo->buffer_stop_c", "BAL3");
        var start = Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 100));
        var end = Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 10125));
        var occupancies = STDCMHelpers.makeOccupancyFromPath(infra, start, end, 0);
        double minDelay = STDCMHelpers.getMaxOccupancyLength(occupancies); // Eventually we may need to add a % margin
        occupancies.putAll(STDCMHelpers.makeOccupancyFromPath(infra, start, end, minDelay * 2));
        var res = STDCMPathfinding.findPath(
                infra,
                RJSRollingStockParser.parse(parseRollingStockDir(getResourcePath("rolling_stocks/")).get(0)),
                minDelay,
                0,
                start,
                end,
                occupancies,
                2.
        );
        assertNotNull(res);
    }
}
