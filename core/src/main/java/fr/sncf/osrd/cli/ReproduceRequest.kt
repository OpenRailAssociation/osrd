package fr.sncf.osrd.cli

import com.beust.jcommander.Parameter
import com.beust.jcommander.Parameters
import com.squareup.moshi.JsonAdapter
import fr.sncf.osrd.api.ElectricalProfileSetManager
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlocksEndpointV2
import fr.sncf.osrd.api.api_v2.pathfinding.pathfindingRequestAdapter
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationEndpoint
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationRequest
import fr.sncf.osrd.api.api_v2.stdcm.STDCMEndpointV2
import fr.sncf.osrd.api.api_v2.stdcm.stdcmRequestAdapter
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage
import java.io.IOException
import java.nio.file.Path
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okio.buffer
import okio.source
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@Parameters(commandDescription = "Debug tool to reproduce a request based on a payload json file")
class ReproduceRequest : CliCommand {
    @Parameter(
        names = ["--stdcm-payload-path"],
        description = "Path to the json payload file to load"
    )
    private var stdcmPayloadPath: String? = null

    @Parameter(
        names = ["--pathfinding-payload-path"],
        description = "Path to the json payload file to load"
    )
    private var pathfindingPayloadPath: String? = null

    @Parameter(
        names = ["--simulation-payload-path"],
        description = "Path to the json payload file to load"
    )
    private var simulationPayloadPath: String? = null

    @Parameter(
        names = ["--editoast-url"],
        description = "The base URL of editoast (used to query infrastructures)"
    )
    private var editoastUrl = "http://localhost:8090/"

    @Parameter(
        names = ["--editoast-authorization"],
        description = "The HTTP Authorization header sent to editoast"
    )
    private var editoastAuthorization = "x-osrd-skip-authz"
    private val logger: Logger = LoggerFactory.getLogger("Pathfinding")

    @ExcludeFromGeneratedCodeCoverage
    override fun run(): Int {
        try {
            val httpClient = OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build()
            val infraManager = InfraManager(editoastUrl, editoastAuthorization, httpClient)

            fun <T> loadRequest(path: String, adapter: JsonAdapter<T>): T {
                val fileSource = Path.of(path).source()
                val bufferedSource = fileSource.buffer()
                return checkNotNull(adapter.fromJson(bufferedSource))
            }
            if (stdcmPayloadPath != null) {
                logger.info("running stdcm request at $stdcmPayloadPath")
                STDCMEndpointV2(infraManager)
                    .run(loadRequest(stdcmPayloadPath!!, stdcmRequestAdapter))
            }
            if (pathfindingPayloadPath != null) {
                logger.info("running pathfinding request at $pathfindingPayloadPath")
                PathfindingBlocksEndpointV2(infraManager)
                    .run(loadRequest(pathfindingPayloadPath!!, pathfindingRequestAdapter))
            }
            if (simulationPayloadPath != null) {
                logger.info("running simulation request at $simulationPayloadPath")
                val electricalProfileSetManager =
                    ElectricalProfileSetManager(editoastUrl, editoastAuthorization, httpClient)
                SimulationEndpoint(infraManager, electricalProfileSetManager)
                    .run(loadRequest(simulationPayloadPath!!, SimulationRequest.adapter))
            }
            logger.info("done")
        } catch (e: IOException) {
            throw RuntimeException(e)
        }
        return 0
    }
}
