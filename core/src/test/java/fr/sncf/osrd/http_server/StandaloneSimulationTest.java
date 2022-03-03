package fr.sncf.osrd.http_server;

import static fr.sncf.osrd.Helpers.getExampleRollingStocks;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.http_server.StandaloneSimulationEndpoint.StandaloneSimulationRequest;
import fr.sncf.osrd.http_server.StandaloneSimulationEndpoint.StandaloneSimulationResult;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.utils.graph.EdgeDirection;
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
                "rt.buffer_stop_b->tde.foo_b-switch_foo", tracksRoute1));
        var tracksRoute2 = new ArrayList<RJSTrainPath.RJSDirectionalTrackRange>();
        tracksRoute2.add(new RJSTrainPath.RJSDirectionalTrackRange(
                "ne.micro.foo_b", 175, 200, EdgeDirection.START_TO_STOP));
        tracksRoute2.add(new RJSTrainPath.RJSDirectionalTrackRange(
                "ne.micro.foo_to_bar", 0, 10000, EdgeDirection.START_TO_STOP));
        tracksRoute2.add(new RJSTrainPath.RJSDirectionalTrackRange(
                "ne.micro.bar_a", 0, 100, EdgeDirection.START_TO_STOP));
        trainPath.routePath.add(new RJSTrainPath.RJSRoutePath("rt.tde.foo_b-switch_foo->buffer_stop_c", tracksRoute2));
        return trainPath;
    }

    public static StandaloneSimulationResult runStandaloneSimulation(StandaloneSimulationRequest request) throws
            InvalidRollingStock,
            InvalidSchedule,
            IOException,
            InvalidInfraException {
        // serialize the request
        var requestBody = StandaloneSimulationEndpoint.adapterRequest.toJson(request);

        // process it
        var rawResponse = new RsPrint(new StandaloneSimulationEndpoint(infraHandlerMock)
                .act(new RqFake("POST", "/standalone_simulation", requestBody))
        ).printBody();

        // parse the response
        var response =  StandaloneSimulationEndpoint.adapterResult.fromJson(rawResponse);
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
                2,
                getExampleRollingStocks(),
                trainSchedules,
                rjsTrainPath
        );

        // parse back the simulation result
        var simResult = runStandaloneSimulation(query);
        var trainResult = simResult.baseSimulations.get(0);

        // ensure the position of the head and the tail of the train are always increasing
        var positions = trainResult.headPositions.toArray(new StandaloneSimulationEndpoint.SimulationResultPosition[0]);
        for (int i = 1; i < positions.length; i++)
            assertTrue(positions[i - 1].time <= positions[i].time);

        // ensure the speed is always increasing
        var speeds = trainResult.speeds.toArray(new StandaloneSimulationEndpoint.SimulationResultSpeed[0]);
        for (int i = 1; i < speeds.length; i++)
            assertTrue(speeds[i - 1].position <= speeds[i].position);
        assertEquals(8, trainResult.routeOccupancies.size());
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
                2,
                getExampleRollingStocks(),
                trainSchedules,
                rjsTrainPath
        );

        var simResult = runStandaloneSimulation(query);
        assertEquals(10, simResult.baseSimulations.size());
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
    public void withAllowance() throws Exception {
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
        assertEquals(noAllowanceTime * 1.05, marecoTime, noAllowanceTime * 0.001);
        assertNull(simResult.ecoSimulations.get(0));
    }
}