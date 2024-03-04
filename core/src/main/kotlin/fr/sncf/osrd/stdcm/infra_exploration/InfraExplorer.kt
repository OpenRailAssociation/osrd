package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.pathfinding.constraints.*
import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.conflicts.IncrementalPath
import fr.sncf.osrd.conflicts.PathFragment
import fr.sncf.osrd.conflicts.incrementalPathOf
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.PathPropertiesView
import fr.sncf.osrd.sim_infra.utils.getRouteBlocks
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*

/**
 * Explore the infra, without running simulations. Builds one global path from the start of the
 * train, one block at a time. The instances are meant to be "cloned" for each possible path, using
 * the method `cloneAndExtendLookahead()`.
 *
 * The path has several parts: the current block (on which is the train head), the path the train
 * comes from, and the *lookahead* (i.e. the path the train will follow later). The lookahead is
 * always extended one whole route at a time.
 *
 * ```
 * (...      predecessors  ) ( current block ) (           lookahead             )
 * ------> ----------------> ----------------> ----------------> ---------------->
 *                           (       ^       )                   (       ^       )
 *                           getCurrentBlock()                getLastEdgeIdentifier()
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
     * block (current position in the path) and the lookahead's blocks (path to explore). This is
     * used by the pathfinding to check if the path has already been visited.
     */
    fun getLastEdgeIdentifier(): EdgeIdentifier

    /**
     * Clone the current object and extend the lookahead by one route, for each route starting at
     * the current end of the lookahead section.
     */
    fun cloneAndExtendLookahead(): Collection<InfraExplorer>

    /**
     * Move the current block by one, following the lookahead section. Can only be called when the
     * lookahead isn't empty. The operation is done in-place.
     */
    fun moveForward(): InfraExplorer

    /** Returns the current block. */
    fun getCurrentBlock(): BlockId

    /** Returns the length of the current block. */
    fun getCurrentBlockLength(): Length<Block>

    /** Returns the length of all blocks before the current one */
    fun getPredecessorLength(): Length<Path>

    /** Returns all the blocks before the current one */
    fun getPredecessorBlocks(): StaticIdxList<Block>

    /** Returns all the blocks after the current one */
    fun getLookahead(): StaticIdxList<Block>

    /** Returns a copy of the current instance. */
    fun clone(): InfraExplorer
}

/** Used to identify an edge */
interface EdgeIdentifier {
    override fun equals(other: Any?): Boolean

    override fun hashCode(): Int
}

/**
 * Init all InfraExplorers starting at the given location. `endBlocks` are used to identify when the
 * incremental path is complete.
 */
