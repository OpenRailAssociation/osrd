package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.conflicts.PathStop
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.GenericLinearRange
import fr.sncf.osrd.path.interfaces.LinearObjectRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.subRange
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.getBlockOffset
import fr.sncf.osrd.sim_infra.impl.getDirChunkLocation
import fr.sncf.osrd.sim_infra.utils.getRouteBlocks
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.AppendOnlyMap
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.appendOnlyMapOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
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

    /**
     * Returns a copy of the current instance, cleaning "teleport ranges" after backtracking steps.
     */
    fun cloneCleaningTeleportRanges(): InfraExplorer

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
     * Returns the end of the lookahead as a train path offset. Can also be seen as the total length
     * of the currently known path.
     */
    fun getLookaheadEndOffset(): Offset<PhysicsPath>
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

data class ExplorerStep(
    val locations: Collection<BlockLocation>,
    val duration: Double? = null,
    val stop: Boolean = false,
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
    location: BlockLocation,
    steps: List<ExplorerStep> = listOf(),
    constraints: PathfindingConstraint? = null,
): Collection<InfraExplorer> {
    val infraExplorers = mutableListOf<InfraExplorer>()
    val block = location.edge
    val pathProps = buildTrainPathFromBlock(rawInfra, blockInfra, block)
    val blockToPathProperties = mutableMapOf(block to pathProps)
    val routes = blockInfra.routesOnBlock(rawInfra, block)

    routes.forEach { route ->
        val infraExplorer =
            InfraExplorerImpl(
                rawInfra,
                blockInfra,
                appendOnlyLinkedListOf(),
                appendOnlyLinkedListOf(),
                appendOnlyMapOf(),
                null,
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
    private var routes: AppendOnlyLinkedList<RouteRange>,
    private var blockRoutes: AppendOnlyMap<BlockId, RouteId>,
    private var lastTrack: TrackSectionId?,
    private var trainPathCache: MutableMap<BlockId, TrainPath>,
    private var currentIndex: Int = 0,
    private var stepTracker: StepTracker,
    private var constraints: PathfindingConstraint?,
    override var isPathComplete: Boolean = false,
) : InfraExplorer {
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
        if (isPathComplete) return listOf() // Can't extend beyond the destination
        val infraExplorers = mutableListOf<InfraExplorer>()

        val lastSeenStep = stepTracker.getSeenSteps().lastOrNull()
        val nextRouteToBlockLocation: Map<RouteId, BlockLocation?> =
            if (
                lastSeenStep != null &&
                    lastSeenStep.isBacktracking &&
                    lastSeenStep.travelledPathOffset == blockRanges.lastOrNull()?.pathEnd
            ) {
                // TODO PEB: Output multiple consecutive routes to cover all the chunks under tail
                //   after backtracking
                val restartBlockLocations =
                    getBlockLocationsFromBacktrackingLocation(
                        lastSeenStep.location,
                        blockInfra,
                        rawInfra,
                    )

                val routeLocations = mutableMapOf<RouteId, BlockLocation?>()
                for (restart in restartBlockLocations) {
                    val routes = blockInfra.routesOnBlock(rawInfra, restart.edge)
                    for (route in routes) {
                        routeLocations[route] = restart
                    }
                }
                routeLocations
            } else {
                // generate routes starting after the last one
                val lastRoute = routes.last().value
                val lastRouteExit = rawInfra.getRouteExit(lastRoute)
                rawInfra.getRoutesStartingAtDet(lastRouteExit).associateWith { null }
            }
        nextRouteToBlockLocation.forEach { routeToBlockLocation ->
            val infraExplorer = this.clone() as InfraExplorerImpl
            val infraExtended =
                infraExplorer.extend(routeToBlockLocation.key, routeToBlockLocation.value)
            // Blocked explorers are dropped
            if (infraExtended) infraExplorers.add(infraExplorer)

            // generate backtracking lookaheads
            val nbAddedSteps =
                infraExplorer.stepTracker.getSeenSteps().size - this.stepTracker.getSeenSteps().size
            // TODO PEB: use real backtracking flag, not only "step.stop"
            for (possibleBacktracking in
                infraExplorer.stepTracker.iterateSeenStepsBackwards().take(nbAddedSteps).filter {
                    step ->
                    step.originalStep.stop
                }) {
                // clone and extend until backtracking
                // TODO PEB: add stop-step at the tail, right after backtracking (to be cleaned
                //   during postprocessing)
                val tailOffset =
                    possibleBacktracking.travelledPathOffset - 400.meters // TODO PEB: train length
                val tailBlockRange =
                    infraExplorer.blockRanges.iterateBackwards().firstOrNull {
                        it.pathBegin <= tailOffset
                    }
                if (tailBlockRange == null) continue
                val tailBlockLocation =
                    BlockLocation(
                        tailBlockRange.value,
                        Offset(tailOffset - tailBlockRange.objectAbsolutePathStart),
                    )
                val actualRestartLocations =
                    getBlockLocationsFromBacktrackingLocation(
                        tailBlockLocation,
                        blockInfra,
                        rawInfra,
                    )
                val extraStep =
                    ExplorerStep(
                        actualRestartLocations,
                        null,
                        false,
                        null,
                    ) // TODO PEB: stop if canBacktrack == false

                val explorerToBacktracking =
                    this.cloneInsertingInputStep(extraStep, possibleBacktracking.originalStep)
                        as InfraExplorerImpl
                val extendedToBacktracking =
                    explorerToBacktracking.extend(
                        routeToBlockLocation.key,
                        routeToBlockLocation.value,
                        possibleBacktracking.location,
                    )
                if (extendedToBacktracking) infraExplorers.add(explorerToBacktracking)
            }
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
            this.blockRanges.shallowCopy(),
            this.routes.shallowCopy(),
            this.blockRoutes.shallowCopy(),
            this.lastTrack,
            this.trainPathCache,
            this.currentIndex,
            this.stepTracker.clone(),
            this.constraints,
            this.isPathComplete,
        )
    }

    fun cloneInsertingInputStep(
        extraStep: ExplorerStep,
        previousStep: ExplorerStep,
    ): InfraExplorer {
        return InfraExplorerImpl(
            this.rawInfra,
            this.blockInfra,
            this.blockRanges.shallowCopy(),
            this.routes.shallowCopy(),
            this.blockRoutes.shallowCopy(),
            this.lastTrack,
            this.trainPathCache,
            this.currentIndex,
            this.stepTracker.cloneInsertingInputStep(extraStep, previousStep),
            this.constraints,
            this.isPathComplete,
        )
    }

    private fun <T> cleanTeleportRangesFromSortedLinearRanges(
        linearRanges: List<LinearObjectRange<T>>,
        teleportRanges: List<Pair<Offset<PhysicsPath>, Offset<PhysicsPath>>>,
    ): AppendOnlyLinkedList<LinearObjectRange<T>> {
        val newLinearRanges = appendOnlyLinkedListOf<LinearObjectRange<T>>()

        val teleportRangesIt = teleportRanges.iterator()
        var teleportRange =
            if (teleportRangesIt.hasNext()) {
                teleportRangesIt.next()
            } else {
                Pair(
                    Offset(Double.POSITIVE_INFINITY.meters),
                    Offset(Double.POSITIVE_INFINITY.meters),
                )
            }
        val linerRangesIt = linearRanges.iterator()
        var linearRange = linerRangesIt.next()

        while (true) {
            if (linearRange.pathEnd <= teleportRange.first) {
                newLinearRanges.add(
                    LinearObjectRange(
                        linearRange.value,
                        linearRange.objectBegin,
                        newLinearRanges.lastOrNull()?.pathEnd ?: Offset(0.meters),
                        linearRange.length,
                        linearRange.objectLength,
                    )
                )
                if (!linerRangesIt.hasNext()) break
                linearRange = linerRangesIt.next()
                continue
            }

            if (teleportRange.second <= linearRange.pathBegin) {
                teleportRange =
                    if (teleportRangesIt.hasNext()) {
                        teleportRangesIt.next()
                    } else {
                        Pair(
                            Offset(Double.POSITIVE_INFINITY.meters),
                            Offset(Double.POSITIVE_INFINITY.meters),
                        )
                    }
                continue
            }

            val rangeBeforeTeleport =
                linearRange.withTruncatedPathRange(linearRange.pathBegin, teleportRange.first)
            if (rangeBeforeTeleport != null && rangeBeforeTeleport.length != 0.meters)
                newLinearRanges.add(
                    LinearObjectRange(
                        rangeBeforeTeleport.value,
                        rangeBeforeTeleport.objectBegin,
                        newLinearRanges.lastOrNull()?.pathEnd ?: Offset(0.meters),
                        rangeBeforeTeleport.length,
                        rangeBeforeTeleport.objectLength,
                    )
                )

            val rangeAfterTeleport =
                linearRange.withTruncatedPathRange(teleportRange.second, linearRange.pathEnd)
            if (rangeAfterTeleport != null && rangeAfterTeleport.length != 0.meters)
                linearRange = rangeAfterTeleport
            else {
                if (!linerRangesIt.hasNext()) break
                linearRange = linerRangesIt.next()
            }
        }
        return newLinearRanges
    }

    override fun cloneCleaningTeleportRanges(): InfraExplorer {
        val seenStepList = getStepTracker().getSeenSteps().toList()
        val teleportRanges = mutableListOf<Pair<Offset<PhysicsPath>, Offset<PhysicsPath>>>()
        for (stepIdx in 0..seenStepList.size - 2) {
            if (seenStepList[stepIdx].isBacktracking) {
                teleportRanges.add(
                    seenStepList[stepIdx].travelledPathOffset to
                        seenStepList[stepIdx + 1].travelledPathOffset
                )
            }
        }

        return InfraExplorerImpl(
            this.rawInfra,
            this.blockInfra,
            cleanTeleportRangesFromSortedLinearRanges(this.blockRanges.toList(), teleportRanges),
            cleanTeleportRangesFromSortedLinearRanges(this.routes.toList(), teleportRanges),
            this.blockRoutes.shallowCopy(),
            this.lastTrack, // TODO PEB: check the use of the following 3s
            this.trainPathCache,
            this.currentIndex,
            this.stepTracker.cloneCleaningTeleportStep(),
            this.constraints,
            this.isPathComplete,
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
            getExploredRoutes(),
            electricalProfileMapping = electricalProfileMapping,
        )
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
            .filter { it.originalStep.stop && it.travelledPathOffset <= to }
            .map {
                PathStop(it.travelledPathOffset, RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP)
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

            // Simulation range start on the current block, 0m on any block that isn't the first
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

            // If a block cannot be explored, give up
            val isRouteBlocked =
                constraints?.apply(block)?.any {
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
}

private fun getBlockLocationsFromBacktrackingLocation(
    backtrackingLocation: BlockLocation,
    blockInfra: BlockInfra,
    rawInfra: RawInfra,
): List<BlockLocation> {
    val dirChunkLocation = blockInfra.getDirChunkLocation(backtrackingLocation, rawInfra)
    val dirChunkRestartLocation =
        DirChunkLocation(
            dirChunkLocation.dirChunk.opposite,
            Offset(
                rawInfra.getTrackChunkLength(dirChunkLocation.dirChunk.value).distance -
                    dirChunkLocation.offset.distance
            ),
        )
    val blocksOnWaypoint =
        blockInfra
            .getBlocksFromTrackChunk(
                dirChunkRestartLocation.dirChunk.value,
                dirChunkRestartLocation.dirChunk.direction,
            )
            .toSet()
    val restartBlockLocations = mutableListOf<BlockLocation>()
    for (block in blocksOnWaypoint) {
        val offset = blockInfra.getBlockOffset(block, dirChunkRestartLocation, rawInfra)
        assert(offset <= blockInfra.getBlockLength(block))
        restartBlockLocations.add(BlockLocation(block, offset))
    }
    return restartBlockLocations
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
