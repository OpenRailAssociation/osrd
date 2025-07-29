package fr.sncf.osrd.api

import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory

private typealias ParsedRequirements = Map<ZoneId, TreeMap<Double, Range<Double>>>

private typealias TimetableId = Int

class TimetableCacheManager(
    baseUrl: String,
    authenticationHeader: String,
    httpClient: OkHttpClient,
) : APIClient(baseUrl, authenticationHeader, httpClient) {
    private val cache = ConcurrentHashMap<TimetableId, ParsedRequirements>()
    private val mutexes = ConcurrentHashMap<TimetableId, Mutex>()

    private val fetchDispatcher = Dispatchers.IO
    private val backgroundScope by lazy { CoroutineScope(SupervisorJob() + Dispatchers.Default) }

    private val logger = LoggerFactory.getLogger(TimetableCacheManager::class.java)

    /**
     * Returns the parsed requirements for a timetable, fetching it from editoast if not already
     * cached.
     */
    suspend fun get(infra: RawInfra, timetableId: TimetableId): ParsedRequirements =
        coroutineScope {
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
                    withContext(fetchDispatcher) { fetchTimetableRequirements(infra, timetableId) }
                cache[timetableId] = requirements
                mutexes.remove(timetableId)
                return@coroutineScope requirements
            }
        }

    /** Starts downloading all given timetable IDs in the background. Non-blocking. */
    fun startLoading(infra: RawInfra, timetableIds: List<TimetableId>) {
        for (timetableId in timetableIds) {
            backgroundScope.launch { get(infra, timetableId) }
        }
    }

    private fun fetchTimetableRequirements(
        infra: RawInfra,
        timetableId: TimetableId
    ): ParsedRequirements {
        logger.info("Fetching timetable requirements for $timetableId")

        val rangeSets = mutableMapOf<ZoneId, RangeSet<Double>>()
        for (rawReq in fetchRawRequirements(timetableId)) {
            val spacingReq = SpacingRequirement.fromRJS(rawReq, infra)
            val set = rangeSets.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
            set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
        }

        val res =
            rangeSets
                .map {
                    it.key to TreeMap(it.value.asRanges().associate { it.upperEndpoint() to it })
                }
                .toMap()

        logger.info("Saved timetable requirements for $timetableId")
        return res
    }

    private fun fetchRawRequirements(timetableId: TimetableId): Sequence<RJSSpacingRequirement> =
        sequence {
            // TODO: Double-check the exact editoast API
            val endpointPath = "timetable/$timetableId/requirements/"

            var nextPage: Int? = 1
            while (nextPage != null) {
                val request = buildRequest(endpointPath, "page=$nextPage")
                val response = httpClient.newCall(request).execute()
                if (!response.isSuccessful) throw UnexpectedHttpResponse(response)
                val parsed = editoastResponseAdapter.fromJson(response.body!!.source())!!

                yieldAll(parsed.results)

                nextPage = parsed.next
            }
        }

    private data class EditoastResponse(
        val next: Int?,
        val results: List<RJSSpacingRequirement>,
    )

    private val editoastResponseAdapter: JsonAdapter<EditoastResponse> =
        Moshi.Builder()
            .addLast(UnitAdapterFactory())
            .addLast(KotlinJsonAdapterFactory())
            .build()
            .adapter(EditoastResponse::class.java)
}
