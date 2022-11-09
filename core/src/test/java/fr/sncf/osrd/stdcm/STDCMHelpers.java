package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.api.stdcm.UnavailableSpaceBuilder;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.GraphAdapter;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class STDCMHelpers {
    /** Make the occupancy multimap of a train going from point A to B starting at departureTime */
    public static Multimap<SignalingRoute, OccupancyBlock> makeOccupancyFromPath(
            SignalingInfra infra,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            double departureTime
    ) {
        var trainPath = makeTrainPath(infra, startLocations, endLocations);
        var result = StandaloneSim.run(
                infra,
                trainPath,
                List.of(new StandaloneTrainSchedule(
                        REALISTIC_FAST_TRAIN,
                        0,
                        List.of(new TrainStop(trainPath.length(), 1)),
                        List.of(),
                        List.of(),
                        // TODO: Get real comfort
                        RollingStock.Comfort.STANDARD
                )),
                2.
        );
        var rawOccupancies = result.baseSimulations.get(0).routeOccupancies;
        var occupancies = new ArrayList<STDCMRequest.RouteOccupancy>();
        for (var entry : rawOccupancies.entrySet()) {
            occupancies.add(new STDCMRequest.RouteOccupancy(
                    entry.getKey(),
                    departureTime + entry.getValue().timeHeadOccupy,
                    departureTime + entry.getValue().timeTailFree
            ));
        }
        return UnavailableSpaceBuilder.computeUnavailableSpace(
                infra,
                occupancies,
                REALISTIC_FAST_TRAIN
        );
    }

    /** Creates a train path object from start and end locations */
    private static TrainPath makeTrainPath(
            SignalingInfra infra,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations
    ) {
        var path = new Pathfinding<>(new GraphAdapter<>(infra.getSignalingRouteGraph()))
                .setEdgeToLength(route -> route.getInfraRoute().getLength())
                .runPathfinding(List.of(startLocations, endLocations));
        var routeList = path.ranges().stream()
                .map(Pathfinding.EdgeRange::edge)
                .toList();
        var firstRouteRange = path.ranges().get(0);
        var lastRouteRange = path.ranges().get(path.ranges().size() - 1);
        var firstTracks = firstRouteRange.edge().getInfraRoute()
                .getTrackRanges(firstRouteRange.start(), firstRouteRange.end());
        var lastTracks = lastRouteRange.edge().getInfraRoute()
                .getTrackRanges(lastRouteRange.start(), lastRouteRange.end());
        var lastTrackRange = lastTracks.get(lastTracks.size() - 1);
        return TrainPathBuilder.from(
                routeList,
                firstTracks.get(0).offsetLocation(0),
                lastTrackRange.offsetLocation(lastTrackRange.getLength())
        );
    }

    /** Returns how long the longest occupancy block lasts, which is the minimum delay we need to add
     * between two identical trains */
    public static double getMaxOccupancyLength(Multimap<SignalingRoute, OccupancyBlock> occupancies) {
        double maxOccupancyLength = 0;
        for (var route : occupancies.keySet()) {
            var endTime = 0.;
            var startTime = Double.POSITIVE_INFINITY;
            for (var occupancy : occupancies.get(route)) {
                endTime = Math.max(endTime, occupancy.timeEnd());
                startTime = Math.min(startTime, occupancy.timeStart());
            }
            maxOccupancyLength = Math.max(maxOccupancyLength, endTime - startTime);
        }
        return maxOccupancyLength;
    }
}
