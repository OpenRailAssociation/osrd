package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.conflicts.IncrementalPath
import fr.sncf.osrd.conflicts.PathFragment
import fr.sncf.osrd.conflicts.PathStop
import fr.sncf.osrd.conflicts.incrementalPathOf
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.PathPropertiesView
import fr.sncf.osrd.sim_infra.utils.getRouteBlocks
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.indexing.StaticIdx
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
    fun getPredecessorBlocks(): AppendOnlyLinkedList<BlockId>

    /** Returns all the blocks after the current one */
    fun getLookahead(): StaticIdxList<Block>

    /** Returns a copy of the current instance. */
    fun clone(): InfraExplorer

    /** Returns the list of routes that are the current exploration follows. */
    fun getExploredRoutes(): List<RouteId>
}

/** Used to identify an edge */
interface EdgeIdentifier {
    override fun equals(other: Any?): Boolean

    override fun hashCode(): Int
}

/**
 * Init all InfraExplorers starting at the given location. The last of `stops` are used to identify
 * when the incremental path is complete. `constraints` are used to determine if a block can be
 * explored
 */
fun initInfraExplorer(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    location: PathfindingEdgeLocationId<Block>,
    stops: List<Collection<PathfindingEdgeLocationId<Block>>> = listOf(setOf()),
    constraints: List<PathfindingConstraint<Block>> = listOf()
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
                appendOnlyLinkedListOf(),
                appendOnlyLinkedListOf(),
                mutableMapOf(),
                incrementalPath,
                blockToPathProperties,
                stops = stops,
                constraints = constraints
            )
        val infraExtended = infraExplorer.extend(it, location)
        if (infraExtended) infraExplorers.add(infraExplorer)
    }
    return infraExplorers
}

