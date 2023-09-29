package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.Helpers.getExampleRollingStock;
import static fr.sncf.osrd.api.stdcm.STDCMEndpoint.makeTrainSchedule;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.HashMultimap;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.standalone_sim.ScheduleMetadataExtractor;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.units.Distance;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
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
        var requirements = STDCMHelpers.makeRequirementsFromPath(infra, start, end, 0);
        var occupancies = STDCMHelpers.makeOccupancyFromRequirements(infra, requirements);
        double minDelay = STDCMHelpers.getMaxOccupancyLength(occupancies); // Eventually we may need to add a % margin
        occupancies.putAll(STDCMHelpers.makeOccupancyFromRequirements(infra,
                STDCMHelpers.makeRequirementsFromPath(infra, start, end, minDelay * 2)
        ));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(minDelay)
                .setStartLocations(start)
                .setEndLocations(end)
                .setUnavailableTimes(occupancies)
                .setMaxDepartureDelay(minDelay * 2)
                .run();
        assertNotNull(res);
        checkNoConflict(infra, requirements, res);
    }

    /** We try to fit a train in a short opening between two trains, this time on small_infra */
    @Test
    public void testSmallInfraSmallOpening() throws IOException, URISyntaxException {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var start = Set.of(Helpers.convertRouteLocation(infra,
                "rt.buffer_stop.3->DB0", Distance.fromMeters(1590)));
        var end = Set.of(Helpers.convertRouteLocation(infra,
                "rt.DH2->buffer_stop.7", Distance.fromMeters(5000)));
        var requirements = STDCMHelpers.makeRequirementsFromPath(infra, start, end, 0);
        requirements.addAll(STDCMHelpers.makeRequirementsFromPath(infra, start, end, 600));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(300)
                .setStartLocations(start)
                .setEndLocations(end)
                .setUnavailableTimes(STDCMHelpers.makeOccupancyFromRequirements(infra, requirements))
                .setMaxDepartureDelay(600)
                .run();
        assertNotNull(res);
        checkNoConflict(infra, requirements, res);
    }

    /** We make an opening that is just too small to fit a train,
     * we check that it isn't taken and doesn't cause conflicts */
    @Test
    public void testSmallInfraImpossibleOpening() throws IOException, URISyntaxException {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var start = Set.of(Helpers.convertRouteLocation(infra,
                "rt.buffer_stop.3->DB0", Distance.fromMeters(1590)));
        var end = Set.of(Helpers.convertRouteLocation(infra,
                "rt.DH2->buffer_stop.7", Distance.fromMeters(5000)));
        var requirements = STDCMHelpers.makeRequirementsFromPath(infra, start, end, 0);
        var occupancies = STDCMHelpers.makeOccupancyFromRequirements(infra, requirements);
        double minDelay = STDCMHelpers.getMaxOccupancyLength(occupancies);
        occupancies.putAll(STDCMHelpers.makeOccupancyFromRequirements(infra,
                STDCMHelpers.makeRequirementsFromPath(infra, start, end, minDelay * 0.95)
        ));
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start)
                .setEndLocations(end)
                .setUnavailableTimes(STDCMHelpers.makeOccupancyFromRequirements(infra, requirements))
                .run();
        assertNotNull(res);
        checkNoConflict(infra, requirements, res);
    }

    /** Check that the result we find doesn't cause a conflict */
    private void checkNoConflict(FullInfra infra, List<ResultTrain.SpacingRequirement> requirements, STDCMResult res) {
        var requirementMap = HashMultimap.<String, ResultTrain.SpacingRequirement>create();
        for (var requirement : requirements) {
            requirementMap.put(requirement.zone, requirement);
        }
        var newRequirements = ScheduleMetadataExtractor.run(
                res.envelope(),
                res.trainPath(),
                res.chunkPath(),
                makeTrainSchedule(res.envelope().getEndPos(), REALISTIC_FAST_TRAIN,
                        RollingStock.Comfort.STANDARD, res.stopResults()),
                infra
        ).spacingRequirements;
        for (var requirement : newRequirements) {
            var shifted = requirement.withAddedTime(res.departureTime());
            for (var existingRequirement : requirementMap.get(requirement.zone)) {
                assertTrue(shifted.beginTime >= existingRequirement.endTime
                        || shifted.endTime <= existingRequirement.beginTime);
            }
        }
    }
}
