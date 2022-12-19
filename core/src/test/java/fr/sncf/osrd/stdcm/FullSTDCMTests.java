package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.Helpers.parseRollingStockDir;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.stdcm.graph.STDCMPathfinding;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.train.RollingStock;
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setRollingStock(
                        RJSRollingStockParser.parse(parseRollingStockDir(getResourcePath("rolling_stocks/")).get(0))
                )
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 100)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 10125)))
                .run();
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
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(minDelay)
                .setStartLocations(start)
                .setEndLocations(end)
                .setUnavailableTimes(occupancies)
                .run();
        assertNotNull(res);
    }

    /** We try to fit a train in a short opening between two trains, this time on small_infra */
    @Test
    public void testSmallInfraSmallOpening() throws IOException, URISyntaxException {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var firstRoute = infra.findSignalingRoute("rt.buffer_stop.3->DB0", "BAL3");
        var secondRoute = infra.findSignalingRoute("rt.DH1_2->buffer_stop.7", "BAL3");
        var start = Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 1590));
        var end = Set.of(new Pathfinding.EdgeLocation<>(secondRoute, 1137));
        var occupancies = STDCMHelpers.makeOccupancyFromPath(infra, start, end, 0);
        occupancies.putAll(STDCMHelpers.makeOccupancyFromPath(infra, start, end, 600));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(300)
                .setStartLocations(start)
                .setEndLocations(end)
                .setUnavailableTimes(occupancies)
                .run();
        assertNotNull(res);
    }
}
