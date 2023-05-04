package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.HashMultimap
import com.google.common.collect.Multimap
import fr.sncf.osrd.api.stdcm.STDCMRequest.RouteOccupancy
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.stdcm.OccupancyBlock
import fr.sncf.osrd.train.RollingStock
import kotlin.math.max
import kotlin.math.min

/** Only used when we have missing signal data  */
private const val DEFAULT_SIGHT_DISTANCE = 400.0

/** Computes the unavailable space for each route, i.e.
 * the times and positions where the *head* of the train cannot be.
 * This considers existing occupancy blocks, the length of the train,
 * and the routes that must be left available behind the train
 *
 * <br></br>
 * This is the first step to compute STDCM, the goal is to get rid of railway rules and extra complexity
 * as soon as possible. After this step we can look for a single curve that avoids unavailable blocks.  */
fun computeUnavailableSpace(
    infra: SignalingInfra,
    occupancies: Collection<RouteOccupancy>,
    rollingStock: RollingStock,
    marginToAddBeforeEachBlock: Double,
    marginToAddAfterEachBlock: Double
): Multimap<SignalingRoute, OccupancyBlock> {
    val res: Multimap<SignalingRoute, OccupancyBlock> = HashMultimap.create()
    for (occupancy in occupancies) {
        val routeGraph = infra.signalingRouteGraph
        val currentRoute = infra.findSignalingRoute(occupancy.id, "BAL3")
        val startRouteNode = routeGraph.incidentNodes(currentRoute).nodeU()
        val endRouteNode = routeGraph.incidentNodes(currentRoute).nodeV()
        val length = currentRoute.infraRoute.length
        val timeStart = occupancy.startOccupancyTime - marginToAddBeforeEachBlock
        val timeEnd = occupancy.endOccupancyTime + marginToAddAfterEachBlock

        //Generating current block occupancy
        val block = OccupancyBlock(timeStart, timeEnd, 0.0, length)
        res.put(currentRoute, block)

        //Generating sight Distance occupancy
        val predecessorRoutes = routeGraph.inEdges(startRouteNode)
        for (predecessorRoute in predecessorRoutes) {
            val preBlockLength = predecessorRoute.infraRoute.length
            var sightDistance = DEFAULT_SIGHT_DISTANCE
            if (predecessorRoute.exitSignal != null)
                sightDistance = predecessorRoute.exitSignal.sightDistance
            val previousBlock = OccupancyBlock(
                timeStart,
                timeEnd,
                max(0.0, preBlockLength - sightDistance),
                preBlockLength
            )
            res.put(predecessorRoute, previousBlock)
        }

        //Generating successorRoute occupancy
        val successorRoutes = routeGraph.outEdges(endRouteNode)
        for (successorRoute in successorRoutes) {
            val successorBlockLength = successorRoute.infraRoute.length
            val successorBlock = OccupancyBlock(timeStart, timeEnd, 0.0, successorBlockLength)
            res.put(successorRoute, successorBlock)
        }

        //Generating rollingStock length occupancy
        for (successorRoute in successorRoutes) {
            val endSuccessorRoutesNode = routeGraph.incidentNodes(successorRoute).nodeV()
            val secondSuccessorRoutes = routeGraph.outEdges(endSuccessorRoutesNode)
            for (secondSuccessorRoute in secondSuccessorRoutes) {
                val end = min(rollingStock.getLength(), secondSuccessorRoute.infraRoute.length)
                val secondSuccessorBlock = OccupancyBlock(timeStart, timeEnd, 0.0, end)
                res.put(secondSuccessorRoute, secondSuccessorBlock)
            }
        }
    }
    return res
}