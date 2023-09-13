package fr.sncf.osrd.stdcm.preprocessing.implementation;

import static fr.sncf.osrd.sim_infra.api.RawSignalingInfraKt.getRouteLength;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import com.google.common.collect.HashMultimap;
import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.InterlockingInfraKt;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.api.Route;
import fr.sncf.osrd.sim_infra.utils.BlockRecoveryKt;
import fr.sncf.osrd.stdcm.OccupancySegment;
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList;
import fr.sncf.osrd.utils.units.Distance;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

public class UnavailableSpaceBuilder {
    private static final long SIGHT_DISTANCE = Distance.fromMeters(400);

    /** Computes the unavailable space for each block, i.e.
     * the times and positions where the *head* of the train cannot be.
     * This considers existing occupancy segments, the length of the train,
     * and the blocks that must be left available behind the train
     * <br/>
     * This is the first step to compute STDCM, the goal is to get rid of railway rules and extra complexity
     * as soon as possible. After this step we can look for a single curve that avoids unavailable segment. */
    public static Multimap<Integer, OccupancySegment> computeUnavailableSpace(
            RawSignalingInfra infra,
            BlockInfra blockInfra,
            Collection<STDCMRequest.RouteOccupancy> occupancies,
            PhysicsRollingStock rollingStock,
            double marginToAddBeforeEachBlock,
            double marginToAddAfterEachBlock
    ) {

        Multimap<Integer, OccupancySegment> unavailableSpace = HashMultimap.create();

        for (var occupancy : occupancies) {
            var route = infra.getRouteFromName(occupancy.id);
            var length = getRouteLength(infra, route);
            var timeStart = occupancy.startOccupancyTime - marginToAddBeforeEachBlock;
            var timeEnd = occupancy.endOccupancyTime + marginToAddAfterEachBlock;

            //Generating current block occupancy
            addRouteOccupancy(unavailableSpace, infra, blockInfra, route, timeStart, timeEnd, 0, length);

            //Generating sight Distance occupancy
            var predecessorRoutes = getPreviousRoutes(infra, route);
            for (var predecessorRoute : predecessorRoutes) {
                var preBlockLength = getRouteLength(infra, predecessorRoute);
                addRouteOccupancy(
                        unavailableSpace,
                        infra,
                        blockInfra,
                        predecessorRoute,
                        timeStart,
                        timeEnd,
                        Math.max(0, preBlockLength - SIGHT_DISTANCE),
                        preBlockLength
                );
                var previousBlock = new OccupancySegment(
                        timeStart,
                        timeEnd,
                        Math.max(0, preBlockLength - SIGHT_DISTANCE),
                        preBlockLength
                );
                unavailableSpace.put(predecessorRoute, previousBlock);
            }

            //Generating successorRoute occupancy
            var successorRoutes = getNextRoutes(infra, route);
            for (var successorRoute : successorRoutes) {
                var successorBlockLength = getRouteLength(infra, successorRoute);
                addRouteOccupancy(
                        unavailableSpace,
                        infra,
                        blockInfra,
                        successorRoute,
                        timeStart,
                        timeEnd,
                        0,
                        successorBlockLength
                );
            }

            //Generating rollingStock length occupancy
            for (var successorRoute : successorRoutes) {
                var secondSuccessorRoutes = getNextRoutes(infra, successorRoute);
                for (var secondSuccessorRoute : secondSuccessorRoutes) {
                    var end = Math.min(
                            Distance.fromMeters(rollingStock.getLength()),
                            getRouteLength(infra, secondSuccessorRoute)
                    );
                    addRouteOccupancy(unavailableSpace, infra, blockInfra, secondSuccessorRoute,
                            timeStart, timeEnd, 0, end);
                }
            }
        }
        return unavailableSpace;
    }

    /** Sets the occupancy for a route interval, adding entries to any matching block.
     * This is a significant oversimplification, but it keeps the same behavior as before the kt infra migration,
     * making testing easier. This whole class is to be deleted when moving to a more accurate behavior.  */
    private static void addRouteOccupancy(
            Multimap<Integer, OccupancySegment> res,
            RawSignalingInfra infra,
            BlockInfra blockInfra,
            int route,
            double timeStart,
            double timeEnd,
            long distanceStart,
            long distanceEnd
    ) {
        var routeList = new MutableStaticIdxArrayList<Route>();
        routeList.add(route);
        for (var blockPath : BlockRecoveryKt.recoverBlocks(infra, blockInfra, routeList, null)) {
            var blockList = BlockRecoveryKt.toBlockList(blockPath);
            long routeOffset = 0;
            for (var blockId : toIntList(blockList)) {
                var blockLength = blockInfra.getBlockLength(blockId);
                var start = Math.max(0, distanceStart - routeOffset);
                var end = Math.min(blockLength, distanceEnd - routeOffset);
                if (start < end) {
                    var newSegment = new OccupancySegment(timeStart, timeEnd, start, end);
                    res.put(blockId, newSegment);
                }
                routeOffset += blockLength;
            }
        }
    }

    /** Returns the routes that lead into the given one */
    private static Set<Integer> getPreviousRoutes(RawSignalingInfra infra, int route) {
        var entry = InterlockingInfraKt.getRouteEntry(infra, route);
        return new HashSet<>(toIntList(infra.getRoutesEndingAtDet(entry)));
    }

    /** Returns the routes that follow the given one */
    private static Set<Integer> getNextRoutes(RawSignalingInfra infra, int route) {
        var exit = InterlockingInfraKt.getRouteExit(infra, route);
        return new HashSet<>(toIntList(infra.getRoutesStartingAtDet(exit)));
    }
}
