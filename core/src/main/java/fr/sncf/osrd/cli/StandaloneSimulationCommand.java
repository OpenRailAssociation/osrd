package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSParser;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import java.io.BufferedWriter;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class StandaloneSimulationCommand implements CliCommand {

    @Parameter(
            names = {"--infra_path"},
            description = "Path to the infra railjson file to load",
            required = true
    )
    private String infraFilePath;

    @Parameter(
            names = {"--sim_path"},
            description = "Path to the sim railjson file to load",
            required = true
    )
    private String simFilePath;

    @Parameter(
            names = {"--res_path"},
            description = "Path to the result file to save",
            required = true
    )
    private String resultFilePath;

    public static final JsonAdapter<List<StandaloneSimResult>> simulationResultAdapter = new Moshi
            .Builder()
            .build()
            .adapter(Types.newParameterizedType(List.class, StandaloneSimResult.class));

    @Override
    public int run() {

        try (var writer = new BufferedWriter(
                new OutputStreamWriter(new FileOutputStream(resultFilePath), StandardCharsets.UTF_8))) {
            // Parse the entry files from json
            var rjsInfra = RJSParser.parseRailJSONFromFile(infraFilePath);
            var recorder = new DiagnosticRecorderImpl(true);
            final var signalingInfra = SignalingInfraBuilder.fromRJSInfra(
                    rjsInfra,
                    Set.of(new BAL3(recorder)),
                    recorder);
            recorder.report();

            var simFile = Files.readString(Path.of(simFilePath));
            var rjsSimulation = Objects.requireNonNull(RJSSimulation.adapter.fromJson(simFile));

            // Parse rolling stocks
            var rollingStocks = new HashMap<String, RollingStock>();

            for (var rjsRollingStock : rjsSimulation.rollingStocks) {
                rjsRollingStock.loadingGauge = RJSLoadingGaugeType.G1;
                rollingStocks.put(rjsRollingStock.getID(), RJSRollingStockParser.parse(rjsRollingStock));
            }

            // Add allowance
            var allowance = new RJSAllowance[]{
                    new RJSAllowance.StandardAllowance(RJSAllowanceDistribution.LINEAR,
                            new RJSAllowanceValue.Percent(5)),
            };

            var simulations = new ArrayList<StandaloneSimResult>();

            for (RJSTrainSchedule schedule : rjsSimulation.trainSchedules) {
                // Convert RJSTrainSchedule to RJSStandaloneTrainSchedule
                var standSched = new RJSStandaloneTrainSchedule(
                        schedule.id, schedule.rollingStock, schedule.initialSpeed,
                        allowance, schedule.stops, schedule.tag
                );

                var routeList = new ArrayList<SignalingRoute>();
                for (var routeID : schedule.routes)
                    routeList.add(signalingInfra.findSignalingRoute(routeID.id, "BAL3"));

                var startTrack = signalingInfra.getTrackSection(schedule.initialHeadLocation.trackSection.id);
                var startLocation = new TrackLocation(startTrack, schedule.initialHeadLocation.offset);
                var endTrack = signalingInfra.getTrackSection(schedule.finalHeadLocation.trackSection.id);
                var endLocation = new TrackLocation(endTrack, schedule.finalHeadLocation.offset);

                var trainsPath = TrainPathBuilder.from(routeList, startLocation, endLocation);
                var envelopePath = EnvelopeTrainPath.from(trainsPath);

                // Parse train schedules (from RJSStandaloneTrainSchedule to StandaloneTrainSchedule)
                var trainSchedules = new ArrayList<StandaloneTrainSchedule>();
                trainSchedules.add(RJSStandaloneTrainScheduleParser.parse(
                        signalingInfra, 2.0, rollingStocks::get, standSched, trainsPath, envelopePath));

                // Calculate the result for the given train path and schedules
                var result = StandaloneSim.run(signalingInfra, trainsPath, envelopePath, trainSchedules, 2.0);
                result.warnings = recorder.warnings;

                simulations.add(result);
            }

            // Parse the output to json format
            var strResult = simulationResultAdapter.toJson(simulations);

            writer.write(strResult);

        } catch (IOException e) {
            e.printStackTrace();
            return 1;
        }
        return 0;
    }
}
