package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import com.beust.jcommander.converters.PathConverter;
import fr.sncf.osrd.DebugViewer;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.simulation.changelog.ChangeLogSummarizer;
import fr.sncf.osrd.speedcontroller.SpeedInstructions;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.train.decisions.TrainDecisionMaker;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.graph.FloydWarshall;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;

@Parameters(commandDescription = "Runs a simulation on a given infra, generates a simulation config")
@ExcludeFromGeneratedCodeCoverage
public final class TestInfraCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(TestInfraCommand.class);

    @Parameter(
            names = { "-i", "--infra" },
            description = "The railJSON file for the infra",
            required = true,
            converter = PathConverter.class
    )
    private Path infraPath;

    @Parameter(
            names = { "-r", "--rolling-stock" },
            description = "Path to the rolling stock json file",
            required = true,
            converter = PathConverter.class
    )
    private Path rollingStock;

    /** Runs the command, and return a status code */
    public int run() {
        try {
            var infra = Infra.parseFromFile(JsonConfig.InfraType.RAILJSON, String.valueOf(infraPath));
            logger.info("starting the simulation");
            var changeConsumers = new ArrayList<ChangeConsumer>();
            var changelog = new ArrayChangeLog();
            changeConsumers.add(changelog);

            // create the simulation and add change consumers
            var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
            var sim = Simulation.createFromInfraAndEmptySuccessions(infra, 0, multiplexer);
            multiplexer.add(DebugViewer.from(infra, true, 0.1));

            // insert the train start event into the simulation
            TrainCreatedEvent.plan(sim, makeLongestSchedule(infra));

            // run the simulation loop
            while (!sim.isSimulationOver())
                sim.step();

            logger.info("done simulating");
            ChangeLogSummarizer.summarize(changelog);
            return 0;
        } catch (SimulationError simulationError) {
            logger.error("an logic error prevented the simulation from completing", simulationError);
            return 1;
        } catch (InvalidInfraException | InvalidRollingStock | InvalidSchedule exception) {
            logger.error("an error occurred while parsing the input", exception);
            return 1;
        } catch (IOException ioException) {
            logger.error("IO error", ioException);
            return 1;
        }
    }

    private TrainSchedule makeLongestSchedule(Infra infra) throws IOException, InvalidRollingStock, InvalidSchedule {
        // Computes path
        var fw = FloydWarshall.from(infra.routeGraph);
        var longestPath = fw.getLongestPath();
        var startLocation = longestPath.get(0).tvdSectionsPaths.get(0).trackSections[0].getBeginLocation();
        var lastRoute = longestPath.get(longestPath.size() - 1);
        var lastTVDPath = lastRoute.tvdSectionsPaths.get(lastRoute.tvdSectionsPaths.size() - 1);
        var endLocation = lastTVDPath.trackSections[lastTVDPath.trackSections.length - 1].getEndLocation();
        var path = TrainPath.from(longestPath, startLocation, endLocation);

        // Get rolling stock
        var rjsRollingStock = MoshiUtils.deserialize(RJSRollingStock.adapter, rollingStock);
        var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);

        // Make phase
        var stops = Collections.singletonList(new TrainStop(path.length, 1));
        var phase = SignalNavigatePhase.from(
                400,
                startLocation,
                endLocation,
                path,
                stops,
                Collections.emptyList()
        );

        return new TrainSchedule(
                "trainID",
                rollingStock,
                0,
                startLocation,
                longestPath.get(0),
                0,
                Collections.singletonList(phase),
                new TrainDecisionMaker.DefaultTrainDecisionMaker(),
                path,
                new SpeedInstructions(Collections.emptyList()),
                stops
        );
    }
}