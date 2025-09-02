package fr.sncf.osrd.api

import com.google.common.collect.ImmutableRangeSet
import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.conflicts.TrainRequirementsById
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.withLocalCache
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.time.Duration
import java.time.Instant
import java.time.ZonedDateTime
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.pow
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.slf4j.LoggerFactory

typealias TimetableId = Int

private const val PAGE_SIZE = 100

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
    baseUrl: String,
    authenticationHeader: String,
    httpClient: OkHttpClient,
    val localCacheLocation: String? = null,
) : APIClient(baseUrl, authenticationHeader, httpClient) {
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
        runBlocking { get(infraId, infra, timetableId) }
    }

    @WithSpan(value = "Fetching timetable content", kind = SpanKind.SERVER)
    private fun fetchTimetableRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): STDCMRequirements {
        logger.info("Fetching timetable requirements for $timetableId")

        val res = mutableMapOf<ZoneId, RangeSet<Double>>()
        val requirements =
            withLocalCache(
                localCacheLocation,
                "$timetableId.cbor",
                STDCMRequirements.SerializableMap.serializer(),
            ) {
                runBlocking {
                    val requirements = fetchTrainRequirements(infraId, infra, timetableId)
                    requirements.collect { spacingReq ->
                        val set = res.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
                        set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
                    }
                    STDCMRequirements(res).toSerializable()
                }
            }.toSTDCMRequirements()

        logger.info("Saved timetable requirements for $timetableId")
        return requirements
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private fun fetchTrainRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): Flow<SpacingRequirement> = flow {
        val firstPageTrainRequirements = getTrainPaginatedRequirements(infraId, timetableId, 1)
        emitAll(
            firstPageTrainRequirements.results
                .flatMap {
                    it.spacingRequirements.map { spacingReq ->
                        SpacingRequirement.fromRJSWithAddedTime(
                            spacingReq,
                            infra,
                            it.startTime.durationSinceEpoch(),
                        )
                    }
                }
                .asFlow()
        )
        emitAll(
            (2..firstPageTrainRequirements.pageCount)
                .asFlow()
                // Limit the number of concurrent calls to the requirements endpoint.
                .flatMapMerge(concurrency = 5) { page ->
                    flow {
                        val paginatedTrainRequirements =
                            getTrainPaginatedRequirements(infraId, timetableId, page)
                        paginatedTrainRequirements.results
                            .flatMap {
                                it.spacingRequirements.map { spacingReq ->
                                    SpacingRequirement.fromRJSWithAddedTime(
                                        spacingReq,
                                        infra,
                                        it.startTime.durationSinceEpoch(),
                                    )
                                }
                            }
                            .forEach { emit(it) }
                    }
                }
        )
    }

    private fun getTrainPaginatedRequirements(
        infraId: String,
        timetableId: TimetableId,
        page: Int,
    ): PaginatedRequirements {
        val endpointPath = "timetable/$timetableId/requirements/"
        val request =
            buildRequest(endpointPath, "infra_id=$infraId&page=$page&page_size=$PAGE_SIZE")
        val response = getWithRetries(request)
        return paginatedRequirementsAdapter.fromJson(response.body.source())!!
    }

    /** Try to access a request, retries on error with increasing delay */
    private fun getWithRetries(request: Request, nRetries: Int = N_RETRIES): Response {
        var response: Response? = null
        for (tryCount in 1..<nRetries) {
            response = httpClient.newCall(request).execute()
            if (response.isSuccessful) return response
            else {
                logger.error("Error when getting ${request.url}: $response")
                val nextSleepDuration = 1_000 * 2.0.pow(tryCount).toLong()
                Thread.sleep(nextSleepDuration)
            }
        }
        throw UnexpectedHttpResponse(response)
    }

    private data class PaginatedRequirements(
        @Json(name = "page_count") val pageCount: Int,
        val results: List<TrainRequirementsById>,
    )

    private val paginatedRequirementsAdapter: JsonAdapter<PaginatedRequirements> =
        Moshi.Builder()
            .addLast(UnitAdapterFactory())
            .addLast(KotlinJsonAdapterFactory())
            .build()
            .adapter(PaginatedRequirements::class.java)
}

val EPOCH_ZONED: ZonedDateTime = Instant.EPOCH.atZone(java.time.ZoneId.of("UTC"))

const val N_RETRIES = 5

/** Returns the duration since EPOCH, in seconds, precise to the millisecond. */
fun ZonedDateTime.durationSinceEpoch(): Double {
    return Duration.between(EPOCH_ZONED, this).toMillis() / 1000.0
}
