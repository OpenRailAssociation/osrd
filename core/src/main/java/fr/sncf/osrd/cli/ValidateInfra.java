package fr.sncf.osrd.cli;

import static fr.sncf.osrd.api.SignalingSimulatorKt.makeSignalingSimulator;
import static fr.sncf.osrd.sim_infra_adapter.RawInfraAdapterKt.legacyAdaptRawInfra;
import static fr.sncf.osrd.RawInfraRJSParserKt.parseRJSInfra;
import static fr.sncf.osrd.utils.SimInfraAdapterComparatorUtilsKt.assertEqualSimInfra;

import com.beust.jcommander.Parameter;
import com.beust.jcommander.Parameters;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.parser.RJSParser;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Set;
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
            logger.info("loading legacy infra");
            logger.info("adapting raw infra");

            int warmupRounds = 2;
            int measurementRounds = 3;
            long totalControl = 0;
            long totalNew = 0;
            RawSignalingInfra controlInfra = null;
            RawSignalingInfra rawInfra = null;
            for (int i = 0; i < warmupRounds + measurementRounds; i++) {
                logger.info("round {}", i);
                var controlStart = System.nanoTime();
                var legacyInfra = SignalingInfraBuilder.fromRJSInfra(rjs, Set.of(new BAL3(recorder)), recorder);
                controlInfra = legacyAdaptRawInfra(legacyInfra);
                var controlDuration = System.nanoTime() - controlStart;

                var newStart = System.nanoTime();
                rawInfra = parseRJSInfra(rjs);
                var newDuration = System.nanoTime() - newStart;

                if (i < warmupRounds) continue;
                totalControl += controlDuration;
                totalNew += newDuration;
            }

            logger.info("total elapsed control: {}", (totalControl / (double) measurementRounds) / 1_000_000);
            logger.info("total elapsed new:     {}", (totalNew / (double) measurementRounds) / 1_000_000);

            assertEqualSimInfra(rawInfra, controlInfra);

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
