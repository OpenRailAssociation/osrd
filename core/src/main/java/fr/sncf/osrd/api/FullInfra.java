package fr.sncf.osrd.api;

import static fr.sncf.osrd.sim_infra_adapter.RawInfraAdapterKt.adaptRawInfra;

import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorder;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra;
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Set;

public record FullInfra(SignalingInfra java,
                        SimInfraAdapter rawInfra,
                        LoadedSignalInfra loadedSignalInfra,
                        BlockInfra blockInfra,
                        SignalingSimulator signalingSimulator) {

    static final Logger logger = LoggerFactory.getLogger(FullInfra.class);

    /** Builds a full infra from a railjson infra */
    public static FullInfra fromRJSInfra(RJSInfra rjsInfra, DiagnosticRecorder diagnosticRecorder,
                                          SignalingSimulator signalingSimulator) {
        // Parse railjson into a proper infra
        logger.info("parsing infra");
        var infra = SignalingInfraBuilder.fromRJSInfra(
                rjsInfra,
                Set.of(new BAL3(diagnosticRecorder)),
                diagnosticRecorder
        );

        logger.info("adaptation to kotlin");
        var rawInfra = adaptRawInfra(infra);

        logger.info("loading signals");
        var loadedSignalInfra = signalingSimulator.loadSignals(rawInfra);

        logger.info("building blocks");
        var blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra);

        return new FullInfra(infra, rawInfra, loadedSignalInfra, blockInfra, signalingSimulator);
    }
}