fun initInfraExplorer(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    location: PathfindingEdgeLocationId<Block>,
    endBlocks: Collection<BlockId> = setOf(),
    blockedRangesOnEdge: ConstraintCombiner<BlockId, Block> = ConstraintCombiner()
): Collection<InfraExplorer> {
    val infraExplorers = mutableListOf<InfraExplorer>()
    val block = location.edge
    val pathProps = makePathProps(blockInfra, rawInfra, block)
    val blockToPathProperties = mutableMapOf(block to pathProps)
    val routes = blockInfra.routesOnBlock(rawInfra, block)

    routes.forEach {
        val incrementalPath = incrementalPathOf(rawInfra, blockInfra)
        val infraExplorer =
            InfraExplorerImpl(
                rawInfra,
                blockInfra,
                mutableStaticIdxArrayListOf(),
                mutableStaticIdxArrayListOf(),
                incrementalPath,
                blockToPathProperties,
                endBlocks = endBlocks,
                blockedRangesOnEdge = blockedRangesOnEdge
            )
        infraExplorer.extend(it, location)
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
    private var pathPropertiesCache: MutableMap<BlockId, PathProperties>,
    private var currentIndex: Int = 0,
    private val endBlocks:
        Collection<BlockId>, // Blocks on which "end of path" should be set to true
    private var blockedRangesOnEdge: ConstraintCombiner<BlockId, Block>
) : InfraExplorer {

    override fun getIncrementalPath(): IncrementalPath {
        return incrementalPath
    }

    override fun getCurrentEdgePathProperties(
        offset: Offset<Block>,
        length: Distance?
    ): PathProperties {
        val blockPathProperties =
            pathPropertiesCache.computeIfAbsent(getCurrentBlock()) {
                makePathProps(blockInfra, rawInfra, it)
            }
        val blockLength = Length<Path>(blockInfra.getBlockLength(getCurrentBlock()).distance)
        val endOffset = if (length == null) blockLength else offset.plus(length).cast()
        if (offset.distance == 0.meters && endOffset == blockLength) {
            return blockPathProperties
        }
        return PathPropertiesView(blockPathProperties, offset.cast(), endOffset)
    }

    override fun getLastEdgeIdentifier(): EdgeIdentifier {
        val currentAndRemainingBlocks = mutableStaticIdxArrayListOf<Block>()
        for (i in currentIndex ..< blocks.size) {
            currentAndRemainingBlocks.add(blocks[i])
        }
        return EdgeIdentifierImpl(currentAndRemainingBlocks)
    }

    override fun cloneAndExtendLookahead(): Collection<InfraExplorer> {
        if (getIncrementalPath().pathComplete)
            return listOf() // Can't extend beyond the destination
        val infraExplorers = mutableListOf<InfraExplorer>()
        val lastRoute = routes.last()
        val lastRouteExit = rawInfra.getRouteExit(lastRoute)
        val nextRoutes = rawInfra.getRoutesStartingAtDet(lastRouteExit)
        nextRoutes.forEach {
            val infraExplorer = this.clone() as InfraExplorerImpl
            infraExplorer.extend(it)
            infraExplorers.add(infraExplorer)
        }
        return infraExplorers
    }

    override fun moveForward(): InfraExplorer {
        assert(currentIndex < blocks.size - 1) {
            "Infra Explorer: Current edge is already the last edge: can't move forward."
        }
        currentIndex += 1
        return this
    }

    override fun getCurrentBlock(): BlockId {
        assert(currentIndex < blocks.size) { "InfraExplorer: currentBlockIndex is out of bounds." }
        return blocks[currentIndex]
    }

    override fun getCurrentBlockLength(): Length<Block> {
        return blockInfra.getBlockLength(getCurrentBlock())
    }

    override fun getPredecessorLength(): Length<Path> {
        return Length(
            Distance(
                millimeters =
                    getPredecessorBlocks().sumOf {
                        blockInfra.getBlockLength(it).distance.millimeters
                    }
            )
        )
    }

    override fun getPredecessorBlocks(): StaticIdxList<Block> {
        val res = mutableStaticIdxArrayListOf<Block>()
        for (i in 0 ..< currentIndex) res.add(blocks[i])
        return res
    }

    override fun getLookahead(): StaticIdxList<Block> {
        val res = mutableStaticIdxArrayListOf<Block>()
        for (i in currentIndex + 1 ..< blocks.size) res.add(blocks[i])
        return res
    }

    override fun clone(): InfraExplorer {
        return InfraExplorerImpl(
            this.rawInfra,
            this.blockInfra,
            this.blocks.clone(),
            this.routes.clone(),
            this.incrementalPath.clone(),
            this.pathPropertiesCache.toMutableMap(),
            this.currentIndex,
            this.endBlocks,
            this.blockedRangesOnEdge
        )
    }

    fun extend(route: RouteId, firstLocation: PathfindingEdgeLocationId<Block>? = null): Boolean {
        val routeBlocks = blockInfra.getRouteBlocks(rawInfra, route)
        var seenFirstBlock = firstLocation == null
        var nBlocksToSkip = 0
        var pathFragments = arrayListOf<PathFragment>()
        var pathStarted = !incrementalPath.pathStarted
        for (block in routeBlocks) {
            if (block == firstLocation?.edge) {
                seenFirstBlock = true
            }
            if (!seenFirstBlock) {
                nBlocksToSkip++
            } else {
                if (!blockedRangesOnEdge.apply(block).isEmpty()) return false
                val endPath = endBlocks.contains(block)
                val startPath = !pathStarted
                val addRoute = block == routeBlocks.first() || startPath
                pathFragments.add(
                    PathFragment(
                        if (addRoute) mutableStaticIdxArrayListOf(route)
                        else mutableStaticIdxArrayListOf(),
                        mutableStaticIdxArrayListOf(block),
                        containsStart = startPath,
                        containsEnd = endPath,
                        travelledPathBegin =
                            if (startPath) firstLocation!!.offset.distance else Distance.ZERO,
                        travelledPathEnd = Distance.ZERO
                    )
                )
                pathStarted = true
                if (endPath) {
                    break
                } // Can't extend any further
            }
        }
        assert(seenFirstBlock)
        blocks.addAll(routeBlocks)
        routes.add(route)
        for (i in 0 ..< nBlocksToSkip) moveForward()
        for (pathFragment in pathFragments) {
            incrementalPath.extend(pathFragment)
        }

        return true
    }

    override fun toString(): String {
        // Not everything is printed, this is what feels the most comfortable in a debugging window
        return String.format("currentBlock=%s, lookahead=%s", getCurrentBlock(), getLookahead())
    }
}

private class EdgeIdentifierImpl(private val blocks: StaticIdxList<Block>) : EdgeIdentifier {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        return if (other !is EdgeIdentifierImpl) false else this.blocks == other.blocks
    }

    override fun hashCode(): Int {
        return Objects.hash(blocks)
    }
}
