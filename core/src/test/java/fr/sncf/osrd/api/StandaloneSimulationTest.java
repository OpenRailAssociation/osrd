package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.getExampleRollingStocks;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.api.StandaloneSimulationEndpoint.StandaloneSimulationRequest;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.standalone_sim.result.ResultPosition;
import fr.sncf.osrd.standalone_sim.result.ResultSpeed;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;
import java.io.IOException;
import java.util.ArrayList;


class StandaloneSimulationTest extends ApiTest {

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

    public static StandaloneSimResult runStandaloneSimulation(StandaloneSimulationRequest request) throws
            InvalidRollingStock,
            InvalidSchedule,
            IOException {
        // serialize the request
        var requestBody = StandaloneSimulationEndpoint.adapterRequest.toJson(request);

        // process it
        var rawResponse = new RsPrint(new StandaloneSimulationEndpoint(infraHandlerMock)
                .act(new RqFake("POST", "/standalone_simulation", requestBody))
        ).printBody();

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
                new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) }));
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
                    new RJSTrainStop[]{ RJSTrainStop.lastStop(0.1) }));
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
        var noStops = new RJSTrainStop[] {
                new RJSTrainStop(2000., 0),
                new RJSTrainStop(5000., 1),
                RJSTrainStop.lastStop(0.1)
        };
        var stops = new RJSTrainStop[] {
                new RJSTrainStop(2000., 0),
                new RJSTrainStop(5000., 121),
                RJSTrainStop.lastStop(0.1)
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_stops", "fast_rolling_stock",
                0, null, noStops));
        trains.add(new RJSStandaloneTrainSchedule("stops", "fast_rolling_stock",
                0, null, stops));

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
        var stops = new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) };
        var allowance = new RJSAllowance[] {
                new RJSAllowance.Mareco(new RJSAllowanceValue.Percent(5)),
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops));

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
        var marecoResult = simResult.allowanceSimulations.get(1);
        var marecoTime = marecoResult.headPositions.get(marecoResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime * 1.05, marecoTime, noAllowanceTime * 0.01);
        assertNull(simResult.allowanceSimulations.get(0));
    }


    @Test
    public void withMarecoAllowanceRanges() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) };
        var rangeEndPos = 5000;
        var allowance = new RJSAllowance[] {
                new RJSAllowance.Mareco(
                        new RJSAllowanceValue.TimePerDistance(4.5),
                        new RJSAllowanceRange[] {
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
                0, null, stops));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops));

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
        var marecoResult = simResult.allowanceSimulations.get(1);
        var marecoTime = marecoResult.headPositions.get(marecoResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime + 4.5 * 60 * rangeEndPos / 1E5 + 5.5 * 60 * (10000 - rangeEndPos) / 1E5,
                marecoTime,
                noAllowanceTime * 0.01);
        assertNull(simResult.allowanceSimulations.get(0));
    }

    @Test
    public void withLinearAllowance() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) };
        var allowance = new RJSAllowance[] {
                new RJSAllowance.Linear(new RJSAllowanceValue.Percent(5)),
        };
        var trains = new ArrayList<RJSStandaloneTrainSchedule>();
        trains.add(new RJSStandaloneTrainSchedule("no_allowance", "fast_rolling_stock",
                0, null, stops));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops));

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
        var linearResult = simResult.allowanceSimulations.get(1);
        var linearTime = linearResult.headPositions.get(linearResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime * 1.05, linearTime, noAllowanceTime * 0.01);
        assertNull(simResult.allowanceSimulations.get(0));
    }

    @Test
    public void withLinearAllowanceRanges() throws Exception {
        // load the example infrastructure and build a test path
        final var rjsTrainPath = tinyInfraTrainPath();

        // build the simulation request
        var stops = new RJSTrainStop[] { RJSTrainStop.lastStop(0.1) };
        // TODO : build a method to get the path length in @{RJSTrainPath} and use it here and in the final asserts
        var rangeEndPos = 5000;
        var allowance = new RJSAllowance[] {
                new RJSAllowance.Linear(
                        new RJSAllowanceValue.TimePerDistance(4.5),
                        new RJSAllowanceRange[] {
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
                0, null, stops));
        trains.add(new RJSStandaloneTrainSchedule("allowance", "fast_rolling_stock",
                0, allowance, stops));

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
        var linearResult = simResult.allowanceSimulations.get(1);
        var linearTime = linearResult.headPositions.get(linearResult.headPositions.size() - 1).time;
        assertEquals(noAllowanceTime + 4.5 * 60 * rangeEndPos / 1E5 + 5.5 * 60 * (10000 - rangeEndPos) / 1E5,
                linearTime,
                noAllowanceTime * 0.01);
        assertNull(simResult.allowanceSimulations.get(0));
    }
}