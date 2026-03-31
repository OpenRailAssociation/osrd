package fr.sncf.osrd.api

import com.google.common.collect.ImmutableRangeSet
import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.sim_infra.api.ZoneId
import io.lettuce.core.api.StatefulRedisConnection
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
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
import org.slf4j.LoggerFactory

typealias TimetableId = Int

data class STDCMTimetableData(
    /**
     * This map to range set is what we really need as stdcm input: for each zone, when it can (not)
     * be used.
     */
    val zoneUses: Map<ZoneId, RangeSet<Double>>,
    /**
     * This is metadata, only used to identify what happened and why. For each zone, we list when
     * it's occupied and by which train. Inefficient for simulation: uses can overlap, and the
     * lookup is in O(n).
     */
    val detailedRequirements: Map<ZoneId, List<DetailedRequirement>>,
) {
    @Serializable
    data class DetailedRequirement(val from: Double, val to: Double, val trainName: String?)

    fun toSerializable(): SerializableMap {
        return SerializableMap(detailedRequirements.mapKeys { it.key.index })
    }

    @Serializable
    data class SerializableMap(val detailedRequirements: Map<UInt, List<DetailedRequirement>>) {
        fun toSTDCMRequirements(): STDCMTimetableData {
            val detailedRequirements = detailedRequirements.mapKeys { ZoneId(it.key) }
            val zoneUses =
                detailedRequirements.mapValues { (_, requirements) ->
                    val map = TreeRangeSet.create<Double>()
                    for (req in requirements) map.add(Range.closed(req.from, req.to))
                    // ImmutableRangeSet has a faster lookup than TreeRangeSet, but
                    // can't handle overlapping ranges on build
                    ImmutableRangeSet.copyOf(map)
                }
            return STDCMTimetableData(zoneUses, detailedRequirements)
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
    val valkeyConnection: StatefulRedisConnection<ByteArray, ByteArray>? = null,
    val disableAllCaching: Boolean = false,
    val osrdGitDescribe: String,
    val s3Context: S3Context? = null,
) {
    private val cache = ConcurrentHashMap<String, STDCMTimetableData>()
    private val mutexes = ConcurrentHashMap<String, Mutex>()

    private val fetchDispatcher = Dispatchers.IO

    private val logger = LoggerFactory.getLogger(TimetableCacheManager::class.java)

    /**
     * Returns the parsed requirements for a timetable, fetching it from editoast if not already
     * cached.
     */
    @WithSpan(value = "Accessing timetable content", kind = SpanKind.SERVER)
    suspend fun get(infra: FullInfra, timetableId: TimetableId): STDCMTimetableData =
        coroutineScope {
            val cacheKey = getCacheKey(infra, timetableId)
            Span.current()?.setAttribute("timetable-cache-key", cacheKey)
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
                    val requirements: STDCMTimetableData
                    val time = measureTime {
                        requirements =
                            withContext(fetchDispatcher) {
                                fetchTimetableRequirements(infra, timetableId, cacheKey)
                            }
                    }
                    cache[cacheKey] = requirements
                    val nEntries = requirements.zoneUses.entries.sumOf { it.value.asRanges().size }
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

    @WithSpan(kind = SpanKind.SERVER)
    private suspend fun fetchTimetableRequirements(
        infra: FullInfra,
        timetableId: TimetableId,
        cacheKey: String,
    ): STDCMTimetableData {
        val requirements =
            withLocalCache(localCacheLocation, cacheKey) {
                withValkeyCache(valkeyConnection, cacheKey) {
                    timetableProvider.getTimetableData(
                        infra.metadata.name,
                        infra.rawInfra,
                        timetableId,
                    )
                }
            }

        // Once the requirements are loaded, we save them to s3 as well for reproducibility
        saveToS3(timetableId, requirements)

        return requirements
    }

    /**
     * If a cache folder has been set, get the cached data if present, otherwise generate it and
     * write a new file. Directly calls the generator function if no cache folder has been set.
     */
    private suspend fun withLocalCache(
        cacheFolder: String?,
        cacheKey: String?,
        generateData: suspend () -> STDCMTimetableData,
    ): STDCMTimetableData {
        if (cacheFolder == null || cacheKey == null) return generateData()
        val filename = "$cacheKey.cbor"
        val folder = Path(cacheFolder)
        Files.createDirectories(folder)
        val file = folder.resolve(filename)
        val cbor = Cbor {}
        val serializer = STDCMTimetableData.SerializableMap.serializer()

        if (file.exists()) {
            try {
                val bytes = file.readBytes()
                val serializableMap = cbor.decodeFromByteArray(serializer, bytes)
                logger.debug("local timetable file cache hit at {}", file)
                return serializableMap.toSTDCMRequirements()
            } catch (e: Exception) {
                logger.warn("failed to load valkey cached timetable data, reloading", e)
            }
        }
        val res = generateData.invoke()
        logger.info("writing timetable to local file cache at $file")
        val serializableMap = res.toSerializable()
        val bytes = cbor.encodeToByteArray(serializer, serializableMap)
        file.writeBytes(bytes)
        return res
    }

    /**
     * Try to get the cached value from valkey, returns null if the value isn't cached or if an
     * error happened.
     */
    @WithSpan(kind = SpanKind.SERVER)
    private suspend fun tryGetFromValkey(
        valkeyConnection: StatefulRedisConnection<ByteArray, ByteArray>,
        key: String,
    ): STDCMTimetableData? {
        try {
            val async = valkeyConnection.async()
            val byteKey = key.encodeToByteArray()
            val data = async.get(byteKey).await()?.decompress()

            val cacheHit = data != null
            Span.current()?.setAttribute("cache-hit", cacheHit)
            if (!cacheHit) return null

            logger.debug("valkey cache hit at key $key")
            return deserializeTimetable(data)
        } catch (e: Exception) {
            logger.warn("error when fetching valkey cache: ${e.message}")
            return null
        }
    }

    /** Deserializes the raw bytes into timetable data. Useful for its span. */
    @WithSpan(kind = SpanKind.SERVER)
    private fun deserializeTimetable(bytes: ByteArray): STDCMTimetableData {
        val cbor = Cbor {}
        val serializer = STDCMTimetableData.SerializableMap.serializer()
        val serializableMap = cbor.decodeFromByteArray(serializer, bytes)
        return serializableMap.toSTDCMRequirements()
    }

    /** Write the value to valkey, not blocking. */
    @WithSpan(kind = SpanKind.SERVER)
    private fun writeCacheToValkey(
        valkeyConnection: StatefulRedisConnection<ByteArray, ByteArray>,
        key: String,
        data: STDCMTimetableData,
    ) {
        val async = valkeyConnection.async()
        val cbor = Cbor {}
        val serializer = STDCMTimetableData.SerializableMap.serializer()
        val serialized = cbor.encodeToByteArray(serializer, data.toSerializable()).compress()

        // One day and a half. Timetables should be relevant for one day before being replaced, we
        // keep them a little longer than that to be on the safe side.
        val expirationMS = 36L * 60L * 60L * 1000L

        async.psetex(key.encodeToByteArray(), expirationMS, serialized).exceptionally {
            logger.warn("failed to send cached timetable to valkey: ", it)
            null
        }
    }

    /**
     * If a valkey connection has been set, get the cached data if present, otherwise generate it
     * and write a new entry.
     */
    private suspend fun withValkeyCache(
        valkeyConnection: StatefulRedisConnection<ByteArray, ByteArray>?,
        cacheKey: String?,
        generateData: () -> STDCMTimetableData,
    ): STDCMTimetableData {
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

    /** If there's no file yet with the given cache key, save the timetable in the s3 storage. */
    @WithSpan(kind = SpanKind.SERVER)
    private fun saveToS3(timetableId: TimetableId, requirements: STDCMTimetableData) {
        if (s3Context == null) return

        val objectPath = "stdcm/saved_timetables/$timetableId.cbor"
        s3Context.writeFileIfMissing(objectPath) {
            try {
                val serializable = requirements.toSerializable()
                val cbor = Cbor {}
                val serializer = STDCMTimetableData.SerializableMap.serializer()
                val bytes = cbor.encodeToByteArray(serializer, serializable)

                bytes
            } catch (e: Exception) {
                logger.error("failed to save timetable to s3", e)
                null
            }
        }
    }
}

fun ByteArray.compress(): ByteArray {
    val outputStream = ByteArrayOutputStream(this.size)
    GZIPOutputStream(outputStream).use { it.write(this) }
    return outputStream.toByteArray()
}

fun ByteArray.decompress(): ByteArray {
    return GZIPInputStream(this.inputStream()).use { it.readBytes() }
}