private class InfraExplorerImpl(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private var blocks: AppendOnlyLinkedList<BlockId>,
    private var routes: AppendOnlyLinkedList<RouteId>,
    private var blockRoutes: MutableMap<BlockId, RouteId>,
    private var incrementalPath: IncrementalPath,
    private var pathPropertiesCache: MutableMap<BlockId, PathProperties>,
    private var currentIndex: Int = 0,
    // TODO: Should evolve into a List of struct that contains duration, receptionSignal and a
    //       collection of locations
    private val stops: List<Collection<PathfindingEdgeLocationId<Block>>>,
    private var predecessorLength: Length<Path> = Length(0.meters), // to avoid re-computing it
    private var constraints: List<PathfindingConstraint<Block>>
) : InfraExplorer {

    override fun getIncrementalPath(): IncrementalPath {
        return incrementalPath
    }

    override fun getCurrentEdgePathProperties(
        offset: Offset<Block>,
        length: Distance?
    ): PathProperties {
        // We re-compute the routes of the current path since the cache may be incorrect
        // because of a previous iteration.
        // We also can't set a first route for sure in initInfraExplorer, but we set the first cache
        // entry.
        // So we have to correct that here now that we now which route we're on.
        val path =
            pathPropertiesCache.getOrElse(getCurrentBlock()) {
                makePathProps(
                    blockInfra,
                    rawInfra,
                    getCurrentBlock(),
                )
            }
        val route = blockRoutes[getCurrentBlock()]!!
        val blockPathProperties = path.withRoutes(listOf(route))
        pathPropertiesCache[getCurrentBlock()] = blockPathProperties

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
        val lastRoute = routes[routes.size - 1]
        val lastRouteExit = rawInfra.getRouteExit(lastRoute)
        val nextRoutes = rawInfra.getRoutesStartingAtDet(lastRouteExit)
        nextRoutes.forEach {
            val infraExplorer = this.clone() as InfraExplorerImpl
            val infraExtended = infraExplorer.extend(it)
            // Blocked explorers are dropped
            if (infraExtended) infraExplorers.add(infraExplorer)
        }
        return infraExplorers
    }

    override fun moveForward(): InfraExplorer {
        assert(currentIndex < blocks.size - 1) {
            "Infra Explorer: Current edge is already the last edge: can't move forward."
        }
        predecessorLength += getCurrentBlockLength().distance
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
        return predecessorLength
    }

    override fun getPredecessorBlocks(): AppendOnlyLinkedList<BlockId> {
        return blocks.subList(currentIndex)
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
            this.blocks.shallowCopy(),
            this.routes.shallowCopy(),
            this.blockRoutes.toMutableMap(),
            this.incrementalPath.clone(),
            this.pathPropertiesCache,
            this.currentIndex,
            this.stops,
            this.predecessorLength,
            this.constraints
        )
    }

    override fun getExploredRoutes(): List<RouteId> {
        return routes.toList()
    }

    /**
     * Updates `incrementalPath`, `routes`, `blocks` and returns true if route can be explored.
     * Otherwise, it returns false and keeps the states as is. `blockRoutes` is updated to keep
     * track of the route used for each block.
     */
    fun extend(route: RouteId, firstLocation: PathfindingEdgeLocationId<Block>? = null): Boolean {
        val routeBlocks = blockInfra.getRouteBlocks(rawInfra, route)
        var seenFirstBlock = firstLocation == null
        var nBlocksToSkip = 0
        val pathFragments = arrayListOf<PathFragment>()
        var pathStarted = incrementalPath.pathStarted
        val addedBlocks = mutableListOf<BlockId>()

        for (block in routeBlocks) {
            if (blockRoutes.containsKey(block)) return false // We already passed by this block
            addedBlocks.add(block)
            if (block == firstLocation?.edge) {
                seenFirstBlock = true
            }
            if (!seenFirstBlock) {
                nBlocksToSkip++
            } else {
                // If a block cannot be explored, give up
                val endLocation = stops.last().firstOrNull { it.edge == block }
                val isRouteBlocked =
                    constraints.any { constraint ->
                        constraint.apply(block).any {
                            if (firstLocation != null && firstLocation.edge == block)
                                firstLocation.offset.distance < it.end.distance
                            else if (endLocation != null)
                                endLocation.offset.distance > it.start.distance
                            else true
                        }
                    }
                if (isRouteBlocked) return false
                val endLocationsOnBlock = stops.last().filter { it.edge == block }
                val endPath = endLocationsOnBlock.isNotEmpty()
                val endPathBlockLocation = endLocationsOnBlock.maxByOrNull { it.offset }
                val startPath = !pathStarted
                val addRoute = block == routeBlocks.first() || startPath
                val travelledPathBeginBlockOffset =
                    if (startPath) firstLocation!!.offset else Offset.zero()
                val travelledPathEndBlockOffset =
                    endPathBlockLocation?.offset ?: blockInfra.getBlockLength(block)
                pathFragments.add(
                    PathFragment(
                        if (addRoute) mutableStaticIdxArrayListOf(route)
                        else mutableStaticIdxArrayListOf(),
                        mutableStaticIdxArrayListOf(block),
                        containsStart = startPath,
                        containsEnd = endPath,
                        stops =
                            findStopsInTravelledPathAndOnBlock(
                                block,
                                travelledPathBeginBlockOffset,
                                travelledPathEndBlockOffset
                            ),
                        travelledPathBegin = travelledPathBeginBlockOffset.distance,
                        travelledPathEnd =
                            blockInfra.getBlockLength(block) - travelledPathEndBlockOffset
                    )
                )
                pathStarted = true
                if (endPath) break // Can't extend any further
            }
        }
        assert(seenFirstBlock)
        blocks.addAll(addedBlocks)
        routes.add(route)
        for (block in addedBlocks) {
            assert(!blockRoutes.containsKey(block))
            blockRoutes[block] = route
        }
        for (i in 0 ..< nBlocksToSkip) moveForward()
        for (pathFragment in pathFragments) incrementalPath.extend(pathFragment)

        return true
    }

    private fun findStopsInTravelledPathAndOnBlock(
        block: StaticIdx<Block>,
        travelledPathBeginBlockOffset: Offset<Block>,
        travelledPathEndBlockOffset: Offset<Block>
    ): List<PathStop> {
        val pathStops = mutableListOf<PathStop>()
        for (stop in stops) {
            for (location in stop) {
                val isIncluded =
                    location.edge == block &&
                        location.offset in
                            travelledPathBeginBlockOffset..travelledPathEndBlockOffset
                if (isIncluded) {
                    pathStops.add(PathStop(location.offset.cast(), SHORT_SLIP_STOP))
                }
            }
        }
        return pathStops
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
