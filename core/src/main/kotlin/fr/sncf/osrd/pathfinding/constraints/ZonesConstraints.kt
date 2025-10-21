package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.units.Offset

data class ZonesConstraints(
    val blockInfra: BlockInfra,
    val infra: RawSignalingInfra,
    val zones: HashSet<String>?,
) : PathfindingConstraint<Block> {
    override fun apply(edge: BlockId): Collection<Pathfinding.Range<Block>> {
        val res = HashSet<Pathfinding.Range<Block>>()
        val path = buildTrainPathFromBlock(infra, blockInfra, edge)
        res.addAll(getBlockedRanges(zones, path))
        return res
    }

    private fun getBlockedRanges(
        zones: HashSet<String>?,
        path: TrainPath,
    ): Collection<Pathfinding.Range<Block>> {

        val res = HashSet<Pathfinding.Range<Block>>()

        val invalidTrackSectionsInsideBlock =
            path.getChunks().filter {
                val trackSection = infra.getTrackFromChunk(it.value.value)
                zones?.contains(infra.getTrackSectionName(trackSection)) == false
            }

        for ((_, from, to) in invalidTrackSectionsInsideBlock) {
            res.add(Pathfinding.Range(Offset(from.distance), Offset(to.distance)))
        }
        return res
    }
}
