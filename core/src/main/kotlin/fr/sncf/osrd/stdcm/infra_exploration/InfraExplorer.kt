package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.conflicts.FragmentBlocks
import fr.sncf.osrd.conflicts.FragmentStop
import fr.sncf.osrd.conflicts.IncrementalPath
import fr.sncf.osrd.conflicts.PathFragment
import fr.sncf.osrd.conflicts.incrementalPathOf
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.getRouteBlocks
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.AppendOnlyMap
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.appendOnlyMapOf
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
    fun getCurrentEdgePathProperties(offset: Offset<Block>, length: Distance?): TrainPath

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

    /** Returns the current block. */
    fun getCurrentBlockRange(): BlockRange

    fun getAllBlocks(): List<BlockRange>

    /** Returns the length of the current block. */
    fun getCurrentBlockLength(): Length<Block>

    /** Returns all the blocks before the current one */
    fun getPredecessorBlocks(): AppendOnlyLinkedList<BlockRange>

    /** Returns all the blocks after the current one */
    fun getLookahead(): List<BlockRange>

    /** Returns a copy of the current instance. */
    fun clone(): InfraExplorer

    /** Returns the list of routes that the current exploration follows. */
    fun getExploredRoutes(): List<RouteId>

    /** Returns the step tracker, giving data about the steps on the path (including lookahead) */
    fun getStepTracker(): StepTracker

    /**
     * Build a full train path from the explored path. The resulting data is copied and this is not
     * cached, should not be called too often.
     */
    fun buildFullPath(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        electricalProfileMapping: ElectricalProfileMapping? = null,
    ): TrainPath
}

/** Returns the current block and the lookahead blocks */
fun InfraExplorer.getRemainingBlocks(): List<BlockId> {
    val res = mutableListOf(getCurrentBlock())
    res.addAll(getLookahead().map { it.value })
    return res
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
    location: EdgeLocation<BlockId, Block>,
    steps: List<STDCMStep> = listOf(),
    constraints: List<PathfindingConstraint<Block>> = listOf(),
): Collection<InfraExplorer> {
    val infraExplorers = mutableListOf<InfraExplorer>()
    val block = location.edge
    val pathProps = buildTrainPathFromBlock(rawInfra, blockInfra, block)
    val blockToPathProperties = mutableMapOf(block to pathProps)
    val routes = blockInfra.routesOnBlock(rawInfra, block)

    routes.forEach { route ->
        val incrementalPath = incrementalPathOf(rawInfra, blockInfra)
        val infraExplorer =
            InfraExplorerImpl(
                rawInfra,
                blockInfra,
                appendOnlyLinkedListOf(),
                appendOnlyLinkedListOf(),
                appendOnlyMapOf(),
                null,
                incrementalPath,
                blockToPathProperties,
                stepTracker = StepTracker(steps),
                constraints = constraints,
            )
        val infraExtended = infraExplorer.extend(route, location)
        if (infraExtended) infraExplorers.add(infraExplorer)
    }
    return infraExplorers
}

