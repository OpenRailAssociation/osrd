package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import com.google.common.collect.Multimap
import fr.sncf.osrd.DriverBehaviour
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.makeChunkPath
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.graph.GraphAdapter
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.standalone_sim.StandaloneSim
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.graph.simulateBlock
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import fr.sncf.osrd.stdcm.preprocessing.implementation.computeUnavailableSpace
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.StandaloneTrainSchedule
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min
import org.junit.jupiter.api.Assertions

/** Make the occupancy multimap of a train going from point A to B starting at departureTime */
fun makeRequirementsFromPath(
    infra: FullInfra,
    startLocations: Set<PathfindingEdgeLocationId<Block>>,
    endLocations: Set<PathfindingEdgeLocationId<Block>>,
    departureTime: Double
): List<SpacingRequirement> {
    val chunkPath = makeChunkPath(infra, startLocations, endLocations)
    val trainPath = makePathProperties(infra.rawInfra, chunkPath)
    val result =
        StandaloneSim.run(
            infra,
            trainPath,
            chunkPath,
            EnvelopeTrainPath.from(infra.rawInfra, trainPath),
            listOf(
                StandaloneTrainSchedule(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    0.0,
                    ArrayList(),
                    listOf(TrainStop(trainPath.getLength().distance.meters, 1.0)),
                    listOf(),
                    null,
                    RollingStock.Comfort.STANDARD,
                    null,
                    null
                )
            ),
            2.0,
            DriverBehaviour(0.0, 0.0)
        )
    val rawOccupancies = result.baseSimulations[0].spacingRequirements
    val requirements = ArrayList<SpacingRequirement>()
    for (entry in rawOccupancies) {
        requirements.add(
            SpacingRequirement(
                entry.zone,
                departureTime + entry.beginTime,
                departureTime + entry.endTime,
                entry.isComplete,
            )
        )
    }
    return requirements
}

/** Make the route occupancies from a spacing requirement list */
fun makeOccupancyFromRequirements(
    infra: FullInfra,
    requirements: List<SpacingRequirement>
): Multimap<BlockId, OccupancySegment> {
    return computeUnavailableSpace(
        infra.rawInfra,
        infra.blockInfra,
        requirements,
        TestTrains.REALISTIC_FAST_TRAIN,
        0.0,
        0.0
    )
}

/** Creates a chunk path object from start and end locations */
private fun makeChunkPath(
    infra: FullInfra,
    startLocations: Set<PathfindingEdgeLocationId<Block>>,
    endLocations: Set<PathfindingEdgeLocationId<Block>>
): ChunkPath {
    val path =
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setEdgeToLength { block -> infra.blockInfra.getBlockLength(block) }
            .runPathfinding(listOf(startLocations, endLocations))!!
    return makeChunkPath(infra.rawInfra, infra.blockInfra, path.ranges)
}

/**
 * Returns how long the longest occupancy segment lasts, which is the minimum delay we need to add
 * between two identical trains
 */
fun getMaxOccupancyLength(occupancies: Multimap<BlockId, OccupancySegment>): Double {
    var maxOccupancyLength = 0.0
    for (block in occupancies.keySet()) {
        var endTime = 0.0
        var startTime = Double.POSITIVE_INFINITY
        for ((timeStart, timeEnd) in occupancies[block]) {
            endTime = max(endTime, timeEnd)
            startTime = min(startTime, timeStart)
        }
        maxOccupancyLength = max(maxOccupancyLength, endTime - startTime)
    }
    return maxOccupancyLength
}

/**
 * Returns the time it takes to reach the end of the last block, starting at speed 0 at the start of
 * the first block
 */
fun getBlocksRunTime(infra: FullInfra, blocks: List<BlockId>): Double {
    var time = 0.0
    var speed = 0.0
    for (block in blocks) {
        val envelope =
            simulateBlock(
                infra.rawInfra,
                infraExplorerFromBlock(infra.rawInfra, infra.blockInfra, block),
                speed,
                Offset(0.meters),
                TestTrains.REALISTIC_FAST_TRAIN,
                RollingStock.Comfort.STANDARD,
                2.0,
                null,
                null
            )!!
        time += envelope.totalTime
        speed = envelope.endSpeed
    }
    return time
}
/**
 * Checks that the result don't cross in an occupied section, with a certain tolerance for float
 * inaccuracies
 */
/** Checks that the result don't cross in an occupied section */
fun occupancyTest(
    res: STDCMResult,
    occupancyGraph: ImmutableMultimap<BlockId, OccupancySegment>,
    tolerance: Double = 0.0
) {
    val envelopeWrapper = EnvelopeStopWrapper(res.envelope, res.stopResults)
    val blocks = res.blocks.ranges
    var currentBlockOffset = 0.meters
    for (blockRange in blocks) {
        val block = blockRange.edge
        val startBlockPosition = currentBlockOffset
        currentBlockOffset += blockRange.end - blockRange.start
        val blockOccupancies = occupancyGraph[block]
        for ((timeStart, timeEnd, distanceStart, distanceEnd) in blockOccupancies) {
            val enterTime =
                res.departureTime +
                    envelopeWrapper.interpolateTotalTimeClamp(
                        (startBlockPosition + distanceStart).meters
                    )
            val exitTime =
                res.departureTime +
                    envelopeWrapper.interpolateTotalTimeClamp(
                        (startBlockPosition + distanceEnd).meters
                    )
            Assertions.assertTrue(
                enterTime + tolerance >= timeEnd || exitTime - tolerance <= timeStart
            )
        }
    }
}

/** Returns an infra explorer that contains the given block */
fun infraExplorerFromBlock(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    block: BlockId
): InfraExplorer {
    return initInfraExplorer(
            rawInfra,
            blockInfra,
            PathfindingEdgeLocationId(block, Offset(0.meters))
        )
        .elementAt(0)
}
