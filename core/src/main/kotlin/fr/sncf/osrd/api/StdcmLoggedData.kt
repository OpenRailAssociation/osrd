package fr.sncf.osrd.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.path_properties.polymorphicElectrificationAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicElectricalProfileAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicSimulationResponseAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicSpeedLimitSourceAdapter
import fr.sncf.osrd.api.stdcm.OutputSimDebugData
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.stdcm.tracing.FailureExplainer
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import kotlinx.serialization.ExperimentalSerializationApi

@OptIn(ExperimentalSerializationApi::class)
class STDCMLoggedData(val s3Context: S3Context?) : Take {
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
        try {
            if (s3Context == null) {
                throw RuntimeException("S3 isn't setup")
            }
            // Parse request input
            val body = req.body()
            val traceId =
                adapterRequest.fromJson(body)?.traceId
                    ?: return RsWithStatus(RsText("missing request body"), 400)

            val result =
                STDCMLoggedDataResponse(
                    s3Context.readJsonFile(
                        "stdcm/requests/$traceId/output_simulation_data.json",
                        OutputSimDebugData.adapter,
                    ),
                    s3Context.readJsonFile(
                        "stdcm/requests/$traceId/failure.json",
                        FailureExplainer.Report.adapter,
                    ),
                )

            return RsWithStatus(RsWithBody(responseAdapterRequest.toJson(result)), 200)
        } catch (ex: Throwable) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex)
        }
    }

    data class STDCMLoggedDataRequest(
        /** Trace ID */
        @Json(name = "trace_id") val traceId: String
    )

    data class STDCMLoggedDataResponse(
        @Json(name = "simulation_data") val simulationData: OutputSimDebugData?,
        @Json(name = "failure") val failure: FailureExplainer.Report?,
    )

    companion object {
        @JvmField
        val adapterRequest: JsonAdapter<STDCMLoggedDataRequest> =
            Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(STDCMLoggedDataRequest::class.java)

        @JvmField
        val responseAdapterRequest: JsonAdapter<STDCMLoggedDataResponse?> =
            Moshi.Builder()
                .add(polymorphicSimulationResponseAdapter)
                .add(polymorphicElectricalProfileAdapter)
                .add(polymorphicSpeedLimitSourceAdapter)
                .add(polymorphicElectrificationAdapter)
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(STDCMLoggedDataResponse::class.java)
    }
}