private class InfraExplorerImpl(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private var blockRanges: AppendOnlyLinkedList<BlockRange>,
    private var routes: AppendOnlyLinkedList<RouteId>,
    private var blockRoutes: AppendOnlyMap<BlockId, RouteId>,
    private var lastTrack: TrackSectionId?,
    private var incrementalPath: IncrementalPath,
    private var trainPathCache: MutableMap<BlockId, TrainPath>,
    private var currentIndex: Int = 0,
    private var stepTracker: StepTracker,
    private var constraints: List<PathfindingConstraint<Block>>,
) : InfraExplorer {

    override fun getIncrementalPath(): IncrementalPath {
        return incrementalPath
    }

    override fun getCurrentEdgePathProperties(offset: Offset<Block>, length: Distance?): TrainPath {
        // We re-compute the routes of the current path since the cache may be incorrect
        // because of a previous iteration.
        // We also can't set a first route for sure in initInfraExplorer, but we set the first cache
        // entry.
        // So we have to correct that here now that we now which route we're on.
        val path =
            trainPathCache.getOrElse(getCurrentBlock()) {
                val res = buildTrainPathFromBlock(rawInfra, blockInfra, getCurrentBlock())
                trainPathCache[getCurrentBlock()] = res
                res
            }
        val route = blockRoutes[getCurrentBlock()]!!

        val pathWithRoutes = path.withRoutes(listOf(route))

        val blockLength = blockInfra.getBlockLength(getCurrentBlock())
        val endOffset: Offset<Block> = if (length == null) blockLength else offset.plus(length)
        if (offset.distance == 0.meters && endOffset == blockLength) {
            return pathWithRoutes
        }
        // In that case, start of the block is start of the travelled path
        return pathWithRoutes.subPath(offset.cast(), endOffset.cast())
    }

    override fun getLastEdgeIdentifier(): EdgeIdentifier {
        return EdgeIdentifierImpl(getRemainingBlocks())
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
        assert(currentIndex < blockRanges.size - 1) {
            "Infra Explorer: Current edge is already the last edge: can't move forward."
        }
        currentIndex += 1
        return this
    }

    override fun getCurrentBlock(): BlockId {
        return getCurrentBlockRange().value
    }

    override fun getCurrentBlockRange(): BlockRange {
        assert(currentIndex < blockRanges.size) {
            "InfraExplorer: currentBlockIndex is out of bounds."
        }
        return blockRanges[currentIndex]
    }

    override fun getAllBlocks(): List<BlockRange> {
        return blockRanges.toList()
    }

    override fun getCurrentBlockLength(): Length<Block> {
        return blockInfra.getBlockLength(getCurrentBlock())
    }

    override fun getPredecessorBlocks(): AppendOnlyLinkedList<BlockRange> {
        return blockRanges.subList(currentIndex)
    }

    override fun getLookahead(): List<BlockRange> {
        return blockRanges
            .iterateIndexedBackwards()
            .takeWhile { it.index > currentIndex }
            .map { it.value }
            .toList()
            .reversed()
    }

    override fun clone(): InfraExplorer {
        return InfraExplorerImpl(
            this.rawInfra,
            this.blockInfra,
            this.blockRanges.shallowCopy(),
            this.routes.shallowCopy(),
            this.blockRoutes.shallowCopy(),
            this.lastTrack,
            this.incrementalPath.clone(),
            this.trainPathCache,
            this.currentIndex,
            this.stepTracker.clone(),
            this.constraints,
        )
    }

    override fun getExploredRoutes(): List<RouteId> {
        return routes.toList()
    }

    override fun getStepTracker(): StepTracker {
        return stepTracker
    }

    override fun buildFullPath(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        electricalProfileMapping: ElectricalProfileMapping?,
    ): TrainPath {
        val blocks = blockRanges.toList()
        return buildTrainPathFromBlockRanges(
            rawInfra,
            blockInfra,
            blocks,
            getExploredRoutes(),
            electricalProfileMapping = electricalProfileMapping,
        )
    }

    /**
     * Updates `incrementalPath`, `routes`, `blocks` and returns true if route can be explored.
     * Otherwise, it returns false and the instance is supposed to be dropped. `blockRoutes` is
     * updated to keep track of the route used for each block.
     */
    fun extend(route: RouteId, firstLocation: EdgeLocation<BlockId, Block>? = null): Boolean {
        routes.add(route)
        val routeBlocks = blockInfra.getRouteBlocks(rawInfra, route)
        var seenFirstBlock = firstLocation == null
        var pathAlreadyStarted = incrementalPath.pathStarted

        for (block in routeBlocks) {
            seenFirstBlock = seenFirstBlock || block == firstLocation?.edge
            if (seenFirstBlock) {
                val startsPath = !pathAlreadyStarted
                val addsRoute = block == routeBlocks.first() || startsPath
                blockRoutes[block] = route

                // Simulation range start on the current block, 0m on any block that isn't the first
                val travelledPathBegin: Offset<Block> =
                    if (startsPath) firstLocation!!.offset else Offset.zero()

                val blockLength = blockInfra.getBlockLength(block)

                val stepsOnBlock =
                    stepTracker.exploreBlockRange(block, travelledPathBegin, blockLength)
                val arrivalLocation =
                    if (stepTracker.hasSeenDestination()) stepsOnBlock.lastOrNull()?.location
                    else null
                // If a block cannot be explored, give up
                val isRouteBlocked =
                    constraints.any { constraint ->
                        constraint.apply(block).any {
                            if (firstLocation != null && firstLocation.edge == block)
                                firstLocation.offset.distance < it.end.distance
                            else if (arrivalLocation != null)
                                arrivalLocation.offset.distance > it.start.distance
                            else true
                        }
                    }
                if (isRouteBlocked) return false
                val endPath = arrivalLocation != null
                val travelledPathEndBlockOffset = arrivalLocation?.offset ?: blockLength

                val rangePathBegin = blockRanges.lastOrNull()?.pathEnd ?: Offset.zero()
                val rangePathEnd =
                    rangePathBegin + (travelledPathEndBlockOffset - travelledPathBegin)

                if (rangePathBegin > rangePathEnd) continue

                val blockRange =
                    BlockRange(
                        value = block,
                        objectBegin = travelledPathBegin,
                        objectEnd = travelledPathEndBlockOffset,
                        pathBegin = rangePathBegin,
                        pathEnd = rangePathEnd,
                    )
                blockRanges.add(blockRange)

                incrementalPath.extend(
                    PathFragment(
                        if (addsRoute) mutableStaticIdxArrayListOf(route)
                        else mutableStaticIdxArrayListOf(),
                        mutableStaticIdxArrayListOf(block),
                        containsStart = startsPath,
                        containsEnd = endPath,
                        stops = findStopsInTravelledPathAndOnBlock(stepsOnBlock),
                        travelledPathBegin = travelledPathBegin.distance,
                        travelledPathEnd =
                            blockInfra.getBlockLength(block) - travelledPathEndBlockOffset,
                    )
                )
                pathAlreadyStarted = true
                if (endPath) break // Can't extend any further
            }
        }
        assert(seenFirstBlock)
        return true
    }

    private fun findStopsInTravelledPathAndOnBlock(
        stepsOnBlock: List<LocatedStep>
    ): List<FragmentStop> {
        return stepsOnBlock
            .filter { it.originalStep.stop }
            .map {
                // There's a single block in the fragment: Offset<FragmentBlocks> == Offset<Block>
                val fragmentOffset = it.location.offset.cast<FragmentBlocks>()
                FragmentStop(fragmentOffset, SHORT_SLIP_STOP)
            }
    }

    override fun toString(): String {
        // Not everything is printed, this is what feels the most comfortable in a debugging window
        return String.format("currentBlock=%s, lookahead=%s", getCurrentBlock(), getLookahead())
    }
}

private class EdgeIdentifierImpl(private val blocks: List<BlockId>) : EdgeIdentifier {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        return if (other !is EdgeIdentifierImpl) false else this.blocks == other.blocks
    }

    override fun hashCode(): Int {
        return Objects.hash(blocks)
    }
}
