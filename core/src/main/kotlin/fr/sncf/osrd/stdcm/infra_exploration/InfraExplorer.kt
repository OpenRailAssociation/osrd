package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.conflicts.PathStop
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.DirChunkRange
import fr.sncf.osrd.path.interfaces.GenericLinearRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.mapSubObjects
import fr.sncf.osrd.path.interfaces.subRange
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.getRouteBlocks
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.AppendOnlyMap
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.appendOnlyMapOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.forceDirected
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.toOpposite
import java.util.*
import kotlin.math.max
import kotlin.to

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
    val isPathComplete: Boolean
    val backtrackingLocations: AppendOnlyLinkedList<BlockLocation>

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

    fun isLookaheadEmpty(): Boolean

    fun getAllBlocks(): AppendOnlyLinkedList<BlockRange>

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

    /**
     * Returns the block ranges in the given interval, going up to the path start/end if
     * unspecified.
     */
    fun getBlocksInRange(
        from: Offset<PhysicsPath>? = null,
        to: Offset<PhysicsPath>? = null,
    ): List<BlockRange>

    /**
     * Returns the route ranges in the given interval, going up to the path start/end if
     * unspecified.
     */
    fun getRoutesInRange(
        from: Offset<PhysicsPath>? = null,
        to: Offset<PhysicsPath>? = null,
    ): List<RouteRange>

    /** Returns the stops in the given interval, going up to the path start/end if unspecified. */
    fun getStopsInRange(
        from: Offset<PhysicsPath>? = null,
        to: Offset<PhysicsPath>? = null,
    ): List<PathStop>

    /**
     * Returns the backtrack locations in the given interval, going up to the path start/end if
     * unspecified
     */
    fun getBacktrackLocationsInRange(
        from: Offset<PhysicsPath>? = null,
        to: Offset<PhysicsPath>? = null,
    ): List<Offset<PhysicsPath>>

    /**
     * Returns the end of the lookahead as a train path offset. Can also be seen as the total length
     * of the currently known path.
     */
    fun getLookaheadEndOffset(): Offset<PhysicsPath>
}

/** Returns the current block and the lookahead blocks. */
fun InfraExplorer.getRemainingBlocks(): List<BlockId> {
    val res = mutableListOf(getCurrentBlock())
    res.addAll(getLookahead().map { it.value })
    return res
}

/** Returns the first backtracking location in the lookahead blocks. */
fun InfraExplorer.getBacktrackingLocationInLookahead(): BlockLocation? {
    val lastBacktrackingLocation = this.backtrackingLocations.lastOrNull() ?: return null
    return if (
        this.getLookahead().any {
            it.value == lastBacktrackingLocation.edge &&
                it.objectEnd == lastBacktrackingLocation.offset
        }
    )
        lastBacktrackingLocation
    else null
}

/** Used to identify an edge. */
interface EdgeIdentifier {
    override fun equals(other: Any?): Boolean

    override fun hashCode(): Int
}

data class ExplorerStep(
    val locations: Collection<BlockLocation>,
    val duration: Double? = null,
    val stop: Boolean = false,
    val canBacktrack: Boolean = false,
    val plannedTimingData: PlannedTimingData? = null,
)

/**
 * Init all InfraExplorers starting at the given location. The last of `stops` are used to identify
 * when the incremental path is complete. `constraints` are used to determine if a block can be
 * explored
 */
