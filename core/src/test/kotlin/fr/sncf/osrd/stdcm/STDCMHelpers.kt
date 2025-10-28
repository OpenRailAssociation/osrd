package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.graph.STDCMSimulations
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions

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
                Comfort.STANDARD,
                2.0,
                null,
                null,
                null,
            )!!
        time += envelope.totalTime
        speed = envelope.endSpeed
    }
    return time
}

/** Helper function to call `simulateBlock` without instantiating an `STDCMSimulations` */
fun simulateBlock(
    rawInfra: RawSignalingInfra,
    infraExplorer: InfraExplorer,
    initialSpeed: Double,
    start: Offset<Block>,
    rollingStock: RollingStock,
    comfort: Comfort?,
    timeStep: Double,
    stopPosition: Offset<Block>?,
    trainTag: String?,
    temporarySpeedLimitManager: TemporarySpeedLimitManager?,
): Envelope? {
    val sim = STDCMSimulations()
    val res =
        sim.simulateBlock(
            rawInfra,
            infraExplorer,
            initialSpeed,
            start,
            rollingStock,
            comfort,
            timeStep,
            stopPosition,
            trainTag,
            temporarySpeedLimitManager,
        )
    sim.logWarnings()
    return res
}

/**
 * Checks that the result doesn't cross an occupied section, with a certain tolerance for binary
 * search inaccuracies
 */
fun occupancyTest(
    res: STDCMResult,
    occupancyGraph: ImmutableMultimap<BlockId, OccupancySegment>,
    tolerance: Double = 0.0,
) {
    val envelopeWrapper = EnvelopeStopWrapper(res.envelope, res.stopResults)
    val blocks = res.trainPath.getBlocks()
    for (blockRange in blocks) {
        val block = blockRange.value
        val blockOccupancies = occupancyGraph[block]
        for ((timeStart, timeEnd, distanceStart, distanceEnd) in blockOccupancies) {
            val enterTime =
                res.departureTime +
                    envelopeWrapper.interpolateArrivalAtClamp(
                        (blockRange.getObjectAbsolutePathStart() + distanceStart).meters
                    )
            val exitTime =
                res.departureTime +
                    envelopeWrapper.interpolateDepartureFromClamp(
                        (blockRange.getObjectAbsolutePathStart() + distanceEnd).meters
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
    block: BlockId,
): InfraExplorer {
    return initInfraExplorer(rawInfra, blockInfra, EdgeLocation(block, Offset(0.meters)))
        .elementAt(0)
}

fun stepsFromLocations(
    vararg locations: EdgeLocation<BlockId, Block>,
    stops: Boolean = false,
): List<STDCMStep> {
    val duration = if (stops) 0.0 else null
    return locations.map { STDCMStep(listOf(it), duration, stops) }
}

/**
 * Returns how long the longest requirement segment lasts, which is the minimum delay we need to add
 * between two identical trains
 */
fun getMaxOccupancyDuration(requirements: List<SpacingRequirement>): Double {
    return requirements.maxOf { it.endTime - it.beginTime }
}
