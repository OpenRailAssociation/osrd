package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.*
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.utils.getNextBlocks
import fr.sncf.osrd.sim_infra.utils.getPreviousBlocks
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.OccupancySegment
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Distance.Companion.max
import fr.sncf.osrd.utils.units.Distance.Companion.min
import fr.sncf.osrd.utils.units.meters

private val SIGHT_DISTANCE = 400.meters

/**
 * Computes the unavailable space for each block, i.e. the times and positions where the *head* of
 * the train cannot be. This considers existing occupancy segments, the length of the train, and the
 * blocks that must be left available behind the train <br></br> This is the first step to compute
 * STDCM, the goal is to get rid of railway rules and extra complexity as soon as possible. After
 * this step we can look for a single curve that avoids unavailable segment.
 */
fun computeUnavailableSpace(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    spacingRequirements: Collection<SpacingRequirement>,
    rollingStock: PhysicsRollingStock,
    marginToAddBeforeEachBlock: Double,
    marginToAddAfterEachBlock: Double
): Multimap<BlockId, OccupancySegment> {
    val unavailableSpace: Multimap<BlockId, OccupancySegment> = HashMultimap.create()
    val blockUse =
        buildBlockUse(
            rawInfra,
            blockInfra,
            spacingRequirements,
            marginToAddBeforeEachBlock,
            marginToAddAfterEachBlock
        )
    for ((blockId, useTimes) in blockUse) {
        val blockLength = blockInfra.getBlockLength(blockId)
        for (timeRange in useTimes.asRanges()) {

            // Generate current block occupancy
            unavailableSpace.put(
                blockId,
                OccupancySegment(
                    timeRange.lowerEndpoint(),
                    timeRange.upperEndpoint(),
                    0.meters,
                    blockLength.distance
                )
            )

            // Generate the warnings in blocks before the ones used by other trains
            val predecessorBlocks = blockInfra.getPreviousBlocks(rawInfra, blockId)
            for (predecessorBlock in predecessorBlocks) {
                val preBlockLength = blockInfra.getBlockLength(predecessorBlock)
                unavailableSpace.put(
                    predecessorBlock,
                    OccupancySegment(
                        timeRange.lowerEndpoint(),
                        timeRange.upperEndpoint(),
                        0.meters,
                        preBlockLength.distance
                    )
                )

                // Generate the sight distance requirements in the blocks before that
                for (secondPredecessorBlock in
                    blockInfra.getPreviousBlocks(rawInfra, predecessorBlock)) {
                    val secPreBlockLength = blockInfra.getBlockLength(secondPredecessorBlock)
                    unavailableSpace.put(
                        secondPredecessorBlock,
                        OccupancySegment(
                            timeRange.lowerEndpoint(),
                            timeRange.upperEndpoint(),
                            max(0.meters, secPreBlockLength.distance - SIGHT_DISTANCE),
                            secPreBlockLength.distance
                        )
                    )
                }
            }

            // Generate train length occupancy
            val successorBlocks = blockInfra.getNextBlocks(rawInfra, blockId)
            for (successorBlock in successorBlocks) {
                val nextBlockLength = blockInfra.getBlockLength(successorBlock)
                unavailableSpace.put(
                    successorBlock,
                    OccupancySegment(
                        timeRange.lowerEndpoint(),
                        timeRange.upperEndpoint(),
                        0.meters,
                        min(nextBlockLength.distance, fromMeters(rollingStock.length))
                    )
                )
            }
        }
    }
    // validation
    for ((key, value) in unavailableSpace.entries()) {
        assert(value.distanceStart <= value.distanceEnd)
        assert(value.timeStart <= value.timeEnd)
        assert(value.distanceEnd <= blockInfra.getBlockLength(key).distance)
        assert(0.meters <= value.distanceStart)
        assert(0.0 <= value.timeEnd)
    }
    return unavailableSpace
}

/**
 * Builds the time during which the blocks are used by another train (including a forward signal
 * cascade) This step is also used to merge together the small overlapping time intervals across
 * different zones or trains.
 */
private fun buildBlockUse(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    requirements: Collection<SpacingRequirement>,
    marginToAddBeforeEachBlock: Double,
    marginToAddAfterEachBlock: Double
): Map<BlockId, RangeSet<Double>> {
    val res = HashMap<BlockId, RangeSet<Double>>()
    for (requirement in requirements) {
        val zoneId = rawInfra.getZoneFromName(requirement.zone)
        val timeRange =
            Range.closed(
                requirement.beginTime - marginToAddBeforeEachBlock,
                requirement.endTime + marginToAddAfterEachBlock
            )
        for (blockId in blockInfra.getBlocksInZone(zoneId)) {
            res.putIfAbsent(blockId, TreeRangeSet.create())
            res[blockId]!!.add(timeRange)
        }
    }
    return res
}
