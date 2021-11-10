package fr.sncf.osrd.cli;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import com.beust.jcommander.converters.PathConverter;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railml.RailMLParser;
import fr.sncf.osrd.utils.moshi.MoshiUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.nio.file.Path;

@Parameters(commandDescription = "Converts RailML to RailJSON")
public final class ConvertCommand implements CliCommand {
    static final Logger logger = LoggerFactory.getLogger(ConvertCommand.class);

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

    /** Runs the command, and return a status code */
    public int run() {
        try {
            logger.info("parsing the RailML infrastructure");
            var rjsInfra = RailMLParser.parse(railMLInputPath);

            logger.info("serializing the infrastructure to RailJSON");
            MoshiUtils.serialize(RJSInfra.adapter, rjsInfra, railJsonOutputPath);
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