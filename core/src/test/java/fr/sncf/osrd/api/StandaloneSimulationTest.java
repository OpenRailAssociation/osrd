package fr.sncf.osrd.api;

import static fr.sncf.osrd.utils.Helpers.getExampleRollingStock;
import static fr.sncf.osrd.utils.Helpers.getExampleRollingStocks;
import static fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage;
import static fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage.ElectrifiedUsage;
import static fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage.NeutralUsage;
import static fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage.NonElectrifiedUsage;
import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.api.StandaloneSimulationEndpoint.StandaloneSimulationRequest;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSComfortType;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSPowerRestrictionRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSSchedulePoint;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainScheduleOptions;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.standalone_sim.result.PowerRestrictionRange;
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
        var tracksRoute1 = new ArrayList<RJSDirectionalTrackRange>();
        tracksRoute1.add(
                new RJSDirectionalTrackRange("ne.micro.foo_b", 100, 175, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSRoutePath(
                "rt.buffer_stop_b->tde.foo_b-switch_foo", tracksRoute1, "BAL3"));

        var tracksRoute2 = new ArrayList<RJSDirectionalTrackRange>();
        tracksRoute2.add(new RJSDirectionalTrackRange(
                "ne.micro.foo_b", 175, 200, EdgeDirection.START_TO_STOP));
        tracksRoute2.add(new RJSDirectionalTrackRange(
                "ne.micro.foo_to_bar", 0, 10000, EdgeDirection.START_TO_STOP));
        tracksRoute2.add(new RJSDirectionalTrackRange(
                "ne.micro.bar_a", 0, 100, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSRoutePath(
                "rt.tde.foo_b-switch_foo->buffer_stop_c",
                tracksRoute2,
                "BAL3")
        );
        return trainPath;
    }

    /** Returns a small train path on small infra */
    public static RJSTrainPath smallInfraTrainPath() {
        var trainPath = new RJSTrainPath();
        var trackRanges1 = new ArrayList<RJSDirectionalTrackRange>();
        trackRanges1.add(new RJSDirectionalTrackRange("TA0", 1820, 2000, EdgeDirection.START_TO_STOP));
        trackRanges1.add(new RJSDirectionalTrackRange("TA6", 0, 9820, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSRoutePath("rt.DA2->DA5", trackRanges1, "BAL3"));
        return trainPath;
    }

    /**  */
    public StandaloneSimResult runStandaloneSimulation(StandaloneSimulationRequest request) throws
            OSRDError,
            IOException {
        // serialize the request
        var requestBody = StandaloneSimulationEndpoint.adapterRequest.toJson(request);

        // process it
        var rawResponse =
                readBodyResponse(new StandaloneSimulationEndpoint(infraManager, electricalProfileSetManager)
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
    public void withScheduledPoints() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{
                new RJSTrainStop(2000., 100),
                RJSTrainStop.lastStop(0.1)
        };
        var scheduledPoints = new RJSSchedulePoint[] {
            new RJSSchedulePoint(8000., 520.),
            new RJSSchedulePoint(-1., 800.)
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("control_train", "fast_rolling_stock",
                0, null, stops, null));
        trains.add(new RJSStandaloneTrainSchedule("tested_train", "fast_rolling_stock",
                0, scheduledPoints, stops));

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

        var controlTrain = simResult.baseSimulations.get(0);
        assertNull(simResult.ecoSimulations.get(0));
        var controlTime =
                controlTrain.headPositions.get(controlTrain.headPositions.size() - 1).time;
        var testedTrain = simResult.ecoSimulations.get(1);
        var testedTime = testedTrain.headPositions.get(testedTrain.headPositions.size() - 1).time;
        assertTrue(testedTime > controlTime);
        assertEquals(800., testedTime, 1.0);
    }

    @Test
    public void engineeringAllowance() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var allowance = new RJSAllowance[]{new RJSAllowance.EngineeringAllowance(
                RJSAllowanceDistribution.MARECO, 0, 1000, new RJSAllowanceValue.Time(5), 1
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
        assertEquals(noAllowanceTime + 5, allowanceTime, noAllowanceTime * 0.01);
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
        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var trainSchedules = new ArrayList<RJSStandaloneTrainSchedule>();
        for (int i = 1; i <= 5; i++) {
            var rollingStock = getExampleRollingStock("electric_rolling_stock.json");
            rollingStock.name += i;
            rollingStock.basePowerClass = String.valueOf(i);
            rollingStocks.add(rollingStock);

            var trainSchedule = new RJSStandaloneTrainSchedule("Test." + i, rollingStock.name, 0, null, stops, null);
            trainSchedules.add(trainSchedule);
        }
        var trainSchedule = new RJSStandaloneTrainSchedule("Test", "electric_rolling_stock1", 0, null, stops, null,
                RJSComfortType.AC, null, null);
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
    public void testWithPowerRestrictions() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var powerRestrictionRanges = new RJSPowerRestrictionRange[] {
                new RJSPowerRestrictionRange(0., 2000., "C1"),
                new RJSPowerRestrictionRange(2000., 6000., "C2"),
                new RJSPowerRestrictionRange(6000., 8000., "Unknown"),
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("with", "electric_rolling_stock", 0, null, stops, null,
                RJSComfortType.STANDARD, null, powerRestrictionRanges));
        trains.add(new RJSStandaloneTrainSchedule("without", "electric_rolling_stock", 0, null, stops, null));

        var query = new StandaloneSimulationRequest("small_infra/infra.json", "1", 2, getExampleRollingStocks(), trains,
                rjsTrainPath);

        var simResult = runStandaloneSimulation(query);
        var resultWith = Iterables.getLast(simResult.baseSimulations.get(0).headPositions).time;
        var resultWithout = Iterables.getLast(simResult.baseSimulations.get(1).headPositions).time;
        assertTrue(resultWith > resultWithout + 1,
                "With power restrictions should be a lot slower than without, but was "
                        + resultWith + " vs " + resultWithout);
    }

    @Test
    public void testWithPowerRestrictionsAndElectricalProfiles() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        var stops = new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)};
        var powerRestrictionRanges = new RJSPowerRestrictionRange[] {
                new RJSPowerRestrictionRange(0., 2000., "C1"),
                new RJSPowerRestrictionRange(2000., 6000., "C2"),
                new RJSPowerRestrictionRange(6000., 8000., "Unknown"),
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("with", "electric_rolling_stock", 0, null, stops, null,
                RJSComfortType.STANDARD, null, powerRestrictionRanges));
        trains.add(new RJSStandaloneTrainSchedule("without", "electric_rolling_stock", 0, null, stops, null));

        var query = new StandaloneSimulationRequest("small_infra/infra.json",
                "small_infra/external_generated_inputs.json", "1", 2, getExampleRollingStocks(), trains, rjsTrainPath);

        var simResult = runStandaloneSimulation(query);
        var resultWith = Iterables.getLast(simResult.baseSimulations.get(0).headPositions).time;
        var resultWithout = Iterables.getLast(simResult.baseSimulations.get(1).headPositions).time;
        assertNotEquals(resultWith, resultWithout, 0.001);
    }

    @Test
    public void testElectrificationRangesInResult() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        var rollingStock = getExampleRollingStock("electric_rolling_stock.json");

        var trainSchedule = new RJSStandaloneTrainSchedule("Test", rollingStock.name, 0, new RJSAllowance[0],
                new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) }, null, RJSComfortType.AC, null, null);

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

        var electrificationRanges = simResult.electrificationRanges.get(0);

        ElectrificationUsage[] expected = {
                new ElectrifiedUsage("1500V", true, "O", false),
                new NeutralUsage(true),
                new ElectrifiedUsage("25000V", true, "25000V", true),
                new ElectrifiedUsage("25000V", true, "22500V", true),
                new ElectrifiedUsage("25000V", true, "20000V", true),
                new ElectrifiedUsage("25000V", true, "22500V", true),
                new NeutralUsage(false),
                new ElectrifiedUsage("25000V", true, "22500V", true),
                new ElectrifiedUsage("25000V", true, "25000V", true),
        };

        assertArrayEquals(expected, electrificationRanges.stream().map(r -> r.electrificationUsage).toArray());
    }

    @Test
    public void testElectrificationRangesInResultWithIgnored() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        var rollingStock = getExampleRollingStock("electric_rolling_stock.json");

        var trainSchedule1 = new RJSStandaloneTrainSchedule("Test", rollingStock.name, 0, new RJSAllowance[0],
                new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) }, null, RJSComfortType.AC, null, null);

        var trainSchedule2 = new RJSStandaloneTrainSchedule("Test", rollingStock.name, 0, new RJSAllowance[0],
                new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) }, null, RJSComfortType.STANDARD,
                new RJSTrainScheduleOptions(true), null);

        // build the simulation request
        var query = new StandaloneSimulationRequest(
                "small_infra/infra.json",
                "small_infra/external_generated_inputs.json",
                "1",
                2,
                List.of(rollingStock),
                List.of(trainSchedule1, trainSchedule2),
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);
        var electrificationRanges1 = simResult.electrificationRanges.get(0);

        assertNotNull(electrificationRanges1);
        assertEquals(9, electrificationRanges1.size());

        var electrificationRanges2 = simResult.electrificationRanges.get(1);

        assertNotNull(electrificationRanges2);
        assertEquals(5, electrificationRanges2.size());
    }

    record PowerRestrictionUsage(String code, boolean handled) {
        static PowerRestrictionUsage from(PowerRestrictionRange r) {
            return new PowerRestrictionUsage(r.code, r.handled);
        }
    }

    @Test
    public void testElectrificationRangesInResultWithPowerRestriction() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        var rollingStock = getExampleRollingStock("electric_rolling_stock.json");

        var trainSchedule = new RJSStandaloneTrainSchedule("Test", rollingStock.name, 0, new RJSAllowance[0],
                new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) }, null, RJSComfortType.AC, null,
                new RJSPowerRestrictionRange[] { new RJSPowerRestrictionRange(90.0, 5000.0, "C2") });

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
        var electrificationRanges = simResult.electrificationRanges.get(0);

        ElectrificationUsage[] expected = {
                new ElectrifiedUsage("1500V", true, "O", false),
                new NeutralUsage(true),
                new ElectrifiedUsage("25000V", true, "25000V", true),
                new ElectrifiedUsage("25000V", true, "20000V", true),
                new ElectrifiedUsage("25000V", true, "22500V", true),
                new NeutralUsage(false),
                new ElectrifiedUsage("25000V", true, "22500V", true),
                new ElectrifiedUsage("25000V", true, "25000V", true),
        };

        assertArrayEquals(expected, electrificationRanges.stream().map(r -> r.electrificationUsage).toArray());

        var powerRestrictionRanges = simResult.powerRestrictionRanges.get(0);

        PowerRestrictionUsage[] expectedPowerRestrictionRanges = {
                new PowerRestrictionUsage("C2", false),
                new PowerRestrictionUsage("C2", true),
        };
        assertArrayEquals(expectedPowerRestrictionRanges,
                powerRestrictionRanges.stream().map(PowerRestrictionUsage::from).toArray());
    }


    @Test
    public void testElectrificationRangesThermalNonElectrified() throws IOException {
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
        var electrificationRanges = simResult.electrificationRanges.get(0);

        assertEquals(1, electrificationRanges.size());
        assertEquals(new NonElectrifiedUsage(), electrificationRanges.get(0).electrificationUsage);
    }

    @Test
    public void testElectrificationRangesThermalElectrified() throws IOException {
        final var rjsTrainPath = smallInfraTrainPath();

        // build the simulation request
        var trainSchedules = new ArrayList<RJSStandaloneTrainSchedule>();
        trainSchedules.add(new RJSStandaloneTrainSchedule("Test.", "fast_rolling_stock", 0,
                new RJSAllowance[0],
                new RJSTrainStop[]{RJSTrainStop.lastStop(0.1)}, null));
        var query = new StandaloneSimulationRequest(
                "small_infra/infra.json",
                "1",
                2,
                getExampleRollingStocks(),
                trainSchedules,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);
        var electrificationRanges = simResult.electrificationRanges.get(0);

        ElectrificationUsage[] expected = {
                new ElectrifiedUsage("1500V", false, null, true),
                new NeutralUsage(true),
                new ElectrifiedUsage("25000V", false, null, true),
                new NeutralUsage(false),
                new ElectrifiedUsage("25000V", false, null, true),
        };

        assertArrayEquals(expected, electrificationRanges.stream().map(r -> r.electrificationUsage).toArray());
    }
}
