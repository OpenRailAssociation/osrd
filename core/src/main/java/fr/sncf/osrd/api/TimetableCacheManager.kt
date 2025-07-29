package fr.sncf.osrd.api

import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.conflicts.ParsedRequirements
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory

private typealias TimetableId = Int

private typealias WorkScheduleGroupId = Int

data class CacheEntry(
    val timetableId: TimetableId?,
    val workScheduleGroupId: WorkScheduleGroupId?,
)

class TimetableCacheManager(
    baseUrl: String,
    authenticationHeader: String,
    httpClient: OkHttpClient,
) : APIClient(baseUrl, authenticationHeader, httpClient) {
    private val cache = ConcurrentHashMap<CacheEntry, ParsedRequirements>()
    private val mutexes = ConcurrentHashMap<CacheEntry, Mutex>()

    private val fetchDispatcher = Dispatchers.IO
    private val backgroundScope by lazy { CoroutineScope(SupervisorJob() + Dispatchers.Default) }

    private val logger = LoggerFactory.getLogger(TimetableCacheManager::class.java)

    /**
     * Returns the parsed requirements for a timetable, fetching it from editoast if not already
     * cached.
     */
    suspend fun get(infra: RawInfra, cacheEntry: CacheEntry): ParsedRequirements = coroutineScope {
        cache[cacheEntry]?.let {
            logger.info("Timetable cache hit for ID $cacheEntry")
            return@coroutineScope it
        }

        val mutex = mutexes.computeIfAbsent(cacheEntry) { Mutex() }
        mutex.withLock {
            cache[cacheEntry]?.let {
                return@coroutineScope it
            }
            val requirements = fetchTimetableRequirements(infra, cacheEntry)
            cache[cacheEntry] = requirements
            mutexes.remove(cacheEntry)
            return@coroutineScope requirements
        }
    }

    /** Starts downloading all given timetable IDs in the background. Non-blocking. */
    fun startLoading(infra: RawInfra, cacheEntry: CacheEntry) {
        backgroundScope.launch { get(infra, cacheEntry) }
    }

    private suspend fun fetchTimetableRequirements(
        infra: RawInfra,
        cacheEntry: CacheEntry,
    ): ParsedRequirements {
        logger.info("Fetching timetable requirements for $cacheEntry")

        val rangeSets = mutableMapOf<ZoneId, RangeSet<Double>>()
        val requirements =
            merge(
                fetchTrainRequirements(infra, cacheEntry.timetableId).flowOn(fetchDispatcher),
                fetchWorkScheduleRequirements(infra, cacheEntry.workScheduleGroupId)
                    .flowOn(fetchDispatcher),
            )

        requirements.collect { spacingReq ->
            val set = rangeSets.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
            set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
        }

        val res =
            rangeSets
                .map { entry ->
                    entry.key to TreeMap(entry.value.asRanges().associateBy { it.upperEndpoint() })
                }
                .toMap()

        logger.info("Saved timetable requirements for $cacheEntry")
        return res
    }

    private fun fetchTrainRequirements(
        infra: RawInfra,
        timetableId: TimetableId?
    ): Flow<SpacingRequirement> = flow {
        if (timetableId == null) return@flow
        // TODO: Double-check the exact editoast API
        // Note: We could run a coroutine per page instead of iterating one page at a time,
        // once we get the first response and page count
        val endpointPath = "timetable/$timetableId/requirements/"

        var nextPage: Int? = 1
        while (nextPage != null) {
            val request = buildRequest(endpointPath, "page=$nextPage")
            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) throw UnexpectedHttpResponse(response)
            val parsed = paginatedRequirementsAdapter.fromJson(response.body!!.source())!!

            emitAll(parsed.results.map { SpacingRequirement.fromRJS(it, infra) }.asFlow())

            nextPage = parsed.next
        }
    }

    private fun fetchWorkScheduleRequirements(
        infra: RawInfra,
        workScheduleGroupId: WorkScheduleGroupId?
    ): Flow<SpacingRequirement> = flow {
        if (workScheduleGroupId == null) return@flow
        val endpointPath = "work_schedules/group/$workScheduleGroupId/"

        var nextPage: Int? = 1
        while (nextPage != null) {
            val request = buildRequest(endpointPath, "page=$nextPage")
            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) throw UnexpectedHttpResponse(response)
            val parsed = paginatedWorkSchedulesAdapter.fromJson(response.body!!.source())!!

            emitAll(
                convertWorkScheduleCollection(infra, parsed.results).spacingRequirements.asFlow()
            )

            nextPage = parsed.next
        }
    }

    private data class PaginatedRequirements(
        val next: Int?,
        val results: List<RJSSpacingRequirement>,
    )

    private data class PaginatedWorkSchedules(
        val next: Int?,
        val results: List<WorkSchedule>,
    )

    private val paginatedRequirementsAdapter: JsonAdapter<PaginatedRequirements> =
        Moshi.Builder()
            .addLast(UnitAdapterFactory())
            .addLast(KotlinJsonAdapterFactory())
            .build()
            .adapter(PaginatedRequirements::class.java)

    private val paginatedWorkSchedulesAdapter: JsonAdapter<PaginatedWorkSchedules> =
        Moshi.Builder()
            .addLast(UnitAdapterFactory())
            .addLast(KotlinJsonAdapterFactory())
            .build()
            .adapter(PaginatedWorkSchedules::class.java)
}
