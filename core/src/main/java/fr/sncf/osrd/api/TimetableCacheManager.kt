package fr.sncf.osrd.api

import com.google.common.collect.ImmutableRangeSet
import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import fr.sncf.osrd.sim_infra.api.ZoneId
import io.lettuce.core.api.StatefulRedisConnection
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.nio.file.Files
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.Path
import kotlin.io.path.exists
import kotlin.io.path.readBytes
import kotlin.io.path.writeBytes
import kotlin.time.measureTime
import kotlinx.coroutines.*
import kotlinx.coroutines.future.await
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.cbor.Cbor
import kotlinx.serialization.decodeFromHexString
import kotlinx.serialization.encodeToHexString
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
 *
 * Supports two kinds of cache: either with valkey or in a local directory. When both are set, we
 * first look for the local file and then for a valkey entry.
 */
@ExperimentalSerializationApi
class TimetableCacheManager(
    val timetableProvider: TimetableProvider,
    val localCacheLocation: String? = null,
    val valkeyConnection: StatefulRedisConnection<String, String>? = null,
    val disableAllCaching: Boolean = false,
    val osrdGitDescribe: String,
) {
    private val cache = ConcurrentHashMap<String, STDCMRequirements>()
    private val mutexes = ConcurrentHashMap<String, Mutex>()

    private val fetchDispatcher = Dispatchers.IO

    private val logger = LoggerFactory.getLogger(TimetableCacheManager::class.java)

    /**
     * Returns the parsed requirements for a timetable, fetching it from editoast if not already
     * cached.
     */
    @WithSpan(value = "Accessing timetable content", kind = SpanKind.SERVER)
    suspend fun get(infra: FullInfra, timetableId: TimetableId): STDCMRequirements =
        coroutineScope {
            val cacheKey = getCacheKey(infra, timetableId)
            if (disableAllCaching) {
                logger.info("Cache disabled")
                return@coroutineScope withContext(fetchDispatcher) {
                    return@withContext fetchTimetableRequirements(infra, timetableId, cacheKey)
                }
            }
            cache[cacheKey]?.let {
                logger.debug("Timetable cache hit for ID $timetableId")
                return@coroutineScope it
            }

            val mutex = mutexes.computeIfAbsent(cacheKey) { Mutex() }
            mutex.withLock {
                try {
                    cache[cacheKey]?.let {
                        return@coroutineScope it
                    }
                    logger.info("Start computing timetable requirements")
                    val requirements: STDCMRequirements
                    val time = measureTime {
                        requirements =
                            withContext(fetchDispatcher) {
                                fetchTimetableRequirements(infra, timetableId, cacheKey)
                            }
                    }
                    cache[cacheKey] = requirements
                    val nEntries = requirements.entries.sumOf { it.value.asRanges().size }
                    logger.info(
                        "timetable requirements computed in ${time.inWholeSeconds} seconds, $nEntries map entries"
                    )
                    return@coroutineScope requirements
                } finally {
                    mutexes.remove(cacheKey)
                }
            }
        }

    /** Generates a string key for a given infra + timetable. */
    fun getCacheKey(infra: FullInfra, timetableId: TimetableId): String {
        val infraId = infra.metadata.name
        val infraVersion = infra.metadata.version
        return "$osrdGitDescribe-$infraId-$infraVersion-$timetableId"
    }

    /** Load given timetable ID. */
    @WithSpan(value = "Preloading timetable content", kind = SpanKind.SERVER)
    fun load(infra: FullInfra, timetableId: TimetableId) {
        if (!disableAllCaching) runBlocking { get(infra, timetableId) }
    }

    @WithSpan(value = "Fetching timetable content", kind = SpanKind.SERVER)
    private suspend fun fetchTimetableRequirements(
        infra: FullInfra,
        timetableId: TimetableId,
        cacheKey: String,
    ): STDCMRequirements {
        val requirements =
            withLocalCache(localCacheLocation, cacheKey) {
                withValkeyCache(valkeyConnection, cacheKey) {
                    timetableProvider.getTimetableRequirements(
                        infra.metadata.name,
                        infra.rawInfra,
                        timetableId,
                    )
                }
            }
        return requirements
    }

    /**
     * If a cache folder has been set, get the cached data if present, otherwise generate it and
     * write a new file. Directly calls the generator function if no cache folder has been set.
     */
    private suspend fun withLocalCache(
        cacheFolder: String?,
        cacheKey: String?,
        generateData: suspend () -> STDCMRequirements,
    ): STDCMRequirements {
        if (cacheFolder == null || cacheKey == null) return generateData()
        val filename = "$cacheKey.cbor"
        val folder = Path(cacheFolder)
        Files.createDirectories(folder)
        val file = folder.resolve(filename)
        val cbor = Cbor {}
        val serializer = STDCMRequirements.SerializableMap.serializer()

        if (file.exists()) {
            val bytes = file.readBytes()
            val serializableMap = cbor.decodeFromByteArray(serializer, bytes)
            logger.debug("local timetable file cache hit at {}", file)
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

    /**
     * Try to get the cached value from valkey, returns null if the value isn't cached or if an
     * error happened.
     */
    private suspend fun tryGetFromValkey(
        valkeyConnection: StatefulRedisConnection<String, String>,
        key: String,
    ): STDCMRequirements? {
        try {
            val async = valkeyConnection.async()
            val data = async.get(key).await() ?: return null
            logger.debug("valkey cache hit")

            val cbor = Cbor {}
            val serializer = STDCMRequirements.SerializableMap.serializer()
            val serializableMap = cbor.decodeFromHexString(serializer, data)
            return serializableMap.toSTDCMRequirements()
        } catch (e: Exception) {
            logger.warn("error when fetching valkey cache: ${e.message}")
            return null
        }
    }

    /** Write the value to valkey, not blocking. */
    private fun writeCacheToValkey(
        valkeyConnection: StatefulRedisConnection<String, String>,
        key: String,
        data: STDCMRequirements,
    ) {
        val async = valkeyConnection.async()
        val cbor = Cbor {}
        val serializer = STDCMRequirements.SerializableMap.serializer()
        val serialized = cbor.encodeToHexString(serializer, data.toSerializable())

        // One day and a half. Timetables should be relevant for one day before being replaced, we
        // keep them a little longer than that to be on the safe side.
        val expirationMS = 36L * 60L * 60L * 1000L

        async.psetex(key, expirationMS, serialized).exceptionally {
            logger.warn("failed to send cached timetable to valkey: ", it)
            null
        }
    }

    /**
     * If a valkey connection has been set, get the cached data if present, otherwise generate it
     * and write a new entry.
     */
    private suspend fun withValkeyCache(
        valkeyConnection: StatefulRedisConnection<String, String>?,
        cacheKey: String?,
        generateData: () -> STDCMRequirements,
    ): STDCMRequirements {
        if (valkeyConnection == null || cacheKey == null) {
            return generateData()
        }
        val key = "core-timetable-$cacheKey"
        tryGetFromValkey(valkeyConnection, key)?.let {
            return it
        }
        val data = generateData()
        writeCacheToValkey(valkeyConnection, key, data)
        return data
    }
}
