package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.DeprecatedPathfinding
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.sim_infra.api.TrackSectionId

data class TrackSectionConstraints(
    val blockInfra: BlockInfra,
    val infra: RawSignalingInfra,
    val allowedTrackSections: Set<TrackSectionId>,
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): Collection<DeprecatedPathfinding.Range<Block>> {
        val res = HashSet<DeprecatedPathfinding.Range<Block>>()
        val path = buildTrainPathFromBlock(infra, blockInfra, edge)
        res.addAll(getBlockedRanges(allowedTrackSections, path))

        return res
    }

    private fun getBlockedRanges(
        allowedTrackSections: Set<TrackSectionId>,
        path: TrainPath,
    ): Collection<DeprecatedPathfinding.Range<Block>> {
        val res = HashSet<DeprecatedPathfinding.Range<Block>>()

        val invalidTrackChunks =
            path.getChunks().filter {
                val trackSectionId = infra.getTrackFromChunk(it.value.value)
                !allowedTrackSections.contains(trackSectionId)
            }

        for (range in invalidTrackChunks) {
            // The train path contains exactly the given block,
            // so we can cast offsets from one type to the other
            res.add(DeprecatedPathfinding.Range(range.pathBegin.cast(), range.pathEnd.cast()))
        }
        return res
    }
}
