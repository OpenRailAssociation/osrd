package fr.sncf.osrd.cli;

import static fr.sncf.osrd.RawInfraRJSParserKt.parseRJSInfra;
import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.railjson.parser.RJSParser;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
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
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            logger.info("parsing json");
            var rjs = RJSParser.parseRailJSONFromFile(infraPath);
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
        } finally {
            recorder.report();
        }
    }
}
