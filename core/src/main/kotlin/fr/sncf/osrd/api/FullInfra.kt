package fr.sncf.osrd.api

import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import org.slf4j.Logger
import org.slf4j.LoggerFactory

data class FullInfra(
    val rawInfra: RawSignalingInfra,
    val loadedSignalInfra: LoadedSignalInfra,
    val blockInfra: BlockInfra,
    val signalingSimulator: SignalingSimulator,
    val metadata: InfraMetadata,
) {
    companion object {
        val logger: Logger = LoggerFactory.getLogger(FullInfra::class.java)

        /** Builds a full infra from a railjson infra */
        fun fromRJSInfra(
            rjsInfra: RJSInfra,
            signalingSimulator: SignalingSimulator,
            metadata: InfraMetadata,
        ): FullInfra {
            // Parse railjson into a proper infra
            logger.info("parsing infra")

            logger.info("adaptation to kotlin")
            val rawInfra = parseRJSInfra(rjsInfra)

            logger.info("loading signals")
            val loadedSignalInfra = signalingSimulator.loadSignals(rawInfra)

            logger.info("building blocks")
            val blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra)

            return FullInfra(rawInfra, loadedSignalInfra, blockInfra, signalingSimulator, metadata)
        }
    }
}

data class InfraMetadata(val name: String, val version: Int = 0)
