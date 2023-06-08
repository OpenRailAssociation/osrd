package fr.sncf.osrd.cli;

import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;
import static fr.sncf.osrd.sim_infra_adapter.RawInfraAdapterKt.adaptRawInfra;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.parser.RJSParser;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Set;

@Parameters(commandDescription = "Try to load an infra")
public class ValidateInfra implements CliCommand {

    @Parameter(
            names = {"--path" },
            description = "Path to the railjson file to load"
    )
    private String infraPath;

    static final Logger logger = LoggerFactory.getLogger(ValidateInfra.class);

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public int run() {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            logger.info("parsing json");
            var rjs = RJSParser.parseRailJSONFromFile(infraPath);
            logger.info("loading legacy infra");
            var infra = SignalingInfraBuilder.fromRJSInfra(
                    rjs,
                    Set.of(new BAL3(recorder)),
                    recorder
            );
            logger.info("adapting raw infra");
            var rawInfra = adaptRawInfra(infra);
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
