package fr.sncf.osrd.cli

import com.beust.jcommander.Parameter
import com.beust.jcommander.Parameters
import com.squareup.moshi.JsonAdapter
import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.pathfinding.PathfindingBlocksEndpoint
import fr.sncf.osrd.api.pathfinding.pathfindingRequestAdapter
import fr.sncf.osrd.api.standalone_sim.SimulationEndpoint
import fr.sncf.osrd.api.standalone_sim.SimulationRequest
import fr.sncf.osrd.api.stdcm.STDCMEndpoint
import fr.sncf.osrd.api.stdcm.stdcmRequestAdapter
import fr.sncf.osrd.cli.ValidateInfra.parseRailJSONFromFile
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage
import java.io.IOException
import java.nio.file.Path
import java.util.concurrent.TimeUnit
import kotlin.time.measureTime
import okhttp3.OkHttpClient
import okio.buffer
import okio.source
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@Parameters(commandDescription = "Debug tool to reproduce a request based on a payload json file")
class ReproduceRequest : CliCommand {
    @Parameter(
        names = ["--stdcm-payload-path"],
        description = "Path to the json payload file to load",
    )
    private var stdcmPayloadPath: String? = null

    @Parameter(
        names = ["--pathfinding-payload-path"],
        description = "Path to the json payload file to load",
    )
    private var pathfindingPayloadPath: String? = null

    @Parameter(
        names = ["--simulation-payload-path"],
        description = "Path to the json payload file to load",
    )
    private var simulationPayloadPath: String? = null

    @Parameter(
        names = ["--editoast-url"],
        description = "The base URL of editoast (used to query infrastructures)",
    )
    private var editoastUrl = "http://localhost:8090/"

    @Parameter(
        names = ["--editoast-authorization"],
        description = "The HTTP Authorization header sent to editoast",
    )
    private var editoastAuthorization = "x-osrd-skip-authz"
    @Parameter(
        names = ["--railjson"],
        description = "Path to the railjson infra file, overriding the id given in the request",
    )
    private var railjson: String? = null
    @Parameter(
        names = ["--timetable-dir"],
        description = "Path to the timetable directory, must contain timetable_id.json",
    )
    private var timetableDirectory: String? = null
    private val logger: Logger = LoggerFactory.getLogger("ReproduceRequest")

    @ExcludeFromGeneratedCodeCoverage
    override fun run(): Int {
        try {
            val httpClient = OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build()
            val infraManager =
                if (railjson != null) {
                    val rjs = parseRailJSONFromFile(railjson)
                    val signalingSimulator = makeSignalingSimulator()
                    val infra = FullInfra.fromRJSInfra(rjs, signalingSimulator)
                    FileInfraProvider(infra)
                } else InfraManager(editoastUrl, editoastAuthorization, httpClient)
            val timetableProvider =
                if (timetableDirectory != null) JsonTimetableProvider(timetableDirectory!!)
                else TimetableDownloader(editoastUrl, editoastAuthorization, httpClient)
            val cacheManager = TimetableCacheManager(timetableProvider, timetableDirectory)

            fun <T> loadRequest(path: String, adapter: JsonAdapter<T>): T {
                val fileSource = Path.of(path).source()
                val bufferedSource = fileSource.buffer()
                return checkNotNull(adapter.fromJson(bufferedSource))
            }

            val time = measureTime {
                if (stdcmPayloadPath != null) {
                    logger.info("running stdcm request at $stdcmPayloadPath")
                    STDCMEndpoint(infraManager, cacheManager)
                        .run(loadRequest(stdcmPayloadPath!!, stdcmRequestAdapter))
                }
                if (pathfindingPayloadPath != null) {
                    logger.info("running pathfinding request at $pathfindingPayloadPath")
                    PathfindingBlocksEndpoint(infraManager)
                        .run(loadRequest(pathfindingPayloadPath!!, pathfindingRequestAdapter))
                }
                if (simulationPayloadPath != null) {
                    logger.info("running simulation request at $simulationPayloadPath")
                    val electricalProfileSetManager =
                        ElectricalProfileSetManager(editoastUrl, editoastAuthorization, httpClient)
                    SimulationEndpoint(infraManager, electricalProfileSetManager)
                        .run(loadRequest(simulationPayloadPath!!, SimulationRequest.adapter))
                }
            }
            logger.info("done in ${time.inWholeMilliseconds / 1_000.0} seconds")
        } catch (e: IOException) {
            throw RuntimeException(e)
        }
        return 0
    }
}

/**
 * Implement the InfraProvider interface using a railjson file. Used to reproduce requests without
 * needing to run any other part of the stack.
 */
data class FileInfraProvider(val infra: FullInfra) : InfraProvider {
    override fun getInfra(infraId: String?, expectedVersion: Int?): FullInfra {
        return infra
    }
}