fun initInfraExplorers(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    rollingStockLength: Distance,
    location: BlockLocation,
    targets: List<ExplorerStep> = listOf(),
    constraints: List<PathfindingConstraint>? = null,
): Collection<InfraExplorer> {
    require(constraints == null || targets.isEmpty() || constraints.size == targets.size)
    val infraExplorers = mutableListOf<InfraExplorer>()
    val block = location.edge
    val pathProps = buildTrainPathFromBlock(rawInfra, blockInfra, block, listOf())
    val blockToPathProperties = mutableMapOf(block to pathProps)
    val routes = blockInfra.routesOnBlock(rawInfra, block)

    routes.forEach { route ->
        val infraExplorer =
            InfraExplorerImpl(
                rawInfra,
                blockInfra,
                rollingStockLength,
                appendOnlyLinkedListOf(),
                appendOnlyLinkedListOf(),
                appendOnlyMapOf(),
                null,
                blockToPathProperties,
                stepTracker = StepTracker(targets),
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
    private val rollingStockLength: Distance,
    // The "teleporting" part during backtracking (tail location becomes head location) is skipped
    // so there is a spatial discontinuity in this range list.
    private var blockRanges: AppendOnlyLinkedList<BlockRange>,
    // The "teleporting" part during backtracking (tail location becomes head location) is skipped
    // so there is a spatial discontinuity in this range list.
    private var routes: AppendOnlyLinkedList<RouteRange>,
    private var blockRoutes: AppendOnlyMap<BlockId, RouteId>,
    private var lastTrack: TrackSectionId?,
    private var trainPathCache: MutableMap<BlockId, TrainPath>,
    private var currentIndex: Int = 0, // /!\ currentBlockRange should be updated simultaneously /!\
    private var currentBlockRange: BlockRange? = null,
    private var stepTracker: StepTracker,
    private var constraints: List<PathfindingConstraint>?,
    override var isPathComplete: Boolean = false,
    // The locations where this InfraExplorer is really backtracking.
    override var backtrackingLocations: AppendOnlyLinkedList<BlockLocation> =
        appendOnlyLinkedListOf(),
) : InfraExplorer {
    override fun getCurrentEdgePathProperties(offset: Offset<Block>, length: Distance?): TrainPath {
        // We re-compute the routes of the current path since the cache may be incorrect
        // because of a previous iteration.
        // We also can't set a first route for sure in initInfraExplorer, but we set the first cache
        // entry.
        // So we have to correct that here now that we now which route we're on.
        val currentBlock = getCurrentBlock()
        val path =
            trainPathCache.getOrElse(currentBlock) {
                val res = buildTrainPathFromBlock(rawInfra, blockInfra, currentBlock, listOf())
                trainPathCache[currentBlock] = res
                res
            }
        val route = blockRoutes[getCurrentBlock()]!!

        val pathWithRoutes = path.withRoutes(listOf(route))

        val blockLength = blockInfra.getBlockLength(getCurrentBlock())
        val endOffset: Offset<Block> = if (length == null) blockLength else offset.plus(length)
        if (offset.distance == 0.meters && endOffset == blockLength) {
            // Edge takes up the whole path.
            return pathWithRoutes
        }
        // Edge takes part of the path: return corresponding sub-path.
        return pathWithRoutes.subPath(offset.cast(), endOffset.cast())
    }

    override fun getLastEdgeIdentifier(): EdgeIdentifier {
        return EdgeIdentifierImpl(getRemainingBlocks())
    }

    override fun cloneAndExtendLookahead(): Collection<InfraExplorer> {
        if (isPathComplete) return listOf() // Can't extend beyond the destination
        val infraExplorers = mutableListOf<InfraExplorer>()

        val lastSeenStep = stepTracker.getSeenSteps().lastOrNull()
        val nextRouteToBlockLocations = getNextRouteToBlockLocations(lastSeenStep)
        nextRouteToBlockLocations.forEach { (route, blockLocation) ->
            val infraExplorer = this.clone() as InfraExplorerImpl
            val infraExtended = infraExplorer.extend(route, blockLocation)
            // Blocked explorers are dropped
            if (infraExtended) infraExplorers.add(infraExplorer)

            // generate lookaheads until all possible backtracking locations (and let future extend
            // handle the rest)
            val nbAddedSteps =
                infraExplorer.stepTracker.getSeenSteps().size - this.stepTracker.getSeenSteps().size
            val isLastStepArrival = infraExplorer.isPathComplete
            val possibleBacktrackingSteps =
                infraExplorer.stepTracker
                    .iterateSeenStepsBackwards()
                    .take(nbAddedSteps)
                    .drop(if (isLastStepArrival) 1 else 0) // ignore arrival even if canBacktrack
                    .filter { step -> step.originalStep.canBacktrack }
            for (possibleBacktracking in possibleBacktrackingSteps) {
                val explorerToBacktracking = this.clone() as InfraExplorerImpl
                val extendedToBacktracking =
                    explorerToBacktracking.extend(
                        route,
                        blockLocation,
                        possibleBacktracking.location,
                    )
                if (extendedToBacktracking) {
                    explorerToBacktracking.backtrackingLocations.add(possibleBacktracking.location)
                    infraExplorers.add(explorerToBacktracking)
                }
            }
        }
        return infraExplorers
    }

    private fun getNextRouteToBlockLocations(
        lastSeenStep: LocatedStep?
    ): Map<RouteId, BlockLocation?> {
        if (
            lastSeenStep != null &&
                lastSeenStep.isBacktracking &&
                lastSeenStep.travelledPathOffset == blockRanges.lastOrNull()?.pathEnd
        ) {
            // backtracking step at the end of the current path: generate backtracking routes
            return getRouteToBlockLocationsAfterBacktracking(lastSeenStep)
        }

        // generate routes starting after the last one
        val lastRoute = routes.last().value
        val lastRouteExit = rawInfra.getRouteExit(lastRoute)
        return rawInfra.getRoutesStartingAtDet(lastRouteExit).associateWith { null }
    }

    override fun moveForward(): InfraExplorer {
        assert(currentIndex < blockRanges.size - 1) {
            "Infra Explorer: Current edge is already the last edge: can't move forward."
        }
        currentIndex += 1
        currentBlockRange = null
        return this
    }

    override fun getCurrentBlock(): BlockId {
        return getCurrentBlockRange().value
    }

    override fun getCurrentBlockRange(): BlockRange {
        currentBlockRange?.let {
            return it
        }
        assert(currentIndex < blockRanges.size) {
            "InfraExplorer: currentBlockIndex is out of bounds."
        }
        return blockRanges[currentIndex].also { currentBlockRange = it }
    }

    override fun isLookaheadEmpty(): Boolean {
        return currentIndex >= blockRanges.size - 1
    }

    override fun getAllBlocks(): AppendOnlyLinkedList<BlockRange> {
        return blockRanges
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
            .asReversed()
    }

    override fun clone(): InfraExplorer {
        return InfraExplorerImpl(
            this.rawInfra,
            this.blockInfra,
            this.rollingStockLength,
            this.blockRanges.shallowCopy(),
            this.routes.shallowCopy(),
            this.blockRoutes.shallowCopy(),
            this.lastTrack,
            this.trainPathCache,
            this.currentIndex,
            this.currentBlockRange,
            this.stepTracker.clone(),
            this.constraints,
            this.isPathComplete,
            this.backtrackingLocations.shallowCopy(),
        )
    }

    override fun getExploredRoutes(): List<RouteId> {
        return routes.toList().map { it.value }
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
            getSeenBacktrackLocations(),
            getExploredRoutes(),
            electricalProfileMapping = electricalProfileMapping,
        )
    }

    private fun getSeenBacktrackLocations(): List<Offset<PhysicsPath>> {
        return stepTracker
            .iterateSeenStepsBackwards()
            .mapNotNull { if (it.isBacktracking) it.travelledPathOffset else null }
            .toList()
            .asReversed()
    }

    private fun <T, U> getSubRanges(
        list: AppendOnlyLinkedList<GenericLinearRange<T, U>>,
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
    ): List<GenericLinearRange<T, U>> {
        val from = from ?: Offset.zero()
        val to = to ?: getLookaheadEndOffset()
        return list
            .iterateBackwards()
            .takeWhile { from <= it.pathEnd }
            .toList()
            .asReversed()
            // TODO: implement subRange for AppendOnlyLinkedList<GenericLinearRange>.
            .subRange(from, to)
    }

    override fun getBlocksInRange(
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
    ): List<BlockRange> = getSubRanges(blockRanges, from, to)

    override fun getRoutesInRange(
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
    ): List<RouteRange> = getSubRanges(routes, from, to)

    override fun getStopsInRange(
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
    ): List<PathStop> {
        val from = from ?: Offset.zero()
        val to = to ?: getLookaheadEndOffset()
        return getStepTracker()
            .iterateSeenStepsBackwards()
            .takeWhile { it.travelledPathOffset >= from }
            .mapNotNull {
                if (it.originalStep.stop && it.travelledPathOffset <= to)
                    PathStop(
                        it.travelledPathOffset,
                        RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP,
                    )
                else null
            }
            .toList()
            .asReversed()
    }

    override fun getBacktrackLocationsInRange(
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
    ): List<Offset<PhysicsPath>> {
        val from = from ?: Offset.zero()
        val to = to ?: getLookaheadEndOffset()
        return getStepTracker()
            .iterateSeenStepsBackwards()
            .takeWhile { it.travelledPathOffset >= from }
            .mapNotNull {
                if (it.isBacktracking && it.travelledPathOffset <= to) it.travelledPathOffset
                else null
            }
            .toList()
            .asReversed()
    }

    override fun getLookaheadEndOffset(): Offset<PhysicsPath> =
        blockRanges.lastOrNull()?.pathEnd ?: Offset.zero()

    /**
     * Updates `incrementalPath`, `routes`, `blocks` and returns true if route can be explored.
     * Otherwise, it returns false and the instance is supposed to be dropped. `blockRoutes` is
     * updated to keep track of the route used for each block.
     */
    fun extend(
        route: RouteId,
        fromLocation: BlockLocation? = null,
        untilBacktrackingLocation: BlockLocation? = null,
    ): Boolean {
        val routeBlocks = blockInfra.getRouteBlocks(rawInfra, route)
        if (routeBlocks.isEmpty()) return false

        var seenFirstBlock = fromLocation == null
        var isBacktrackingBlockReached = false

        var routeBeginOffset = Offset<Route>(fromLocation?.offset?.distance ?: 0.meters)
        for (block in routeBlocks) {
            val blockLength = blockInfra.getBlockLength(block)

            seenFirstBlock = seenFirstBlock || block == fromLocation?.edge

            if (!seenFirstBlock) {
                routeBeginOffset += blockLength.distance
                continue
            }

            blockRoutes[block] = route

            // Simulation range start on the current block, 0m on any block that isn't the first or
            // just after backtracking
            val blockStartOffset: Offset<Block> =
                if (block == fromLocation?.edge) fromLocation.offset else Offset(0.meters)

            isBacktrackingBlockReached = block == untilBacktrackingLocation?.edge
            val untilOffset =
                if (isBacktrackingBlockReached) untilBacktrackingLocation!!.offset else blockLength

            stepTracker.exploreBlockRange(
                block,
                blockStartOffset,
                untilOffset,
                isBacktrackingBlockReached,
            )

            val lastSeenStepLocation = stepTracker.getSeenSteps().lastOrNull()?.location
            isPathComplete = stepTracker.hasSeenDestination() && lastSeenStepLocation?.edge == block
            val blockEndOffset = if (isPathComplete) lastSeenStepLocation!!.offset else untilOffset

            val stepIndex =
                max(0, stepTracker.iterateSeenStepsBackwards().count { it.isPlanned } - 1)

            // If a block cannot be explored, give up
            val isRouteBlocked =
                constraints?.get(stepIndex)?.apply(block)?.any {
                    blockStartOffset < it.end && blockEndOffset > it.start
                } ?: false
            if (isRouteBlocked) return false

            val rangePathBegin = getLookaheadEndOffset()
            val rangePathEnd = rangePathBegin + (blockEndOffset - blockStartOffset)

            if (rangePathBegin > rangePathEnd) continue

            val blockRange =
                BlockRange(
                    value = block,
                    objectBegin = blockStartOffset,
                    objectEnd = blockEndOffset,
                    pathBegin = rangePathBegin,
                    pathEnd = rangePathEnd,
                    objectLength = blockLength,
                )
            blockRanges.add(blockRange)
            if (isPathComplete || isBacktrackingBlockReached) break // Can't extend any further
        }
        assert(seenFirstBlock)
        assert(untilBacktrackingLocation == null || isBacktrackingBlockReached)

        val lastRouteEndOffset = routes.lastOrNull()?.pathEnd ?: Offset(0.meters)
        val newRouteEndOffset = blockRanges.lastOrNull()?.pathEnd ?: Offset(0.meters)
        val routeLengthAdded = newRouteEndOffset - lastRouteEndOffset
        val routeLength = rawInfra.getRouteLength(route)

        routes.add(
            RouteRange(
                route,
                routeBeginOffset,
                routeBeginOffset + routeLengthAdded,
                lastRouteEndOffset,
                newRouteEndOffset,
                routeLength,
            )
        )

        return true
    }

    override fun toString(): String {
        // Not everything is printed, this is what feels the most comfortable in a debugging window
        return String.format("currentBlock=%s, lookahead=%s", getCurrentBlock(), getLookahead())
    }

    private fun getRouteToBlockLocationsAfterBacktracking(
        headStepBeforeBacktracking: LocatedStep
    ): Map<RouteId, BlockLocation> {
        val chunksUnderTrainAfterBacktracking =
            getDirChunksUnderTrainAfterBacktracking(headStepBeforeBacktracking)

        val headRestartBlockLocations =
            getHeadRestartBlockLocationsAfterBacktracking(headStepBeforeBacktracking)

        val routePathsUnderTrainAfterBacktracking =
            rawInfra.chunksToRoutePaths(chunksUnderTrainAfterBacktracking)
        val routesOnHeadRestart =
            routePathsUnderTrainAfterBacktracking
                .map { it.last() } // only the last route is useful
                .toSet()

        val result = mutableMapOf<RouteId, BlockLocation>()

        routesOnHeadRestart.forEach { headRestartRoute ->
            val lastRouteBlocks = blockInfra.getRouteBlocks(rawInfra, headRestartRoute)
            if (lastRouteBlocks.isEmpty()) return@forEach

            val headRestartBlockLocation =
                headRestartBlockLocations.firstOrNull { it.edge in lastRouteBlocks }
            if (headRestartBlockLocation == null) {
                logger.warn(
                    "Route ${rawInfra.getRouteName(headRestartRoute)} has no block listed in restart locations"
                )
                return@forEach
            }

            result[headRestartRoute] = headRestartBlockLocation
        }

        return result
    }

    /**
     * During backtracking, head of the train is "teleported" to the former tail location.
     *
     * From the head location before backtracking, compute the tail location, then obtain all the
     * possible block-location at that location corresponding to the opposite direction
     */
    private fun getHeadRestartBlockLocationsAfterBacktracking(
        headStepBeforeBacktracking: LocatedStep
    ): List<BlockLocation> {
        val tailOffsetBeforeBacktracking =
            Offset.max(
                headStepBeforeBacktracking.travelledPathOffset - rollingStockLength,
                Offset(0.meters),
            )
        val tailBlockRangeBeforeBacktracking =
            blockRanges.iterateBackwards().first { it.pathBegin <= tailOffsetBeforeBacktracking }
        val possibleRestartBlockLocations =
            getOppositeBlockLocations(
                BlockLocation(
                    tailBlockRangeBeforeBacktracking.value,
                    Offset(
                        tailOffsetBeforeBacktracking -
                            tailBlockRangeBeforeBacktracking.objectAbsolutePathStart
                    ),
                ),
                blockInfra,
                rawInfra,
            )
        return possibleRestartBlockLocations
    }

    private fun getDirChunksUnderTrainAfterBacktracking(
        headStepBeforeBacktracking: LocatedStep
    ): List<DirTrackChunkId> {
        val blockRangesUnderTrainBeforeBacktracking =
            getSubRanges(
                blockRanges,
                headStepBeforeBacktracking.travelledPathOffset - rollingStockLength,
                headStepBeforeBacktracking.travelledPathOffset,
            )
        val chunkRangesUnderTrainBeforeBacktracking: List<DirChunkRange> =
            blockRangesUnderTrainBeforeBacktracking.mapSubObjects(
                blockInfra::getTrackChunksFromBlock
            ) {
                rawInfra.getTrackChunkLength(it.value).forceDirected()
            }
        return chunkRangesUnderTrainBeforeBacktracking.map { it.value.opposite }.asReversed()
    }
}

/**
 * From a given block location, return all the block locations corresponding to the opposite
 * direction
 */
fun getOppositeBlockLocations(
    blockLocation: BlockLocation,
    blockInfra: BlockInfra,
    rawInfra: RawInfra,
): List<BlockLocation> {
    val dirChunkLocation = blockInfra.getDirChunkLocation(blockLocation, rawInfra)
    val oppositeDirChunkLocation =
        DirChunkLocation(
            dirChunkLocation.dirChunk.opposite,
            dirChunkLocation.offset.toOpposite(
                rawInfra.getTrackChunkLength(dirChunkLocation.dirChunk.value)
            ),
        )
    val oppositeBlocks =
        blockInfra
            .getBlocksFromTrackChunk(
                oppositeDirChunkLocation.dirChunk.value,
                oppositeDirChunkLocation.dirChunk.direction,
            )
            .toSet()
    val oppositeBlockLocations = mutableListOf<BlockLocation>()
    for (block in oppositeBlocks) {
        val offset = blockInfra.getBlockOffset(block, oppositeDirChunkLocation, rawInfra)
        assert(offset <= blockInfra.getBlockLength(block))
        oppositeBlockLocations.add(BlockLocation(block, offset))
    }
    return oppositeBlockLocations
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
