package fr.sncf.osrd.api

import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonReader
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.conflicts.TrainRequirementsById
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.time.Duration
import java.time.Instant
import java.time.ZonedDateTime
import kotlin.io.path.Path
import kotlin.math.pow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.asFlow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flatMapMerge
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okio.IOException
import okio.buffer
import okio.source
import org.slf4j.LoggerFactory

private const val PAGE_SIZE = 100
private const val N_RETRIES = 5

private val logger = LoggerFactory.getLogger(TimetableProvider::class.java)

interface TimetableProvider {
    fun getTimetableRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): STDCMRequirements
}

class TimetableDownloader(
    baseUrl: String,
    authenticationHeader: String,
    httpClient: OkHttpClient,
    maxParallelism: Int = 5,
) : APIClient(baseUrl, authenticationHeader, httpClient), TimetableProvider {

    val httpDispatcher = Dispatchers.IO.limitedParallelism(maxParallelism)

    @OptIn(ExperimentalCoroutinesApi::class)
    private fun fetchTrainRequirements(
        infraId: String,
        timetableId: TimetableId,
    ): Flow<TrainRequirementsById> = flow {
        val firstPageTrainRequirements = getTrainPaginatedRequirements(infraId, timetableId, 1)

        emitAll(firstPageTrainRequirements.results.asFlow())
        emitAll(
            (2..firstPageTrainRequirements.pageCount)
                .asFlow()
                // Limit the number of concurrent calls to the requirements endpoint.
                .flatMapMerge { page ->
                    flow {
                        val paginatedTrainRequirements =
                            getTrainPaginatedRequirements(infraId, timetableId, page)
                        emitAll(paginatedTrainRequirements.results.asFlow())
                    }
                }
                .flowOn(httpDispatcher)
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
            try {
                response = httpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    return response
                } else {
                    logger.error("Error when getting ${request.url}: $response")
                }
            } catch (e: IOException) {
                // This block is especially important for timeout errors, but we can retry after any
                // kind of IO error anyway
                logger.error("Exception when getting ${request.url}: $e")
            }
            val nextSleepDuration = 1_000 * 2.0.pow(tryCount).toLong()
            // Thread.sleep blocks the thread, which is usually bad in the context of
            // coroutines. But it's on purpose here: if the server has a temporary issue, we
            // don't want the next page to immediately take over while this one is waiting.
            Thread.sleep(nextSleepDuration)
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

    override fun getTimetableRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): STDCMRequirements {
        return runBlocking {
            val res = mutableMapOf<ZoneId, RangeSet<Double>>()
            val trainRequirementsById = fetchTrainRequirements(infraId, timetableId)
            trainRequirementsById.collect { trainRequirementById ->
                for (rjsRequirement in trainRequirementById.spacingRequirements) {
                    val requirement =
                        SpacingRequirement.fromRJSWithAddedTime(
                            rjsRequirement,
                            infra,
                            trainRequirementById.startTime.durationSinceEpoch(),
                        )
                    val set = res.computeIfAbsent(requirement.zone) { TreeRangeSet.create() }
                    set.add(Range.closedOpen(requirement.beginTime, requirement.endTime))
                }
            }
            STDCMRequirements(res)
        }
    }
}

class JsonTimetableProvider(val timetableDirectory: String) : TimetableProvider {
    override fun getTimetableRequirements(
        infraId: String,
        infra: RawInfra,
        timetableId: TimetableId,
    ): STDCMRequirements {
        val adapter: JsonAdapter<TrainRequirementsById> =
            Moshi.Builder()
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(TrainRequirementsById::class.java)
        val filePath = Path("$timetableDirectory/$timetableId.json")
        logger.info("Fetching timetable requirements at json file $filePath")

        val source = filePath.source().buffer()
        val jsonReader = JsonReader.of(source)
        jsonReader.beginArray()
        val res = mutableMapOf<ZoneId, RangeSet<Double>>()
        while (jsonReader.hasNext()) {
            val train = adapter.fromJson(jsonReader)!!
            for (rjsSpacingReq in train.spacingRequirements) {
                val spacingReq =
                    SpacingRequirement.fromRJSWithAddedTime(
                        rjsSpacingReq,
                        infra,
                        train.startTime.durationSinceEpoch(),
                    )
                val set = res.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
                set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
            }
        }

        return STDCMRequirements(res)
    }
}

val EPOCH_ZONED: ZonedDateTime = Instant.EPOCH.atZone(java.time.ZoneId.of("UTC"))

/** Returns the duration since EPOCH, in seconds, precise to the millisecond. */
fun ZonedDateTime.durationSinceEpoch(): Double {
    return Duration.between(EPOCH_ZONED, this).toMillis() / 1000.0
}
