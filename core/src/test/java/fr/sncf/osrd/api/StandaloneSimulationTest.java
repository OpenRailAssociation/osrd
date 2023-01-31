package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.getExampleRollingStock;
import static fr.sncf.osrd.Helpers.getExampleRollingStocks;
import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.api.StandaloneSimulationEndpoint.StandaloneSimulationRequest;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSComfortType;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.standalone_sim.result.ResultPosition;
import fr.sncf.osrd.standalone_sim.result.ResultSpeed;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;


public class StandaloneSimulationTest extends ApiTest {

    private static RJSTrainPath tinyInfraTrainPath() {
        var trainPath = new RJSTrainPath();
        var tracksRoute1 = new ArrayList<RJSTrainPath.RJSDirectionalTrackRange>();
        tracksRoute1.add(
                new RJSTrainPath.RJSDirectionalTrackRange("ne.micro.foo_b", 100, 175, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSTrainPath.RJSRoutePath(
                "rt.buffer_stop_b->tde.foo_b-switch_foo", tracksRoute1, "BAL3"));

        var tracksRoute2 = new ArrayList<RJSTrainPath.RJSDirectionalTrackRange>();
        tracksRoute2.add(new RJSTrainPath.RJSDirectionalTrackRange(
                "ne.micro.foo_b", 175, 200, EdgeDirection.START_TO_STOP));
        tracksRoute2.add(new RJSTrainPath.RJSDirectionalTrackRange(
                "ne.micro.foo_to_bar", 0, 10000, EdgeDirection.START_TO_STOP));
        tracksRoute2.add(new RJSTrainPath.RJSDirectionalTrackRange(
                "ne.micro.bar_a", 0, 100, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSTrainPath.RJSRoutePath(
                "rt.tde.foo_b-switch_foo->buffer_stop_c",
                tracksRoute2,
                "BAL3")
        );
        return trainPath;
    }

    /** Returns a small train path on small infra */
    public static RJSTrainPath smallInfraTrainPath() {
        var trainPath = new RJSTrainPath();
        var trackRanges1 = new ArrayList<RJSTrainPath.RJSDirectionalTrackRange>();
        trackRanges1.add(new RJSTrainPath.RJSDirectionalTrackRange("TA0", 1820, 2000, EdgeDirection.START_TO_STOP));
        trackRanges1.add(new RJSTrainPath.RJSDirectionalTrackRange("TA6", 0, 1800, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSTrainPath.RJSRoutePath("rt.DA2->DA6_1", trackRanges1, "BAL3"));

        for (int i = 1; i < 5; i++) {
            var trackRanges2 = new ArrayList<RJSTrainPath.RJSDirectionalTrackRange>();
            trackRanges2.add(new RJSTrainPath.RJSDirectionalTrackRange("TA6", 200 + 1600 * i, 200 + 1600 * (i + 1),
                    EdgeDirection.START_TO_STOP));
            trainPath.routePath.add(
                    new RJSTrainPath.RJSRoutePath("rt.DA6_" + i + "->DA6_" + (i + 1), trackRanges2, "BAL3"));
        }

        var trackRanges3 = new ArrayList<RJSTrainPath.RJSDirectionalTrackRange>();
        trackRanges3.add(new RJSTrainPath.RJSDirectionalTrackRange("TA6", 8200, 9820, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSTrainPath.RJSRoutePath("rt.DA6_5->DA5", trackRanges3, "BAL3"));

        return trainPath;
    }

    /**  */
    public StandaloneSimResult runStandaloneSimulation(StandaloneSimulationRequest request) throws
            InvalidRollingStock,
            InvalidSchedule,
            IOException {
        // serialize the request
        var requestBody = StandaloneSimulationEndpoint.adapterRequest.toJson(request);

        // process it
        var rawResponse =
                readBodyResponse(new StandaloneSimulationEndpoint(infraHandlerMock, electricalProfileSetManagerMock)
                        .act(new RqFake("POST", "/standalone_simulation", requestBody))
                );

        // parse the response
        var response = StandaloneSimResult.adapter.fromJson(rawResponse);
        assertNotNull(response);
        return response;
    }

    @Test
    public void simple() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var trainSchedules = new ArrayList<RJSStandaloneTrainSchedule>();
        trainSchedules.add(new RJSStandaloneTrainSchedule("Test.", "fast_rolling_stock", 0,
                new RJSAllowance[0],
                new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)}, null));
        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trainSchedules,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);
        var trainResult = simResult.baseSimulations.get(0);

        // ensure the position of the head and the tail of the train are always increasing
        var positions = trainResult.headPositions.toArray(new ResultPosition[0]);
        for (int i = 1; i < positions.length; i++)
            assertTrue(positions[i - 1].time <= positions[i].time);

        // ensure the speed is always increasing
        var speeds = trainResult.speeds.toArray(new ResultSpeed[0]);
        for (int i = 1; i < speeds.length; i++)
            assertTrue(speeds[i - 1].position <= speeds[i].position);
        assertEquals(8, trainResult.routeOccupancies.size());

        // check mrsp
        var mrsp = simResult.speedLimits.get(0);
        assertEquals(mrsp.size(), 6);
    }

