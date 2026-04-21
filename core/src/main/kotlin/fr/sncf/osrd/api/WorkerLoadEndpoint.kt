package fr.sncf.osrd.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import kotlinx.serialization.ExperimentalSerializationApi

@OptIn(ExperimentalSerializationApi::class)
class WorkerLoadEndpoint(
    private val infraManager: InfraManager,
    private val timetableManager: TimetableCacheManager,
) : Take {
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
        try {
            // Parse request input
            val body = req.body()
            val request: WorkerLoadRequest =
                adapterRequest.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            val infra = infraManager.load(request.infra, request.expectedVersion)
            val timetableId = request.timetable
            if (timetableId != null) timetableManager.startLoading(infra, timetableId)
            val isLoaded = timetableId == null || timetableManager.isLoaded(infra, timetableId)

            return RsWithStatus(
                RsWithBody(responseAdapterRequest.toJson(WorkerLoadResponse(isLoaded))),
                200,
            )
        } catch (ex: Throwable) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex)
        }
    }

    data class WorkerLoadRequest(
        /** Infra id */
        var infra: String,
        /** Infra version */
        @field:Json(name = "expected_version") var expectedVersion: Int?,
        /** Timetable ID */
        var timetable: Int?,
    )

    companion object {
        @JvmField
        val adapterRequest: JsonAdapter<WorkerLoadRequest?> =
            Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(WorkerLoadRequest::class.java)

        @JvmField
        val responseAdapterRequest: JsonAdapter<WorkerLoadResponse?> =
            Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(WorkerLoadResponse::class.java)
    }

    data class WorkerLoadResponse(
        /** Is everything loaded */
        var loaded: Boolean
    )
}
