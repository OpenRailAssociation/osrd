package fr.sncf.osrd.api

import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.impl.BlockInfraImpl
import fr.sncf.osrd.sim_infra.impl.LoadedSignalingInfraImpl
import fr.sncf.osrd.sim_infra.impl.RawInfraImpl
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.modules.SerializersModule
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@Serializable
data class FullInfra(
    val rawInfra: RawSignalingInfra,
    val loadedSignalInfra: LoadedSignalInfra,
    val blockInfra: BlockInfra,
    @Transient val signalingSimulator: SignalingSimulator = makeSignalingSimulator(),
) {
    companion object {
        val logger: Logger = LoggerFactory.getLogger(FullInfra::class.java)

        /** Builds a full infra from a railjson infra */
        fun fromRJSInfra(rjsInfra: RJSInfra, signalingSimulator: SignalingSimulator): FullInfra {
            // Parse railjson into a proper infra
            logger.info("parsing infra")

            logger.info("adaptation to kotlin")
            val rawInfra = parseRJSInfra(rjsInfra)

            logger.info("loading signals")
            val loadedSignalInfra = signalingSimulator.loadSignals(rawInfra)

            logger.info("building blocks")
            val blockInfra = signalingSimulator.buildBlocks(rawInfra, loadedSignalInfra)

            return FullInfra(rawInfra, loadedSignalInfra, blockInfra, signalingSimulator)
        }

        val serializerModule = SerializersModule {
            polymorphic(RawInfra::class, RawInfraImpl::class, RawInfraImpl.serializer())
            polymorphic(
                LoadedSignalInfra::class,
                LoadedSignalingInfraImpl::class,
                LoadedSignalingInfraImpl.serializer(),
            )
            polymorphic(BlockInfra::class, BlockInfraImpl::class, BlockInfraImpl.serializer())
        }
    }
}
