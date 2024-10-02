package fr.sncf.osrd.api.api_v2.conflicts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class ConflictProjectionEndpoint(private val infraManager: InfraManager) : Take {
    override fun act(req: Request?): Response {
        return try {
            val body = RqPrint(req).printBody()
            val request =
                conflictProjectionRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            if (request.zones.isEmpty()) {
                return RsJson(RsWithBody(conflictProjectionResponseAdapter.toJson(listOf())))
            }

            val recorder = DiagnosticRecorderImpl(false)
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)

            for (zoneName in request.zones) {
                val zoneId = infra.rawInfra.getZoneFromName(zoneName)
                val bounds =
                    infra.rawInfra.getZoneBounds(zoneId).map {
                        val trackSection = infra.rawInfra.getDetectorTrackSection(it)
                        val trackOffset = infra.rawInfra.getDetectorTrackOffset(it)
                        return 0
                    }
            }

            return RsJson(RsWithBody(conflictProjectionResponseAdapter.toJson(listOf())))
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

class ConflictProjectionRequest(
    var infra: String,
    @Json(name = "expected_version") var expectedVersion: String,
    @Json(name = "path_track_ranges") val pathTrackRanges: Collection<TrackRange>,
    val zones: Collection<String>,
)

val conflictProjectionRequestAdapter: JsonAdapter<ConflictProjectionRequest> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ConflictProjectionRequest::class.java)

val conflictProjectionResponseAdapter: JsonAdapter<Collection<Pair<Int, Int>>> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(
            Types.newParameterizedType(Collection::class.java, Pair::class.java, Int::class.java)
        )
