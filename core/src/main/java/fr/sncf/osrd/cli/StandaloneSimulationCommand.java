package fr.sncf.osrd.cli;

import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;

import com.beust.jcommander.Parameter;
import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.pathfinding.PathfindingResultConverter;
import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import okio.FileSystem;
import okio.Okio;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class StandaloneSimulationCommand implements CliCommand {

    @Parameter(names = { "--infra_path" }, description = "Path to the infra railjson file to load", required = true)
    private String infraFilePath;

    @Parameter(names = { "--sim_path" }, description = "Path to the sim railjson file to load", required = true)
    private String simFilePath;

    @Parameter(names = { "--res_path" }, description = "Path to the result file to save", required = true)
    private String resultFilePath;

    private final DiagnosticRecorderImpl diagnosticRecorder = new DiagnosticRecorderImpl(false);

    private final SignalingSimulator signalingSimulator = makeSignalingSimulator();

    static final Logger logger = LoggerFactory.getLogger(StandaloneSimulationCommand.class);

    public static final JsonAdapter<Map<String, StandaloneSimResult>> simulationResultAdapter =
            new Moshi.Builder().build()
                    .adapter(Types.newParameterizedType(Map.class, String.class, StandaloneSimResult.class));

    StandaloneSimulationCommand(String infraFilePath, String simFilePath, String resultFilePath) {
        this.infraFilePath = infraFilePath;
        this.simFilePath = simFilePath;
        this.resultFilePath = resultFilePath;
    }

    public StandaloneSimulationCommand() {
    }

    @Override
    public int run() {
        // Load the infra
        FullInfra infra;
        logger.info("Loading infra: {}", infraFilePath);
        try {
            infra = loadInfra();
        } catch (IOException e) {
            displayError(e, "Failed to load infra: ");
            return 1;
        }

        // Load the simulation input
        Input input;
        logger.info("Loading input: {}", simFilePath);
        try {
            input = loadInput();
        } catch (IOException e) {
            displayError(e, "Failed to load input: ");
            return 1;
        }

        // Parse rolling stocks
        var rollingStocks = RJSRollingStockParser.parseCollection(input.rollingStocks);

        // Run all sims
        var results = new HashMap<String, StandaloneSimResult>();
        for (var trainScheduleGroup : input.trainScheduleGroups) {
            logger.info("Running simulation for schedule group: {}", trainScheduleGroup.id);
            var rawPathfindingResult = PathfindingRoutesEndpoint.runPathfinding(
                    infra.java(), trainScheduleGroup.waypoints, rollingStocks.values());
            var pathfindingResult = PathfindingResultConverter.convert(
                    rawPathfindingResult, infra.java(), diagnosticRecorder);
            var res = StandaloneSim.runFromRJS(
                    infra, null, new RJSTrainPath(pathfindingResult.routePaths), rollingStocks,
                    trainScheduleGroup.schedules, input.timeStep);
            res.addDepartureTimes(trainScheduleGroup.schedules.stream().map(s -> s.departureTime).toList());
            results.put(trainScheduleGroup.id, res);
        }
        logger.info("All simulations completed");

        // Save the results
        logger.info("Saving results at: {}", resultFilePath);
        try {
            saveResults(results);
        } catch (IOException e) {
            displayError(e, "Failed to save results: ");
            return 1;
        }

        return 0;
    }

    private void displayError(IOException e, String message) {
        System.err.println(message + e.getMessage());
        e.printStackTrace(System.err);
    }

    private FullInfra loadInfra() throws IOException {
        try (var source = Okio.buffer(FileSystem.SYSTEM.source(okio.Path.get(infraFilePath)))) {
            var rjsInfra = RJSInfra.adapter.fromJson(source);
            return FullInfra.fromRJSInfra(rjsInfra, diagnosticRecorder, signalingSimulator);
        }
    }

    private Input loadInput() throws IOException {
        try (var source = Okio.buffer(FileSystem.SYSTEM.source(okio.Path.get(simFilePath)))) {
            return Input.adapter.fromJson(source);
        }
    }

    private void saveResults(Map<String, StandaloneSimResult> results) throws IOException {
        try (var sink = Okio.buffer(FileSystem.SYSTEM.sink(okio.Path.get(resultFilePath)))) {
            simulationResultAdapter.toJson(sink, results);
        }
    }

    public static class TrainScheduleGroup {
        /** The waypoints to use for pathfinding */
        public PathfindingWaypoint[][] waypoints;

        /** The schedules to simulate on the path found */
        public List<RJSStandaloneTrainSchedule> schedules;

        /** The group's id. Used as a key in the mapping written as result */
        @NotNull
        public String id;

        TrainScheduleGroup() {
            id = "group.0";
            waypoints = new PathfindingWaypoint[0][];
            schedules = new ArrayList<>();
        }
    }

    public static class Input {
        public static final JsonAdapter<Input> adapter =
                new Moshi.Builder().add(ID.Adapter.FACTORY).add(RJSRollingResistance.adapter).add(RJSAllowance.adapter)
                        .add(RJSAllowanceValue.adapter).build().adapter(Input.class);

        /** The time step which shall be used for all simulations */
        @Json(name = "time_step")
        double timeStep = 2.0;

        /** A list of rolling stocks involved in the simulations */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** A list of trains schedule groups */
        @Json(name = "train_schedule_groups")
        public List<TrainScheduleGroup> trainScheduleGroups;
    }
}
