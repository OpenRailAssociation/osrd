package fr.sncf.osrd.api.api_v2.standalone_sim

import fr.sncf.osrd.api.ElectricalProfileSetManager
import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.parseRawSimulationScheduleItems
import fr.sncf.osrd.api.pathfinding.makeChunkPath
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.makePathProperties
import fr.sncf.osrd.standalone_sim.runStandaloneSimulation
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

class SimulationEndpoint(
    private val infraManager: InfraManager,
    private val electricalProfileSetManager: ElectricalProfileSetManager
) : Take {
    override fun act(req: Request): Response {
        // Parse request input
        val body = RqPrint(req).printBody()
        val request =
            SimulationRequest.adapter.fromJson(body)
                ?: return RsWithStatus(RsText("missing request body"), 400)

        val logRequest = System.getenv("LOG_SIMULATION_REQUESTS")
        if (logRequest?.equals("true", ignoreCase = true) == true) {
            val time = LocalDateTime.now()
            val formatted = time.format(DateTimeFormatter.ofPattern("MM-dd-HH:mm:ss:SSS"))
            File("simulation-$formatted.json").printWriter().use {
                it.println(SimulationRequest.adapter.indent("    ").toJson(request))
            }
        }
        return run(request)
    }

    fun run(request: SimulationRequest): Response {
        val recorder = DiagnosticRecorderImpl(false)
        try {
            // load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)

            // load electrical profile set
            val electricalProfileMap =
                electricalProfileSetManager.getProfileMap(request.electricalProfileSetId)

            // Parse rolling stocks
            val rollingStock = parseRawRollingStock(request.physicsConsist)

            // Parse path
            val chunkPath = makeChunkPath(infra.rawInfra, request.path.trackSectionRanges)
            val routePath = convertRoutePath(infra.rawInfra, request.path.routes)
            val pathProps = makePathProperties(infra.rawInfra, chunkPath, routePath.toList())
            val blockPath = mutableStaticIdxArrayListOf<Block>()
            for (blockName in request.path.blocks) {
                val blockId =
                    infra.blockInfra.getBlockFromName(blockName)
                        ?: throw OSRDError(ErrorType.UnknownBlock)
                blockPath.add(blockId)
            }

            val res =
                runStandaloneSimulation(
                    infra,
                    pathProps,
                    chunkPath,
                    routePath,
                    blockPath,
                    electricalProfileMap,
                    rollingStock,
                    request.comfort,
                    request.constraintDistribution.toRJS(),
                    request.speedLimitTag,
                    parsePowerRestrictions(request.powerRestrictions),
                    request.options.useElectricalProfiles,
                    2.0,
                    parseRawSimulationScheduleItems(request.schedule),
                    request.initialSpeed,
                    request.margins,
                    request.path.pathItemPositions,
                )
            return RsJson(RsWithBody(simulationResponseAdapter.toJson(res)))
        } catch (ex: Throwable) {
            if (ex is OSRDError && ex.osrdErrorType.isRecoverable) {
                val response = SimulationFailed(ex)
                return RsJson(RsWithBody(simulationResponseAdapter.toJson(response)))
            }
            return ExceptionHandler.handle(ex)
        }
    }

    private fun parsePowerRestrictions(
        powerRestrictions: List<SimulationPowerRestrictionItem>
    ): DistanceRangeMap<String> {
        val res = distanceRangeMapOf<String>()
        for (entry in powerRestrictions) {
            res.put(entry.from.distance, entry.to.distance, entry.value)
        }
        return res
    }

    /** Convert a list of route names into a route id list */
    private fun convertRoutePath(infra: RawInfra, routes: List<String>): StaticIdxList<Route> {
        val res = mutableStaticIdxArrayListOf<Route>()
        for (route in routes) res.add(infra.getRouteFromName(route))
        return res
    }
}
