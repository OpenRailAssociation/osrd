package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.sim_infra.api.PathPropertiesKt.makePathProperties;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.ImmutableMultimap;
import com.google.common.collect.Multimap;
import fr.sncf.osrd.DriverBehaviour;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.api.utils.PathPropUtils;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.stdcm.preprocessing.implementation.UnavailableSpaceBuilder;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.GraphAdapter;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.units.Distance;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class STDCMHelpers {
    /** Make the occupancy multimap of a train going from point A to B starting at departureTime */
    public static Multimap<Integer, OccupancySegment> makeOccupancyFromPath(
            FullInfra infra,
            Set<Pathfinding.EdgeLocation<Integer>> startLocations,
            Set<Pathfinding.EdgeLocation<Integer>> endLocations,
            double departureTime
    ) {
        var chunkPath = makeChunkPath(infra, startLocations, endLocations);
        var trainPath = makePathProperties(infra.rawInfra(), chunkPath);
        var result = StandaloneSim.run(
                infra,
                trainPath,
                chunkPath,
                EnvelopeTrainPath.from(infra.rawInfra(), trainPath),
                List.of(new StandaloneTrainSchedule(
                        REALISTIC_FAST_TRAIN,
                        0,
                        new ArrayList<>(),
                        List.of(new TrainStop(Distance.toMeters(trainPath.getLength()), 1)),
                        List.of(),
                        null,
                        RollingStock.Comfort.STANDARD,
                        null,
                        null
                )),
                2.,
                new DriverBehaviour(0, 0)
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
                infra.rawInfra(),
                infra.blockInfra(),
                occupancies,
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
    }

    /** Creates a chunk path object from start and end locations */
    private static ChunkPath makeChunkPath(
            FullInfra infra,
            Set<Pathfinding.EdgeLocation<Integer>> startLocations,
            Set<Pathfinding.EdgeLocation<Integer>> endLocations
    ) {
        var path = new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(block -> infra.blockInfra().getBlockLength(block))
                .runPathfinding(List.of(startLocations, endLocations));
        return PathPropUtils.makeChunkPath(infra.rawInfra(), infra.blockInfra(), path.ranges());
    }

    /** Returns how long the longest occupancy segment lasts, which is the minimum delay we need to add
     * between two identical trains */
    public static double getMaxOccupancyLength(Multimap<Integer, OccupancySegment> occupancies) {
        double maxOccupancyLength = 0;
        for (var block : occupancies.keySet()) {
            var endTime = 0.;
            var startTime = Double.POSITIVE_INFINITY;
            for (var occupancy : occupancies.get(block)) {
                endTime = Math.max(endTime, occupancy.timeEnd());
                startTime = Math.min(startTime, occupancy.timeStart());
            }
            maxOccupancyLength = Math.max(maxOccupancyLength, endTime - startTime);
        }
        return maxOccupancyLength;
    }

    /** Returns the time it takes to reach the end of the last block,
     * starting at speed 0 at the start of the first block*/
    static double getBlocksRunTime(FullInfra infra, List<Integer> blocks) {
        double time = 0;
        double speed = 0;
        for (var block : blocks) {
            var envelope = STDCMSimulations.simulateBlock(infra.rawInfra(), infra.blockInfra(), block, speed, 0,
                    REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., null, null);
            assert envelope != null;
            time += envelope.getTotalTime();
            speed = envelope.getEndSpeed();
        }
        return time;
    }

    /** Checks that the result don't cross in an occupied section */
    static void occupancyTest(STDCMResult res,
                              ImmutableMultimap<Integer, OccupancySegment> occupancyGraph) {
        occupancyTest(res, occupancyGraph, 0);
    }

    /** Checks that the result don't cross in an occupied section, with a certain tolerance for float inaccuracies */
    static void occupancyTest(
            STDCMResult res,
            ImmutableMultimap<Integer, OccupancySegment> occupancyGraph,
            double tolerance
    ) {
        var envelopeWrapper = new EnvelopeStopWrapper(res.envelope(), res.stopResults());
        var blocks = res.blocks().ranges();
        long currentBlockOffset = 0;
        for (var blockRange : blocks) {
            var block = blockRange.edge();
            var startBlockPosition = currentBlockOffset;
            currentBlockOffset += blockRange.end() - blockRange.start();
            var blockOccupancies = occupancyGraph.get(block);
            for (var occupancy : blockOccupancies) {
                var enterTime = res.departureTime() + envelopeWrapper.interpolateTotalTimeClamp(
                        Distance.toMeters(startBlockPosition + occupancy.distanceStart())
                );
                var exitTime = res.departureTime() + envelopeWrapper.interpolateTotalTimeClamp(
                        Distance.toMeters(startBlockPosition + occupancy.distanceEnd())
                );
                assertTrue(
                        enterTime + tolerance >= occupancy.timeEnd() || exitTime - tolerance <= occupancy.timeStart()
                );
            }
        }
    }

    /** This is just a short alias so that tests can be written in meters without being too verbose */
    public static long meters(double meters) {
        return Distance.fromMeters(meters);
    }
}
