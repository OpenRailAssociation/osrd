package fr.sncf.osrd.api

import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import java.lang.ref.SoftReference
import java.util.concurrent.ConcurrentHashMap
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

    /** Generic cache, used to attach any kind of cache to this infra instance. See [getCache]. */
    val genericCache = ConcurrentHashMap<InfraCacheType<*>, SoftReference<Any>>()

    open class InfraCacheType<T>

    /**
     * Used to store extra cache data related to this specific infra. Typing is enforced by the
     * [InfraCacheType] typing. Can be extended by creating new data objects with the appropriate
     * type.
     */
    @Suppress("UNCHECKED_CAST")
    fun <T> getCache(cacheType: InfraCacheType<T>, init: () -> T): T {
        val newValue by lazy { init() }
        val existingCache =
            genericCache.computeIfAbsent(cacheType) { SoftReference(newValue) }.get()
        return (existingCache as T) ?: newValue
    }
}

data class InfraMetadata(val name: String, val version: Int = 0)
