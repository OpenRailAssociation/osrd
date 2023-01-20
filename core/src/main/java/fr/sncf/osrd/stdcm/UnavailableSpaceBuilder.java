package fr.sncf.osrd.stdcm;

import com.google.common.collect.HashMultimap;
import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import java.util.Collection;

public class UnavailableSpaceBuilder {

    /** Only used when we have missing signal data */
    private static final double DEFAULT_SIGHT_DISTANCE = 400;

    /** Computes the unavailable space for each route, i.e.
     * the times and positions where the *head* of the train cannot be.
     * This considers existing occupancy blocks, the length of the train,
     * and the routes that must be left available behind the train
     *
     * <br/>
     * This is the first step to compute STDCM, the goal is to get rid of railway rules and extra complexity
     * as soon as possible. After this step we can look for a single curve that avoids unavailable blocks. */
    public static Multimap<SignalingRoute, OccupancyBlock> computeUnavailableSpace(
            SignalingInfra infra,
            Collection<STDCMRequest.RouteOccupancy> occupancies,
            RollingStock rollingStock,
            double marginToAddBeforeEachBlock,
            double marginToAddAfterEachBlock
    ) {

        Multimap<SignalingRoute, OccupancyBlock> res = HashMultimap.create();

        for (var occupancy : occupancies) {

            var routeGraph = infra.getSignalingRouteGraph();
            var currentRoute = infra.findSignalingRoute(occupancy.id, "BAL3");
            var startRouteNode = routeGraph.incidentNodes(currentRoute).nodeU();
            var endRouteNode = routeGraph.incidentNodes(currentRoute).nodeV();
            var length = currentRoute.getInfraRoute().getLength();
            var timeStart = occupancy.startOccupancyTime - marginToAddBeforeEachBlock;
            var timeEnd = occupancy.endOccupancyTime + marginToAddAfterEachBlock;

            //Generating current block occupancy
            var block = new OccupancyBlock(timeStart, timeEnd, 0, length);
            res.put(currentRoute, block);

            //Generating sight Distance occupancy
            var predecessorRoutes = routeGraph.inEdges(startRouteNode);
            for (var predecessorRoute : predecessorRoutes) {
                var preBlockLength = predecessorRoute.getInfraRoute().getLength();
                double sightDistance = DEFAULT_SIGHT_DISTANCE;
                if (predecessorRoute.getExitSignal() != null)
                    sightDistance = predecessorRoute.getExitSignal().getSightDistance();
                var previousBlock = new OccupancyBlock(
                        timeStart,
                        timeEnd,
                        Math.max(0, preBlockLength - sightDistance),
                        preBlockLength
                );
                res.put(predecessorRoute, previousBlock);
            }

            //Generating successorRoute occupancy
            var successorRoutes = routeGraph.outEdges(endRouteNode);
            for (var successorRoute : successorRoutes) {
                var successorBlockLength = successorRoute.getInfraRoute().getLength();
                var successorBlock = new OccupancyBlock(timeStart, timeEnd, 0, successorBlockLength);
                res.put(successorRoute, successorBlock);
            }

            //Generating rollingStock length occupancy
            for (var successorRoute : successorRoutes) {
                var endSuccessorRoutesNode = routeGraph.incidentNodes(successorRoute).nodeV();
                var secondSuccessorRoutes = routeGraph.outEdges(endSuccessorRoutesNode);
                for (var secondSuccessorRoute : secondSuccessorRoutes) {
                    var end = Math.min(rollingStock.getLength(), secondSuccessorRoute.getInfraRoute().getLength());
                    var secondSuccessorBlock = new OccupancyBlock(timeStart, timeEnd, 0, end);
                    res.put(secondSuccessorRoute, secondSuccessorBlock);
                }
            }
        }
        return res;
    }
}
