package fr.sncf.osrd;

import com.beust.jcommander.JCommander;
import com.beust.jcommander.Parameter;
import com.beust.jcommander.ParameterException;
import com.beust.jcommander.Parameters;
import com.beust.jcommander.converters.PathConverter;
import fr.sncf.osrd.api.ApiServerCommand;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.PrettyPrinter;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railml.RailMLParser;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;

public class App {
    static final Logger logger = LoggerFactory.getLogger(App.class);

    @Parameters(commandDescription = "Runs a simulation")
    public static final class SimulateCommand {
        @Parameter(
                names = { "-c", "--config" },
                description = "The main JSON configuration file for the simulation",
                required = true,
                converter = PathConverter.class
        )
        private Path configPath;

        @Parameter(
                names = { "-o", "--output-changelog" },
                description = "Serialize the changelog to JSON, and write it to the given path",
                required = true,
                converter = PathConverter.class
        )
        private Path outputChangelogPath;

        void run() {
            try {
                logger.info("parsing the configuration file");
                Config config = Config.readFromFile(configPath);

                logger.info("starting the simulation");
                var changeConsumers = new ArrayList<ChangeConsumer>();
                var changelog = new ArrayChangeLog();
                changeConsumers.add(changelog);

                // create the simulation and add change consumers
                var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
                var sim = Simulation.createFromInfra(config.infra, 0, multiplexer);

                if (config.changeReplayCheck)
                    multiplexer.add(ChangeReplayChecker.from(sim));

                // create the viewer
                if (config.showViewer)
                    multiplexer.add(DebugViewer.from(config.infra, config.realTimeViewer));

                // insert the train start events into the simulation
                for (var trainSchedule : config.trainSchedules)
                    Scheduler.planTrain(sim, trainSchedule);

                // run the simulation loop
                while (!sim.isSimulationOver())
                    sim.step();

                ChangeSerializer.serializeChangeLog(changelog, outputChangelogPath);
            } catch (SimulationError simulationError) {
                logger.error("an logic error prevented the simulation from completing", simulationError);
            } catch (InvalidInfraException | InvalidRollingStock | InvalidSchedule exception) {
                logger.error("an error occurred while parsing the input", exception);
            } catch (IOException ioException) {
                logger.error("IO error", ioException);
            }
        }
    }

    @Parameters(commandDescription = "Converts RailML to RailJSON")
    public static final class ConvertCommand {
        @Parameter(
                names = { "-i", "--input" },
                description = "The RailML input file",
                required = true
        )
        private String railMLInputPath;

        @Parameter(
                names = { "-o", "--output" },
                description = "The path of the converted RailJSON file",
                required = true,
                converter = PathConverter.class
        )
        private Path railJsonOutputPath;

        void run() throws IOException, InvalidInfraException {
            logger.info("parsing the RailML infrastructure");
            var rjsInfra = RailMLParser.parse(railMLInputPath);

            logger.info("serializing the infrastructure to RailJSON");
            MoshiUtils.serialize(RJSInfra.adapter, rjsInfra, railJsonOutputPath);
        }
    }

    @Parameters(commandDescription = "Display nicely signals behaviors of an infra in railscript")
    public static final class PrettyPrintCommand {
        @Parameter(
                names = { "-i", "--input" },
                description = "The infra input file (supports RailML and RailJSON)",
                required = true
        )
        private String inputPath;

        @Parameter(
                names = { "-o", "--output" },
                description = "The path of the railscript file",
                converter = PathConverter.class
        )
        private Path railScriptOutputPath;

        void run() throws IOException, InvalidInfraException {
            // Setup pretty printer
            var stream = System.out;
            if (railScriptOutputPath != null) {
                stream = new PrintStream(railScriptOutputPath.toString(), StandardCharsets.UTF_8);
            }
            var printer = new PrettyPrinter(stream);

            logger.info("parsing the input infrastructure");
            var infra = Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, inputPath);

            logger.info("Pretty print signals behaviors to RailScript");
            printer.print(infra);
        }
    }

    /**
     * The main entry point for OSRD.
     * @param args the command line arguments
     */
    public static void main(String[] args)
            throws IOException, InvalidInfraException {

        // prepare the command line parser
        var simulateCommand = new SimulateCommand();
        var convertCommand = new ConvertCommand();
        var prettyPrintCommand = new PrettyPrintCommand();
        var apiServerCommand = new ApiServerCommand();
        var argsParser = JCommander.newBuilder()
                .addCommand("simulate", simulateCommand)
                .addCommand("convert", convertCommand)
                .addCommand("pretty-print-signals", prettyPrintCommand)
                .addCommand("api", apiServerCommand)
                .build();

        // parse the command line arguments
        try {
            argsParser.parse(args);
        } catch (ParameterException e) {
            e.usage();
            System.exit(1);
        }

        // get the name of the user command (help, simulate, convert, ...)
        var parsedCommand = argsParser.getParsedCommand();
        if (parsedCommand == null) {
            argsParser.usage();
            System.exit(1);
        }

        // run the user command
        switch (parsedCommand) {
            case "simulate":
                simulateCommand.run();
                break;
            case "convert":
                convertCommand.run();
                break;
            case "pretty-print-signals":
                prettyPrintCommand.run();
                break;
            case "api":
                apiServerCommand.run();
                break;
            default:
                throw new RuntimeException("unknown parsed command");
        }
    }
}
