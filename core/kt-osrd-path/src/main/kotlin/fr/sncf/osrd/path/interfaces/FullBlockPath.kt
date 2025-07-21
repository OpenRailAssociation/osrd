package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.units.Offset

/**
 * Contains all blocks used by the train. Blocks are always included in full here, even if they're
 * only partially used. Subset of `FullRoutePath`.
 */
interface FullBlockPath {
    fun getBlocks(): List<BlockId>

    fun getBlockOffsets(): List<Offset<FullBlockPath>>
}
