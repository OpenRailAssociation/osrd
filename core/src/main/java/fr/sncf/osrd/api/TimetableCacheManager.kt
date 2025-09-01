package fr.sncf.osrd.api

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
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.time.Duration
import java.time.Instant
import java.time.ZonedDateTime
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory

typealias TimetableId = Int

typealias STDCMRequirements = Map<ZoneId, RangeSet<Double>>

private const val PAGE_SIZE = 100

/**
 * Caches train spacing requirements for STDCM. The spacing requirements times are relative to
 * EPOCH.
 */
class TimetableCacheManager(
    baseUrl: String,
    authenticationHeader: String,
    httpClient: OkHttpClient,
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
                cache[timetableId]?.let {
                    return@coroutineScope it
                }
                val requirements =
                    withContext(fetchDispatcher) {
                        fetchTimetableRequirements(infraId, infra, timetableId)
                    }
                cache[timetableId] = requirements
                mutexes.remove(timetableId)
                logger.info("End of computing of timetable requirements")
                return@coroutineScope requirements
            }
        }

    /** Load given timetable ID. */
    @WithSpan(value = "Preloading timetable content", kind = SpanKind.SERVER)
    fun load(infraId: String, infra: RawInfra, timetableId: TimetableId) {
        runBlocking { get(infraId, infra, timetableId) }
    }

    @WithSpan(value = "Fetching timetable content", kind = SpanKind.SERVER)
    private suspend fun fetchTimetableRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): STDCMRequirements {
        logger.info("Fetching timetable requirements for $timetableId")

        val res = mutableMapOf<ZoneId, RangeSet<Double>>()
        val requirements = fetchTrainRequirements(infraId, infra, timetableId)
        requirements.collect { spacingReq ->
            val set = res.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
            set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
        }

        logger.info("Saved timetable requirements for $timetableId")
        return res
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
        val response = httpClient.newCall(request).execute()
        if (!response.isSuccessful) throw UnexpectedHttpResponse(response)
        return paginatedRequirementsAdapter.fromJson(response.body.source())!!
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

/** Returns the duration since EPOCH, in seconds, precise to the millisecond. */
fun ZonedDateTime.durationSinceEpoch(): Double {
    return Duration.between(EPOCH_ZONED, this).toMillis() / 1000.0
}