    @Test
    public void multiple() throws Exception {
        final var rjsTrainPath = tinyInfraTrainPath();

        var trainSchedules = new ArrayList<RJSStandaloneTrainSchedule>();
        for (int i = 0; i < 10; i++) {
            var trainID = String.format("Test.%d", i);
            trainSchedules.add(new RJSStandaloneTrainSchedule(trainID, "fast_rolling_stock", 0,
                    new RJSAllowance[0],
                    new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)}, null));
        }

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trainSchedules,
                rjsTrainPath
        );

        var simResult = runStandaloneSimulation(query);
        assertEquals(10, simResult.baseSimulations.size());
        assertEquals(10, simResult.speedLimits.size());
    }

    @Test
    public void withStops() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var noStops = new RJSTrainStop[]{
                new RJSTrainStop(2000., 0),
                new RJSTrainStop(5000., 1),
                RJSTrainStop.lastStop(0.1)
        };
        var stops = new RJSTrainStop[]{
                new RJSTrainStop(2000., 0),
                new RJSTrainStop(5000., 121),
                RJSTrainStop.lastStop(0.1)
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_stops", "fast_rolling_stock",
                0, null, noStops, null));
        trains.add(new RJSStandaloneTrainSchedule("stops", "fast_rolling_stock",
                0, null, stops, null));

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trains,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);

        var noStopsResult = simResult.baseSimulations.get(0);
        var noStopsTime = noStopsResult.headPositions.get(noStopsResult.headPositions.size() - 1).time;
        var stopsResult = simResult.baseSimulations.get(1);
        var stopsTime = stopsResult.headPositions.get(stopsResult.headPositions.size() - 1).time;
        assertEquals(noStopsTime + 120, stopsTime, 0.00001);
    }

    @Test
    public void withMarecoAllowance() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var allowance = new RJSAllowance[]{new RJSAllowance.StandardAllowance(
                RJSAllowanceDistribution.MARECO, new RJSAllowanceValue.Percent(5)
        )
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops, null));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops, null));

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trains,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);

        var noAllowanceResult = simResult.baseSimulations.get(0);
        var noAllowanceTime = noAllowanceResult.headPositions.get(noAllowanceResult.headPositions.size() - 1).time;
        var marecoResult = simResult.ecoSimulations.get(1);
        var marecoTime = marecoResult.headPositions.get(marecoResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime * 1.05, marecoTime, noAllowanceTime * 0.01);
        assertNull(simResult.ecoSimulations.get(0));
    }


    @Test
    public void withMarecoAllowanceRanges() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var rangeEndPos = 5000;
        var allowance = new RJSAllowance[]{
                new RJSAllowance.StandardAllowance(
                        RJSAllowanceDistribution.MARECO,
                        new RJSAllowanceValue.TimePerDistance(4.5),
                        new RJSAllowanceRange[]{
                                new RJSAllowanceRange(
                                        0,
                                        rangeEndPos,
                                        new RJSAllowanceValue.TimePerDistance(5.5)
                                )
                        }
                )
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops, null));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops, null));

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trains,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);

        var noAllowanceResult = simResult.baseSimulations.get(0);
        var noAllowanceTime =
                noAllowanceResult.headPositions.get(noAllowanceResult.headPositions.size() - 1).time;
        var marecoResult = simResult.ecoSimulations.get(1);
        var marecoTime = marecoResult.headPositions.get(marecoResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime + 4.5 * 60 * rangeEndPos / 1E5 + 5.5 * 60 * (10000 - rangeEndPos) / 1E5,
                marecoTime,
                noAllowanceTime * 0.01);
        assertNull(simResult.ecoSimulations.get(0));
    }

    @Test
    public void engineeringAllowance() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var allowance = new RJSAllowance[]{new RJSAllowance.EngineeringAllowance(
                RJSAllowanceDistribution.MARECO, 0, 1000, new RJSAllowanceValue.Time(30), 0.01
        )
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops, null));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops, null));

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trains,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);

        var noAllowanceResult = simResult.baseSimulations.get(0);
        var noAllowanceTime = noAllowanceResult.headPositions.get(noAllowanceResult.headPositions.size() - 1).time;
        var allowanceResult = simResult.ecoSimulations.get(1);
        var allowanceTime = allowanceResult.headPositions.get(allowanceResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime + 30, allowanceTime, noAllowanceTime * 0.01);
    }

    @Test
    public void withLinearAllowance() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var allowance = new RJSAllowance[]{new RJSAllowance.StandardAllowance(
                RJSAllowanceDistribution.LINEAR, new RJSAllowanceValue.Percent(5)
        )
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops, null));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops, null));

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trains,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);

        var noAllowanceResult = simResult.baseSimulations.get(0);
        var noAllowanceTime = noAllowanceResult.headPositions.get(noAllowanceResult.headPositions.size() - 1).time;
        var linearResult = simResult.ecoSimulations.get(1);
        var linearTime = linearResult.headPositions.get(linearResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime * 1.05, linearTime, noAllowanceTime * 0.01);
        assertNull(simResult.ecoSimulations.get(0));
    }

    @Test
    public void withLinearAllowanceRanges() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        // TODO : build a method to get the path length in @{RJSTrainPath} and use it here and in the final asserts
        var rangeEndPos = 5000;
        var allowance = new RJSAllowance[]{
                new RJSAllowance.StandardAllowance(
                        RJSAllowanceDistribution.LINEAR,
                        new RJSAllowanceValue.TimePerDistance(4.5),
                        new RJSAllowanceRange[]{
                                new RJSAllowanceRange(
                                        0,
                                        rangeEndPos,
                                        new RJSAllowanceValue.TimePerDistance(5.5)
                                )
                        }
                )
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops, null));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops, null));

        var query = new StandaloneSimulationRequest(
                "tiny_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trains,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);

        var noAllowanceResult = simResult.baseSimulations.get(0);
        var noAllowanceTime =
                noAllowanceResult.headPositions.get(noAllowanceResult.headPositions.size() - 1).time;
        var linearResult = simResult.ecoSimulations.get(1);
        var linearTime = linearResult.headPositions.get(linearResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime + 4.5 * 60 * rangeEndPos / 1E5 + 5.5 * 60 * (10000 - rangeEndPos) / 1E5,
                linearTime,
                noAllowanceTime * 0.01);
        assertNull(simResult.ecoSimulations.get(0));
    }

    @Test
    public void withElectricalProfilesAndComfort() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        // Duplicate fast rolling stock but with many power classes
        var rollingStocks = new ArrayList<RJSRollingStock>();
        var trainSchedules = new ArrayList<RJSStandaloneTrainSchedule>();
        for (int i = 1; i <= 5; i++) {
            var rollingStock = getExampleRollingStock("fast_rolling_stock.json");
            rollingStock.name += i;
            rollingStock.powerClass = String.valueOf(i);
            rollingStocks.add(rollingStock);

            var trainSchedule = new RJSStandaloneTrainSchedule("Test." + i, rollingStock.name,
                    0, new RJSAllowance[0], new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)}, null);
            trainSchedules.add(trainSchedule);
        }
        var trainSchedule = new RJSStandaloneTrainSchedule("Test.1+AC", "fast_rolling_stock1",
                0, new RJSAllowance[0], new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)}, null);
        trainSchedule.comfort = RJSComfortType.AC;
        trainSchedules.add(trainSchedule);

        // build the simulation request
        var query = new StandaloneSimulationRequest(
                "small_infra/infra.json",
                "small_infra/external_generated_inputs.json",
                "1",
                2,
                rollingStocks,
                trainSchedules,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);
        var result1Standard = Iterables.getLast(simResult.baseSimulations.get(0).headPositions).time;
        var result1Ac = Iterables.getLast(simResult.baseSimulations.get(5).headPositions).time;

        assertTrue(result1Standard < result1Ac,
                "AC should be slower than standard, but was " + result1Standard + " vs " + result1Ac);

        for (int i = 1; i < 5; i++) {
            var resultA = Iterables.getLast(simResult.baseSimulations.get(i - 1).headPositions).time;
            var resultB = Iterables.getLast(simResult.baseSimulations.get(i).headPositions).time;
            assertTrue(resultA < resultB,
                    "Power class " + i + " should be faster than " + (i + 1)
                            + ", but was " + resultA + " vs " + resultB);
        }
    }

    @Test
    public void testModesAndProfilesInResult() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        // Duplicate fast rolling stock but with many power classes
        var rollingStock = getExampleRollingStock("fast_rolling_stock.json");
        rollingStock.powerClass = "5";

        var trainSchedule = new RJSStandaloneTrainSchedule("Test", rollingStock.name,
                0, new RJSAllowance[0], new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)}, null);
        trainSchedule.comfort = RJSComfortType.AC;

        // build the simulation request
        var query = new StandaloneSimulationRequest(
                "small_infra/infra.json",
                "small_infra/external_generated_inputs.json",
                "1",
                2,
                List.of(rollingStock),
                List.of(trainSchedule),
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);
        var modesAndProfiles = simResult.modesAndProfiles.get(0);
        System.out.println(modesAndProfiles);

        assertNotNull(modesAndProfiles);
        var modeAndProfile0 = modesAndProfiles.get(0);
        assertEquals(0.0, modeAndProfile0.start);
        assertEquals("1500", modeAndProfile0.seenMode);
        assertEquals("O", modeAndProfile0.seenProfile);
        assertEquals("thermal", modeAndProfile0.usedMode);
        assertNull(modeAndProfile0.usedProfile);

        assertEquals("25000", modesAndProfiles.get(1).usedProfile);

        var previousStart = modeAndProfile0.start;
        var profiles = new String[]{"25000", "22500", "20000", "22500", "25000"};
        var profileIndex = 0;
        for (var modeAndProfile: modesAndProfiles.subList(1, modesAndProfiles.size())) {
            assertTrue(previousStart < modeAndProfile.start);
            previousStart = modeAndProfile.start;
            assertNull(modeAndProfile.seenMode);
            assertNull(modeAndProfile.seenProfile);
            assertEquals("25000", modeAndProfile.usedMode);
            assertNotNull(modeAndProfile.usedProfile);
            if (!modeAndProfile.usedProfile.equals(profiles[profileIndex])) {
                profileIndex++;
            }
            assertEquals(profiles[profileIndex], modeAndProfile.usedProfile);
        }

        assertEquals(4, profileIndex);
    }
}