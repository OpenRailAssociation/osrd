package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.conflicts.IncrementalPath
import fr.sncf.osrd.conflicts.PathFragment
import fr.sncf.osrd.conflicts.incrementalPathOf
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.PathPropertiesView
import fr.sncf.osrd.sim_infra.utils.getBlockExit
import fr.sncf.osrd.sim_infra.utils.getRouteBlocks
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import java.util.Objects

/**
 * Explore the infra, without running simulations. Builds one global path from the start of the
 * train, one block at a time.
 *
 * The path has several parts: the current block (on which is the train head), the path the train
 * comes from, and the *lookahead* (i.e. the path the train will follow later).
 *
 * ```
 * (...      predecessors  ) ( current block ) (           lookahead             )
 * ------> ----------------> ----------------> ----------------> ---------------->
 *                           (       ^       )                   (       ^       )
 *                           getCurrentBlock()                getLastBlockIdentifier()
 *                           getCurrentEdgePathProperties()
 *                           ...
 * ```
 */
interface InfraExplorer {
    /**
     * Get the IncrementalPath, the path type used to generate resource use. Includes the whole
     * paths: predecessors, current block, and lookahead.
     */
    fun getIncrementalPath(): IncrementalPath

    /**
     * Get the path properties for the current edge only, starting at the given offset and for the
     * given length. If no length is given, the path covers the rest of the block.
     */
    fun getCurrentEdgePathProperties(offset: Offset<Block>, length: Distance?): PathProperties

    /**
     * Returns an object that can be used to identify edges. The last edge contains the current
     * block (current position in the path), the lookahead's blocks (path to explore) and the last
     * route (current path's exit).
     */
    fun getLastEdgeIdentifier(): EdgeIdentifier

    /**
     * Clone the current object and extend the lookahead by one block, for each block starting
     * there.
     */
    fun cloneAndExtendLookahead(): Collection<InfraExplorer>

    /** Move the current block by one, following the lookahead section. */
    fun moveForward()

    /** Returns the current block. */
    fun getCurrentBlock(): BlockId

    /** Returns the length of the current block. */
    fun getCurrentBlockLength(): Length<Block>

    /** Returns a copy of the current instance. */
    fun clone(): InfraExplorer
}

/** Used to identify an edge */
interface EdgeIdentifier {
    override fun equals(other: Any?): Boolean

    override fun hashCode(): Int
}

/** Init all InfraExplorers starting at the given location. */
fun initInfraExplorer(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    location: PathfindingEdgeLocationId<Block>,
    endBlocks: Collection<BlockId> = setOf()
): Collection<InfraExplorer> {
    val infraExplorers = mutableListOf<InfraExplorer>()
    val block = location.edge
    val pathProps = makePathProps(blockInfra, rawInfra, block)
    val blockToPathProperties = mutableMapOf(block to pathProps)
    val routes = blockInfra.routesOnBlock(rawInfra, block)
    routes.forEach {
        val incrementalPath = incrementalPathOf(rawInfra, blockInfra)
        incrementalPath.extend(
            PathFragment(
                mutableStaticIdxArrayListOf(it),
                mutableStaticIdxArrayListOf(block),
                containsStart = true,
                containsEnd = endBlocks.contains(block),
                travelledPathBegin = location.offset.distance,
                travelledPathEnd = Distance.ZERO
            )
        )
        val infraExplorer =
            InfraExplorerImpl(
                rawInfra,
                blockInfra,
                mutableStaticIdxArrayListOf(block),
                mutableStaticIdxArrayListOf(it),
                incrementalPath,
                blockToPathProperties,
                endBlocks = endBlocks
            )
        infraExplorers.add(infraExplorer)
    }
    return infraExplorers
}

