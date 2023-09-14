package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.Helpers.getExampleRollingStock;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.utils.units.Distance;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Set;

public class FullSTDCMTests {

    /** Simple test on tiny infra with no occupancy.
     * This is the same test as the one testing the STDCM API, but calling the methods directly */
    @Test
    public void testTinyInfra() throws IOException, URISyntaxException {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setRollingStock(
                        RJSRollingStockParser.parse(getExampleRollingStock("fast_rolling_stock.json"))
                )
                .setStartLocations(Set.of(Helpers.convertRouteLocation(infra,
                        "rt.buffer_stop_b->tde.foo_b-switch_foo", Distance.fromMeters(100)))
                )
                .setEndLocations(Set.of(Helpers.convertRouteLocation(infra,
                        "rt.tde.foo_b-switch_foo->buffer_stop_c", Distance.fromMeters(10125))))
                .run();
        assertNotNull(res);
    }

    /** We try to fit a train in a short opening between two trains.
     * We create a train at t=0, get the minimum delay we need (how long its longest occupancy block lasts),
     * add a train at `2 * min delay`, and try to fit a train between the two. */
    @Test
    public void testTinyInfraSmallOpening() throws IOException, URISyntaxException {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var start = Set.of(Helpers.convertRouteLocation(infra,
                "rt.buffer_stop_b->tde.foo_b-switch_foo", Distance.fromMeters(100)));
        var end = Set.of(Helpers.convertRouteLocation(infra,
                "rt.tde.foo_b-switch_foo->buffer_stop_c", Distance.fromMeters(10125)));
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
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var start = Set.of(Helpers.convertRouteLocation(infra,
                "rt.buffer_stop_b->tde.foo_b-switch_foo", Distance.fromMeters(100)));
        var end = Set.of(Helpers.convertRouteLocation(infra,
                "rt.tde.foo_b-switch_foo->buffer_stop_c", Distance.fromMeters(10125)));
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
