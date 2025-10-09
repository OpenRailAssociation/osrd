package fr.sncf.osrd.api

import com.google.common.collect.ImmutableRangeSet
import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.nio.file.Files
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.Path
import kotlin.io.path.exists
import kotlin.io.path.readBytes
import kotlin.io.path.writeBytes
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.cbor.Cbor
import org.slf4j.LoggerFactory

typealias TimetableId = Int

@JvmInline
value class STDCMRequirements(val map: Map<ZoneId, RangeSet<Double>>) :
    Map<ZoneId, RangeSet<Double>> by map {

    fun toSerializable(): SerializableMap {
        return SerializableMap(
            map.entries.associate { (key, value) ->
                key.index to value.asRanges().map { SerializableRange.fromRange(it) }
            }
        )
    }

    @Serializable
    data class SerializableMap(val map: Map<UInt, List<SerializableRange>>) {
        fun toSTDCMRequirements(): STDCMRequirements {
            val converted =
                map.entries.associate { (key, value) ->
                    ZoneId(key) to SerializableRange.rangesToRangeSet(value)
                }
            return STDCMRequirements(converted)
        }
    }

    @Serializable
    data class SerializableRange(val from: Double, val to: Double) {
        companion object {
            fun fromRange(range: Range<Double>): SerializableRange {
                return SerializableRange(range.lowerEndpoint(), range.upperEndpoint())
            }

            fun rangesToRangeSet(ranges: List<SerializableRange>): RangeSet<Double> {
                val builder = ImmutableRangeSet.Builder<Double>()
                for (range in ranges) builder.add(Range.closed(range.from, range.to))
                return builder.build()
            }
        }
    }
}

/**
 * Caches train spacing requirements for STDCM. The spacing requirements times are relative to
 * EPOCH.
 */
class TimetableCacheManager(
    val timetableProvider: TimetableProvider,
    val localCacheLocation: String? = null,
    val disableAllCaching: Boolean = false,
) {
    private val cache = ConcurrentHashMap<TimetableId, STDCMRequirements>()
    private val mutexes = ConcurrentHashMap<TimetableId, Mutex>()

    private val fetchDispatcher = Dispatchers.IO

    private val logger = LoggerFactory.getLogger(TimetableCacheManager::class.java)

    /**
     * Returns the parsed requirements for a timetable, fetching it from editoast if not already
     * cached.
     */
    @WithSpan(value = "Accessing timetable content", kind = SpanKind.SERVER)
    suspend fun get(infraId: String, infra: RawInfra, timetableId: TimetableId): STDCMRequirements =
        coroutineScope {
            if (disableAllCaching) {
                logger.info("Cache disabled")
                return@coroutineScope withContext(fetchDispatcher) {
                    return@withContext fetchTimetableRequirements(infraId, infra, timetableId)
                }
            }
            logger.info("Start computing timetable requirements")
            cache[timetableId]?.let {
                logger.info("Timetable cache hit for ID $timetableId")
                return@coroutineScope it
            }

            val mutex = mutexes.computeIfAbsent(timetableId) { Mutex() }
            mutex.withLock {
                try {
                    cache[timetableId]?.let {
                        return@coroutineScope it
                    }
                    val requirements =
                        withContext(fetchDispatcher) {
                            fetchTimetableRequirements(infraId, infra, timetableId)
                        }
                    cache[timetableId] = requirements
                    logger.info("End of computing of timetable requirements")
                    return@coroutineScope requirements
                } finally {
                    mutexes.remove(timetableId)
                }
            }
        }

    /** Load given timetable ID. */
    @WithSpan(value = "Preloading timetable content", kind = SpanKind.SERVER)
    fun load(infraId: String, infra: RawInfra, timetableId: TimetableId) {
        if (!disableAllCaching) runBlocking { get(infraId, infra, timetableId) }
    }

    @WithSpan(value = "Fetching timetable content", kind = SpanKind.SERVER)
    private fun fetchTimetableRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): STDCMRequirements {
        logger.info("Fetching timetable requirements for $timetableId")

        val cacheFile = if (disableAllCaching) null else "$timetableId.cbor"
        val requirements =
            withLocalCache(localCacheLocation, cacheFile) {
                timetableProvider.getTimetableRequirements(infraId, infra, timetableId)
            }

        logger.info("Saved timetable requirements for $timetableId")
        return requirements
    }

    /**
     * If a cache folder has been set, get the cached data if present, otherwise generate it and
     * write a new file. Directly calls the generator function if no cache folder has been set.
     */
    @OptIn(ExperimentalSerializationApi::class)
    private fun withLocalCache(
        cacheFolder: String?,
        filename: String?,
        generateData: () -> STDCMRequirements,
    ): STDCMRequirements {
        if (cacheFolder == null || filename == null) return generateData()
        val folder = Path(cacheFolder)
        Files.createDirectories(folder)
        val file = folder.resolve(filename)
        val cbor = Cbor {}
        val serializer = STDCMRequirements.SerializableMap.serializer()

        if (file.exists()) {
            val bytes = file.readBytes()
            val serializableMap = cbor.decodeFromByteArray(serializer, bytes)
            logger.info("local timetable file cache hit at $file")
            return serializableMap.toSTDCMRequirements()
        } else {
            val map = generateData.invoke()
            logger.info("writing timetable to local file cache at $file")
            val serializableMap = map.toSerializable()
            val bytes = cbor.encodeToByteArray(serializer, serializableMap)
            file.writeBytes(bytes)
            return map
        }
    }
}