private class InfraExplorerImpl(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private var blocks: MutableStaticIdxArrayList<Block>,
    private var routes: MutableStaticIdxArrayList<Route>,
    private var incrementalPath: IncrementalPath,
    private var blockToPathProperties: MutableMap<BlockId, PathProperties>,
    private var currentIndex: Int = 0,
    private val endBlocks:
        Collection<BlockId>, // Blocks on which "end of path" should be set to true
) : InfraExplorer {

    override fun getIncrementalPath(): IncrementalPath {
        return incrementalPath
    }

    override fun getCurrentEdgePathProperties(
        offset: Offset<Block>,
        length: Distance?
    ): PathProperties {
        return PathPropertiesView(
            blockToPathProperties[getCurrentBlock()]!!,
            offset.cast(),
            if (length == null) Offset(blockInfra.getBlockLength(getCurrentBlock()).distance)
            else offset.plus(length).cast()
        )
    }

    override fun getLastEdgeIdentifier(): EdgeIdentifier {
        val currentAndRemainingBlocks = mutableStaticIdxArrayListOf<Block>()
        for (i in currentIndex ..< blocks.size) {
            currentAndRemainingBlocks.add(blocks[i])
        }
        return EdgeIdentifierImpl(currentAndRemainingBlocks, routes.last())
    }

    override fun cloneAndExtendLookahead(): Collection<InfraExplorer> {
        if (getIncrementalPath().pathComplete)
            return listOf() // Can't extend beyond the destination
        val infraExplorers = mutableListOf<InfraExplorer>()
        val lastBlock = blocks.last()
        val lastRoute = routes.last()
        val lastBlockExit = blockInfra.getBlockExit(rawInfra, lastBlock)
        val lastRouteExit = rawInfra.getRouteExit(lastRoute)
        val nextRoutes =
            if (lastBlockExit != lastRouteExit)
            // Last route ends after last block: route should not change, but block should move
            // forward
            mutableStaticIdxArrayListOf(lastRoute)
            else rawInfra.getRoutesStartingAtDet(lastBlockExit)
        nextRoutes.forEach {
            val infraExplorer = this.clone() as InfraExplorerImpl
            infraExplorer.extend(it)
            infraExplorers.add(infraExplorer)
        }
        return infraExplorers
    }

    override fun moveForward() {
        assert(currentIndex < blocks.size - 1) {
            "Infra Explorer: Current edge is already the last edge: can't move forward."
        }
        currentIndex += 1
    }

    override fun getCurrentBlock(): BlockId {
        assert(currentIndex < blocks.size) { "InfraExplorer: currentBlockIndex is out of bounds." }
        return blocks[currentIndex]
    }

    override fun getCurrentBlockLength(): Length<Block> {
        return blockInfra.getBlockLength(getCurrentBlock())
    }

    override fun clone(): InfraExplorer {
        return InfraExplorerImpl(
            this.rawInfra,
            this.blockInfra,
            this.blocks.clone(),
            this.routes.clone(),
            this.incrementalPath.clone(),
            this.blockToPathProperties.toMutableMap(),
            this.currentIndex,
            this.endBlocks
        )
    }

    private fun extend(route: RouteId) {
        val routeBlocks = blockInfra.getRouteBlocks(rawInfra, route)
        val lastBlock = blocks.last()
        val nextBlockIndex = routeBlocks.indexOf(lastBlock) + 1
        assert(nextBlockIndex < routeBlocks.size) {
            "InfraExplorer's last block cannot be the last block of the route to extend."
        }
        val nextBlock = routeBlocks[nextBlockIndex]
        blocks.add(nextBlock)
        val isNewRoute = nextBlockIndex == 0
        if (isNewRoute) routes.add(route)
        blockToPathProperties[nextBlock] = makePathProps(blockInfra, rawInfra, nextBlock)
        incrementalPath.extend(
            PathFragment(
                if (isNewRoute) mutableStaticIdxArrayListOf(route)
                else mutableStaticIdxArrayListOf(),
                mutableStaticIdxArrayListOf(nextBlock),
                containsStart = false,
                containsEnd = endBlocks.contains(nextBlock),
                travelledPathBegin = Distance.ZERO,
                travelledPathEnd = Distance.ZERO
            )
        )
    }
}

private class EdgeIdentifierImpl(
    private val blocks: StaticIdxList<Block>,
    private val route: RouteId
) : EdgeIdentifier {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        return if (other !is EdgeIdentifierImpl) false
        else this.blocks == other.blocks && this.route == other.route
    }

    override fun hashCode(): Int {
        return Objects.hash(blocks, route)
    }
}
