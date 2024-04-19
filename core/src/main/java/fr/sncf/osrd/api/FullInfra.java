package fr.sncf.osrd.api;

import static fr.sncf.osrd.RawInfraRJSParserKt.parseRJSInfra;

import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record FullInfra(
        RawSignalingInfra rawInfra,
        LoadedSignalInfra loadedSignalInfra,
        BlockInfra blockInfra,
        SignalingSimulator signalingSimulator) {

    static final Logger logger = LoggerFactory.getLogger(FullInfra.class);

    /** Builds a full infra from a railjson infra */
    public static FullInfra fromRJSInfra(RJSInfra rjsInfra, SignalingSimulator signalingSimulator) {
        // Parse railjson into a proper infra
        logger.info("parsing infra");

        logger.info("adaptation to kotlin");
        var rawInfra = parseRJSInfra(rjsInfra);

        logger.info("loading signals");
        var loadedSignalInfra = signalingSimulator.loadSignals(rawInfra);

        logger.info("building blocks");
        var blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra);

        return new FullInfra(rawInfra, loadedSignalInfra, blockInfra, signalingSimulator);
    }
}
