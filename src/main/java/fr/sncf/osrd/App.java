package fr.sncf.osrd;

import com.beust.jcommander.JCommander;
import com.beust.jcommander.Parameter;
import com.beust.jcommander.ParameterException;
import com.beust.jcommander.Parameters;
import com.beust.jcommander.converters.PathConverter;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.ConfigManager;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.RailJSONSerializer;
import fr.sncf.osrd.railml.RailMLParser;
import fr.sncf.osrd.simulation.ChangeSerializer;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.timetable.InvalidTimetableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Path;

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

        void run() throws IOException, InterruptedException, InvalidInfraException, InvalidTimetableException {
            try {
                logger.info("parsing the configuration file");
                Config config = ConfigManager.readConfigFile(configPath);

                logger.info("creating the simulation");
                var simulation = SimulationManager.fromConfig(config, true);

                logger.info("starting the simulation");
                simulation.run();

                ChangeSerializer.serializeChangeLog(simulation.changelog, outputChangelogPath);
            } catch (SimulationError simulationError) {
                logger.error("an logic error prevented the simulation from completing", simulationError);
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
            var rjsRoot = RailMLParser.parse(railMLInputPath);

            logger.info("serializing the infrastructure to RailJSON");
            RailJSONSerializer.serialize(rjsRoot, railJsonOutputPath);
        }
    }

    /**
     * The main entry point for OSRD.
     * @param args the command line arguments
     */
    public static void main(String[] args)
            throws IOException, InterruptedException, InvalidInfraException, InvalidTimetableException {

        // prepare the command line parser
        var simulateCommand = new SimulateCommand();
        var convertCommand = new ConvertCommand();
        var argsParser = JCommander.newBuilder()
                .addCommand("simulate", simulateCommand)
                .addCommand("convert", convertCommand)
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
            default:
                throw new RuntimeException("unknown parsed command");
        }
    }
}
