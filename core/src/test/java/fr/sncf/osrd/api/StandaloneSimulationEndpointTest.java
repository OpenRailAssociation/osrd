package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.loadExampleSimulationResource;

import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;
import java.util.ArrayList;


class StandaloneSimulationEndpointTest extends ApiTest {
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

    @Test
    public void simple() throws Exception {
        final var rjsSimulation = loadExampleSimulationResource(getClass(), "tiny_infra/simulation.json");
        final var rjsTrainPath = tinyInfraTrainPath();

        var trainSchedules = new ArrayList<RJSStandaloneTrainSchedule>();
        trainSchedules.add(new RJSStandaloneTrainSchedule("Test.", "fast_rolling_stock", 0,
                new RJSTrainStop[] { new RJSTrainStop(-1., null, 0.1) }));

        var requestBody = StandaloneSimulationEndpoint.adapterRequest.toJson(
                new StandaloneSimulationEndpoint.StandaloneSimulationRequest(
                        "tiny_infra/infra.json",
                             rjsSimulation.rollingStocks,
                             trainSchedules,
                             rjsTrainPath
                )
        );

        var result = new RsPrint(new StandaloneSimulationEndpoint(infraHandlerMock)
                .act(new RqFake("POST", "/standalone_simulation", requestBody))
        ).printBody();

        var simResult =  StandaloneSimulationEndpoint.adapterResult.fromJson(result);
        assert simResult != null;
        var trainResult = simResult.trains.get("Test.");
        var positions = trainResult.headPositions.toArray(new StandaloneSimulationEndpoint.SimulationResultPosition[0]);
        for (int i = 1; i < positions.length; i++)
            assert positions[i - 1].time <= positions[i].time;
        positions = trainResult.tailPositions.toArray(new StandaloneSimulationEndpoint.SimulationResultPosition[0]);
        for (int i = 1; i < positions.length; i++)
            assert positions[i - 1].time <= positions[i].time;
        var speeds = trainResult.speeds.toArray(new StandaloneSimulationEndpoint.SimulationResultSpeed[0]);
        for (int i = 1; i < speeds.length; i++)
            assert speeds[i - 1].position <= speeds[i].position;
    }
}