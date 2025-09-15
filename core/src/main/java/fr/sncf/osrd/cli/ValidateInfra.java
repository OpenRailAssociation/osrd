package fr.sncf.osrd.cli;

import static fr.sncf.osrd.RawInfraRJSParserKt.parseRJSInfra;
import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.io.IOException;
import java.nio.file.Path;
import okio.Okio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Parameters(commandDescription = "Try to load an infra")
public class ValidateInfra implements CliCommand {

    @Parameter(
            names = {"--path"},
            description = "Path to the railjson file to load")
    private String infraPath;

    static final Logger logger = LoggerFactory.getLogger(ValidateInfra.class);

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public int run() {
        try {
            logger.info("parsing json");
            var rjs = parseRailJSONFromFile(infraPath);
            logger.info("parsing RailJSON");
            var rawInfra = parseRJSInfra(rjs);

            logger.info("loading signals");
            SignalingSimulator signalingSimulator = makeSignalingSimulator();
            var loadedSignalInfra = signalingSimulator.loadSignals(rawInfra);
            logger.info("building blocks");
            signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra);
            logger.info("done");
            return 0;
        } catch (Exception e) {
            e.printStackTrace();
            return 1;
        }
    }

    /** Parse the RailJSON file at the given Path */
    @SuppressFBWarnings(value = "RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE", justification = "that's a spotbugs bug :)")
    static RJSInfra parseRailJSONFromFile(String path) throws IOException {
        try (var fileSource = Okio.source(Path.of(path));
                var bufferedSource = Okio.buffer(fileSource)) {
            var rjsRoot = RJSInfra.adapter.fromJson(bufferedSource);
            assert rjsRoot != null;
            return rjsRoot;
        }
    }
}
