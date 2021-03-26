package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import com.beust.jcommander.converters.PathConverter;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.PrettyPrinter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

@Parameters(commandDescription = "Display nicely signals behaviors of an infra in railscript")
public final class PrettyPrintCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(PrettyPrintCommand.class);

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

    /** Runs the command, and return a status code */
    public int run() {
        try {
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
            return 0;
        } catch (InvalidInfraException exception) {
            logger.error("an error occurred while parsing the infrastructure", exception);
            return 1;
        } catch (IOException ioException) {
            logger.error("IO error", ioException);
            return 1;
        }
    }
}