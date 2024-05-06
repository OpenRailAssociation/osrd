package fr.sncf.osrd.cli;

import static fr.sncf.osrd.utils.Helpers.getExampleRollingStock;
import static fr.sncf.osrd.utils.Helpers.getResourcePath;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import java.io.File;
import java.io.IOException;
import java.util.List;
import okio.FileSystem;
import okio.Okio;
import org.junit.jupiter.api.Test;

public class StandaloneSimulationCommandTest {
    @Test
    public void tinyInfraSimTest() throws IOException {
        // Create a simulation schedule
        var simulationInput = new StandaloneSimulationCommand.Input();
        simulationInput.rollingStocks = List.of(getExampleRollingStock("fast_rolling_stock.json"));
        var scheduleGroup = new StandaloneSimulationCommand.TrainScheduleGroup();
        scheduleGroup.id = "test";
        var stops = new RJSTrainStop[] {new RJSTrainStop(1., -1., false)};
        scheduleGroup.schedules =
                List.of(new RJSStandaloneTrainSchedule("Test.", "fast_rolling_stock", 0., null, stops));
        scheduleGroup.waypoints = new PathfindingWaypoint[][] {
            {
                new PathfindingWaypoint("ne.micro.foo_b", 100., EdgeDirection.START_TO_STOP),
                new PathfindingWaypoint("ne.micro.foo_b", 100., EdgeDirection.STOP_TO_START),
            },
            {
                new PathfindingWaypoint("ne.micro.bar_a", 100., EdgeDirection.START_TO_STOP),
                new PathfindingWaypoint("ne.micro.bar_a", 100., EdgeDirection.STOP_TO_START),
            },
        };
        simulationInput.trainScheduleGroups = List.of(scheduleGroup);

        // write the schedule to disk
        var simFilePath = File.createTempFile("osrd-core-sim-infra-", ".json");
        simFilePath.deleteOnExit();
        try (var sink = Okio.buffer(FileSystem.SYSTEM.sink(okio.Path.get(simFilePath)))) {
            StandaloneSimulationCommand.Input.adapter.toJson(sink, simulationInput);
        }

        // run the simulation
        var infraPath = getResourcePath("infras/tiny_infra/infra.json");
        var destPath = File.createTempFile("osrd-core-sim-infra-", ".json");
        destPath.deleteOnExit();
        var command = new StandaloneSimulationCommand(infraPath.toString(), simFilePath.getPath(), destPath.getPath());
        command.run();

        // read and parse back the output
        try (var source = Okio.buffer(FileSystem.SYSTEM.source(okio.Path.get(destPath)))) {
            var res = StandaloneSimulationCommand.simulationResultAdapter.fromJson(source);
            assertNotNull(res);
        }
    }
}
