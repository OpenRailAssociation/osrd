package fr.sncf.osrd.conflicts

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EoaType
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.ZonePathRange
import fr.sncf.osrd.path.interfaces.addLinearObjects
import fr.sncf.osrd.path.interfaces.mapPointObjects
import fr.sncf.osrd.path.interfaces.mapSubObjects
import fr.sncf.osrd.path.interfaces.subRange
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.ZonePathId
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.sim_infra.api.getZonePathZone
import fr.sncf.osrd.standalone_sim.CLOSED_SIGNAL_RESERVATION_MARGIN
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import fr.sncf.osrd.utils.units.toOffset
import kotlin.collections.iterator
import kotlin.comparisons.compareBy
import kotlin.math.max
import kotlin.math.min
import mu.KotlinLogging

val logger = KotlinLogging.logger {}

data class PathStop(
    val pathOffset: Offset<PhysicsPath>,
    val receptionSignal: RJSTrainStop.RJSReceptionSignal,
)

/**
 * This class generates all spacing requirements for a given train. Spacing requirements are
 * detection zones that need to be unoccupied in time intervals so that the train can run at its
 * simulated speed, without any signal slowing it down.
 *
 * The train path and train times/speeds can both be given incrementally. Incomplete times can
 * result in incomplete requirements: we know when the zone is first required, not when it's
 * unrequired. Incomplete paths can make it impossible to return a result, in which case the path
 * needs to be extended. Calls to `processUpdate` only return requirements that have been added or
 * extended since last call.
 *
 * Here's the internal process:
 * * We store a subset of the path, expressed as block/route range lists. We only keep path elements
 *   starting at the next signal to process.
 * * When the path is extended, we also store relevant data for new signals.
 * * For each zone, we keep track of the offsets where it's first required and cleared.
 * * When a signal is first seen, we identify the requirement boundaries (if possible) and update
 *   zone "first required" offsets.
 *     * That's when we quit and return null if the path is too short
 * * We then remove all seen signals from the list, and remove path ranges up to the next pending
 *   signal.
 * * We then yield all ongoing requirements, and discard zones that have been cleared.
 *
 * Note: when debugging spacing resources locally, the data classes can be tweaked to keep track of
 * their sources (i.e. which signal caused a given zone requirement). It's not part of the class as
 * it adds an overhead, but it makes the debugging experience more efficient.
 */
data class SpacingResourceGenerator(
    val rawInfra: RawInfra,
    val blockInfra: BlockInfra,
    val loadedSignalInfra: LoadedSignalInfra,
    val simulator: SignalingSimulator,
    // TODO: Required for ETCS (STDCM doesn't provide it currently, will have to eventually)
    val context: EnvelopeSimContext? = null,
) {
    constructor(
        fullInfra: FullInfra,
        context: EnvelopeSimContext? = null,
    ) : this(
        fullInfra.rawInfra,
        fullInfra.blockInfra,
        fullInfra.loadedSignalInfra,
        fullInfra.signalingSimulator,
        context,
    )

    // We only keep a small part of the path (from the current train head to the end of the
    // lookahead section). Which makes it OK to copy the lists when the path branches.
    // NOTE: any field added here needs to be added to `clone`, and needs to be trimmed when the
    // train moves past the given objects.
    private val blockRanges = ArrayDeque<BlockRange>()
    private val routeRanges = ArrayDeque<RouteRange>()
    private val zoneRanges = ArrayDeque<ZonePathRange>()
    private val closedSignalStops = ArrayDeque<PathStop>()
    private val backtrackingLocations = mutableListOf<Offset<PhysicsPath>>()
    private val pendingSignals = ArrayDeque<PendingSignalData>()
    // It's tempting to use zone id instead of zone path ids here,
    // but data for the same zone in different directions can't be merged
    private val ongoingZoneRequirements = mutableMapOf<ZonePathId, OngoingZoneRequirement>()

    private var isPathComplete: Boolean = false // TODO PEB: rename this
    private var reachedFirstSignal: Boolean = false // TODO PEB: rename this

    fun resetAfterbacktracking() {
        isPathComplete = false
        reachedFirstSignal = false
    }

    /**
     * Add a new segment of the path. The ranges must cover the same range of `Offset<PhysicsPath>`,
     * and any stop in that range needs to be listed.
     */
    fun extendPath(
        newBlockRanges: List<BlockRange>,
        newRouteRanges: List<RouteRange>,
        newStops: List<PathStop>,
        isPathComplete: Boolean,
        newBacktrackLocations: List<Offset<PhysicsPath>>,
    ) {
        // add first backtracking location if extension is starting by it (and it's not already
        // listed)
        val firstBacktracking = newBacktrackLocations.firstOrNull()
        if (
            firstBacktracking != null &&
                firstBacktracking != backtrackingLocations.lastOrNull() &&
                firstBacktracking == newBlockRanges.first().pathBegin
        ) {
            // as backtracking locations are fallback for getCurrentPathEndOffset(), if possible,
            // check that first choice is consistent
            if (blockRanges.isNotEmpty()) {
                require(blockRanges.last().pathEnd == newBlockRanges.first().pathBegin)
            }
            backtrackingLocations.add(firstBacktracking)
        }
        // Some assertions on the inputs
        val previousPathEnd = getCurrentPathEndOffset()
        val newPathEnd = newBlockRanges.last().pathEnd
        val emptyPathExtension = previousPathEnd == newPathEnd
        require(!this.isPathComplete || emptyPathExtension)
        require(newBlockRanges.first().pathBegin == previousPathEnd)
        require(newRouteRanges.first().pathBegin == previousPathEnd)
        require(newPathEnd == newRouteRanges.last().pathEnd)
        require(newStops.all { it.pathOffset in previousPathEnd..newPathEnd })

        this.isPathComplete = isPathComplete
        if (emptyPathExtension) return

        val newZoneRanges =
            newBlockRanges.mapSubObjects(blockInfra::getBlockZonePaths, rawInfra::getZonePathLength)
        require(newPathEnd == newZoneRanges.last().pathEnd)
        // TODO: iterate until the end of the newRoute instead to require what's after the
        //   backtracking or after the end.
        //   Maybe also under train queue during start or backtracking.
        val signals =
            newBlockRanges.mapPointObjects(
                blockInfra::getBlockSignals,
                blockInfra::getSignalsPositions,
            )

        if (!reachedFirstSignal) {
            // We should rely on signaling to generate zone requirements, but that excludes zones
            // before the first signal. We add them manually here.
            reachedFirstSignal = signals.isNotEmpty()
            for (zoneRange in newZoneRanges) {
                ongoingZoneRequirements.getOrPut(zoneRange.value) {
                    OngoingZoneRequirement(zoneRange.pathBegin, zoneRange.pathEnd)
                }
            }
        }

        // dedup first backtracking if it was already added previously
        if (
            newBacktrackLocations.isNotEmpty() &&
                newBacktrackLocations.first() == backtrackingLocations.lastOrNull()
        ) {
            backtrackingLocations.addAll(newBacktrackLocations.asSequence().drop(1))
        } else {
            backtrackingLocations.addAll(newBacktrackLocations)
        }
        blockRanges.addLinearObjects(newBlockRanges)
        routeRanges.addLinearObjects(newRouteRanges)
        zoneRanges.addLinearObjects(newZoneRanges)
        closedSignalStops.addAll(newStops.filter { it.receptionSignal.isStopOnClosedSignal })
        for ((signal, pathOffset) in signals) {
            if (pendingSignals.lastOrNull()?.signal == signal)
                continue // block transition signals are listed on either block
            val physicalSignal = loadedSignalInfra.getPhysicalSignal(signal)
            val sightDistance = rawInfra.getSignalSightDistance(physicalSignal)
            val lastBacktrackingLocation =
                backtrackingLocations.findLast { it <= pathOffset } ?: Offset(0.meters)
            val sightOffset = max(lastBacktrackingLocation, pathOffset - sightDistance)
            val sigSystemId = loadedSignalInfra.getSignalingSystem(signal)
            val isCurveBased = simulator.sigModuleManager.isCurveBased(sigSystemId)
            if (
                isCurveBased &&
                    (simulator.sigModuleManager.getName(sigSystemId) != ETCS_LEVEL2.id ||
                        context == null)
            )
                TODO(
                    "Spacing requirements for curve-based signals are only available " +
                        "for ETCS_LEVEL2 and trough StandaloneSimulation"
                )
            pendingSignals.add(PendingSignalData(signal, pathOffset, sightOffset, isCurveBased))
        }
    }

    /**
     * Processes all the changes since last call. Returns null if the path is not long enough.
     *
     * Returns all requirements that are either new or were not complete at last call.
     *
     * TODO: This should return null when a signal *could* be within sight distance but not part of
     *   the lookahead, but we don't test for that yet. We should look for the longest signal in the
     *   infra, but doing so would make stdcm vulnerable to data error.
     */
    fun processUpdate(callbacks: IncrementalRequirementCallbacks): List<SpacingRequirement>? {
        val simulatedLength = callbacks.currentPathOffset
        val signalsToProcess = pendingSignals.takeWhile { it.sightOffset <= simulatedLength }
        val signalEndOffsets = mutableMapOf<LogicalSignalId, Offset<PhysicsPath>>()

        val simulationData =
            SimulationCacheData(blockRanges.map { it.value }, routeRanges.map { it.value }, context)

        for (signal in signalsToProcess.asReversed()) {
            // Reversing the list starts with the most likely to fail
            signalEndOffsets[signal.signal] =
                getRequirementEndOffset(simulationData, signal, callbacks) ?: return null
        }

        for (signal in signalsToProcess) {
            pendingSignals.removeFirst()
            signalToOngoingRequirements(
                simulationData,
                signal,
                signalEndOffsets[signal.signal]!!,
                callbacks,
            )
        }

        val minRelevantPathOffset = pendingSignals.minOfOrNull { it.sightOffset } ?: simulatedLength
        blockRanges.removeWhile { it.pathEnd < minRelevantPathOffset }
        routeRanges.removeWhile { it.pathEnd < minRelevantPathOffset }
        zoneRanges.removeWhile { it.pathEnd < minRelevantPathOffset }

        return yieldCurrentRequirements(callbacks)
    }

    /** Clone all the underlying values. Can be used to explore branching paths. */
    fun clone(): SpacingResourceGenerator {
        val res =
            SpacingResourceGenerator(rawInfra, blockInfra, loadedSignalInfra, simulator, context)
        res.blockRanges.addAll(blockRanges)
        res.routeRanges.addAll(routeRanges)
        res.zoneRanges.addAll(zoneRanges)
        res.closedSignalStops.addAll(closedSignalStops)
        res.backtrackingLocations.addAll(backtrackingLocations)
        res.pendingSignals.addAll(pendingSignals)
        res.isPathComplete = isPathComplete
        res.reachedFirstSignal = reachedFirstSignal
        for ((zone, data) in ongoingZoneRequirements) res.ongoingZoneRequirements[zone] =
            data.copy()
        return res
    }

    /** Returns the current end of the processed path. */
    fun getCurrentPathEndOffset(): Offset<PhysicsPath> {
        return blockRanges.lastOrNull()?.pathEnd
            ?: backtrackingLocations.lastOrNull()
            ?: Offset(0.meters)
    }

    /**
     * Processes a signal from the pending signal map. Sets values in the "ongoing requirement"
     * maps.
     *
     * End offsets are known at this point, so the path is long enough.
     */
    private fun signalToOngoingRequirements(
        simulationData: SimulationCacheData,
        signalData: PendingSignalData,
        endOffset: Offset<PhysicsPath>,
        callbacks: IncrementalRequirementCallbacks,
    ) {
        val zoneRanges =
            zoneRanges.subRange(signalData.offset, endOffset).filter { !it.isSinglePoint() }
        val requiredOffset =
            if (signalData.isCurveBased)
                getETCSFirstRequiredOffset(simulationData, signalData, callbacks)
            else signalData.sightOffset

        for (zoneRange in zoneRanges) {
            require(requiredOffset <= zoneRange.pathBegin)
            val ongoingRequirementData =
                ongoingZoneRequirements.getOrPut(zoneRange.value) {
                    OngoingZoneRequirement(zoneRange.pathBegin, zoneRange.pathEnd)
                }
            ongoingRequirementData.updateMinRequirementOffset(requiredOffset)
        }
    }

    /** Returns the offset at which the ETCS "signal" can slow the train down. */
    private fun getETCSFirstRequiredOffset(
        simulationData: SimulationCacheData,
        signalData: PendingSignalData,
        callbacks: IncrementalRequirementCallbacks,
    ): Offset<PhysicsPath> {
        val signal = signalData.signal
        var isRouteDelimiter = true
        try {
            isRouteDelimiter = loadedSignalInfra.getSettings(signal).getFlag("Nf")
        } catch (e: Throwable) {
            logger.warn {
                "Unable to determine if " +
                    "signal ${rawInfra.getLogicalSignalName(signal)} is a route delimiter or not: $e"
            }
        }
        val envelope = callbacks.getRawEnvelopeIfSingle()
        // TODO: stop using a single envelope that's unavailable in STDCM and maybe move to a
        //   dedicated EnvelopeTimeInterpolate.getIntersection().
        //   Then probably protect its failure by returning like when there's not enough path.
        require(envelope != null) {
            "A single envelope covering whole path is currently expected (used only through standalone simulation)"
        }

        val etcsSimulator = simulationData.etcsBrakingSimulator
        val eoa =
            etcsSimulator
                .computeEoaLocations(
                    envelope,
                    listOf(signalData.offset),
                    listOf(isRouteDelimiter),
                    EoaType.SPACING,
                )
                .first()
        val curvesList = etcsSimulator.computeStopBrakingCurves(envelope, listOf(eoa))

        require(curvesList.size == 1)
        return curvesList[eoa]!![IND]?.brakingCurve?.beginPos?.toOffset() ?: eoa.offsetEOA
    }

    /** Generates all ongoing requirements. Discards zones that have been cleared. */
    private fun yieldCurrentRequirements(
        callbacks: IncrementalRequirementCallbacks
    ): List<SpacingRequirement> {
        val res = mutableListOf<SpacingRequirement>()
        val zonePathsToRemove = mutableListOf<ZonePathId>()
        for ((zonePath, ongoingRequirementData) in ongoingZoneRequirements) {
            val zoneId = rawInfra.getZonePathZone(zonePath)
            val requirement =
                ongoingRequirementData.generateRequirement(zoneId, callbacks, closedSignalStops)
            if (requirement != null) {
                res.add(requirement)
                if (requirement.isComplete) zonePathsToRemove.add(zonePath)
            }
        }
        for (zonePath in zonePathsToRemove) { // Avoid modifying while iterating
            ongoingZoneRequirements.remove(zonePath)
        }
        // `currentPathOffset` is at least some blocks before the end of the path to be explored.
        // And so signals (and protected zones) after `currentPathOffset` that could be impacted by
        // a simulated closed-signal stop are already taken care of.
        closedSignalStops.removeWhile { it.pathOffset < callbacks.currentPathOffset }
        return res
    }

    /**
     * Generate the `SignalingTrainState` for the given signal, using the speed range up to the next
     * signal.
     */
    private fun buildTrainState(
        signalData: PendingSignalData,
        callbacks: IncrementalRequirementCallbacks,
    ): SignalingTrainState? {
        val nextSignalOffset =
            pendingSignals.map { it.offset }.firstOrNull { it > signalData.offset }
                ?: if (isPathComplete) callbacks.currentPathOffset else return null
        val maxSpeedInSignalArea =
            callbacks.maxSpeedInRange(signalData.sightOffset, nextSignalOffset)
        class SignalingTrainStateImpl(override val speed: Speed) : SignalingTrainState
        return SignalingTrainStateImpl(speed = maxSpeedInSignalArea.metersPerSecond)
    }

    /**
     * For a given signal, returns the end offset of the last required zone, or null if more path is
     * needed.
     */
    private fun getRequirementEndOffset(
        simulationData: SimulationCacheData,
        signalData: PendingSignalData,
        callbacks: IncrementalRequirementCallbacks,
    ): Offset<PhysicsPath>? {
        if (signalData.isCurveBased)
            return blockRanges.first { it.pathBegin >= signalData.offset }.pathEnd
        val trainState = buildTrainState(signalData, callbacks) ?: return null
        // Check if more path is needed for a valid solution
        // (i.e. the zone after the end of the path is still required)
        // TODO PEB: adapt for backtracking case?
        val lastZoneIndex = zoneRanges.lastIndex + 1
        if (!isPathComplete) {
            if (
                isZoneIndexRequiredForSignal(
                    simulationData,
                    lastZoneIndex,
                    signalData.signal,
                    trainState,
                ) != false
            ) {
                return null
            }
        }

        // We are looking for the index `i` where `isZoneIndexRequiredForSignal` returns
        // true at `i-1` and false at `i`. We could just iterate starting at 0, but
        // because `i` is not that small (20 on average) and the signaling
        // simulation calls are expensive, we prefer an approach similar to
        // a binary-search

        // The values here are determined empirically on imported infrastructures,
        // the solutions mostly follow a gaussian distribution centered
        // on start+20 that rarely exceeds start+40.
        // We run a binary search on that range, and iterate one by one when the solution is above.
        var lowerBound = zoneRanges.indexOfFirst { it.pathBegin >= signalData.offset }
        if (lowerBound < 0) return zoneRanges.last().pathEnd
        val initialUpperBound = min(lowerBound + 40, lastZoneIndex)
        var upperBound = initialUpperBound

        // Attempt at the given index, updating the min/max values depending on the result.
        fun tryAt(index: Int) {
            if (index !in lowerBound..<upperBound) return
            val required =
                isZoneIndexRequiredForSignal(simulationData, index, signalData.signal, trainState)!!
            if (required) {
                lowerBound = index + 1
            } else {
                upperBound = index
            }
        }

        // Initial first guess based on block sizes. We never *need* that guess to be correct, but
        // it skips the binary search when it is. Otherwise, it still updates the min/max bounds.
        guessZoneIndex(signalData)?.let {
            tryAt(it + 1)
            tryAt(it)
        }

        // Main loop, binary search
        while (lowerBound < upperBound) {
            val probedZoneIndex = (upperBound + lowerBound) / 2
            tryAt(probedZoneIndex)
        }

        // Handle the case where the result is higher than the initial upper bound
        while (
            lowerBound in initialUpperBound..<lastZoneIndex &&
                isZoneIndexRequiredForSignal(
                    simulationData,
                    lowerBound,
                    signalData.signal,
                    trainState,
                )!!
        ) lowerBound++
        val firstNonRequiredZoneIndex = lowerBound
        return zoneRanges[firstNonRequiredZoneIndex - 1].pathEnd
    }

    /**
     * Try to guess the index of the last required zone, based on block length and common signaling
     * patterns. A correct guess skips the binary search.
     */
    private fun guessZoneIndex(signalData: PendingSignalData): Int? {
        val firstBlockIndex = blockRanges.indexOfFirst { it.pathBegin >= signalData.offset }
        if (firstBlockIndex < 0) return null
        val initialGuess = blockRanges.getOrNull(firstBlockIndex + 1)?.pathEnd ?: return null
        return zoneRanges.indexOfLast { it.pathEnd <= initialGuess }
    }

    /**
     * * Returns true if the zone is required to be clear for the signal to not be constraining.
     * * Returns false if it's not required.
     * * Returns null if we need a longer path to tell.
     */
    private fun isZoneIndexRequiredForSignal(
        simulationData: SimulationCacheData,
        probedZoneIndex: Int,
        signal: LogicalSignalId,
        trainState: SignalingTrainState,
    ): Boolean? {
        if (probedZoneIndex > zoneRanges.size) return null
        val zoneStates =
            if (probedZoneIndex < zoneRanges.size) {
                mapOf(probedZoneIndex to ZoneStatus.OCCUPIED)
            } else {
                // Otherwise we rely on the `followingZoneState` of `simulator.evaluate`
                mapOf()
            }
        val firstZonePath = zoneRanges.first().value
        val firstZone = rawInfra.getZonePathZone(firstZonePath)
        val simulatedSignalStates =
            simulator.evaluate(
                rawInfra,
                loadedSignalInfra,
                blockInfra,
                simulationData.blockIds,
                simulationData.routeIds,
                simulationData.blockIds.size,
                zoneStates,
                ZoneStatus.OCCUPIED,
                firstZone = firstZone,
            )

        if (!simulatedSignalStates.containsKey(signal)) return false
        val signalState = simulatedSignalStates[signal]!!

        return simulator.sigModuleManager.isConstraining(
            loadedSignalInfra.getSignalingSystem(signal),
            signalState,
            trainState,
        )
    }

    /** Keeps track of relevant data for any signal on the path (but not yet cleared). */
    private data class PendingSignalData(
        /** ID of the logical signal */
        val signal: LogicalSignalId,
        /** Offset of the signal itself */
        val offset: Offset<PhysicsPath>,
        /** Offset at which the signal is seen by the train */
        val sightOffset: Offset<PhysicsPath>,
        /** Whether this signal is curve-based (ETCS or similar) */
        val isCurveBased: Boolean,
    )

    /**
     * Keeps track of critical points for a given zone.
     *
     * Note: when debugging, this class can be patched to keep track of which signals caused the
     * requirements and when.
     */
    private data class OngoingZoneRequirement(
        /**
         * Offset where the train enters the zone. Used to know which stops can delay the
         * requirements.
         *
         * TODO: this is incorrect as stops should be considered at the signal level. It's legacy
         *   behavior identical to the previous class, for an easier transition.
         */
        val zoneEntryOffset: Offset<PhysicsPath>,
        /** Offset where the train clears the zone. Does not consider the train length. */
        val zoneExitOffset: Offset<PhysicsPath>,
        /** The train first needs this zone to be free when the head reaches this offset. */
        var minRequiredOffset: Offset<PhysicsPath> = zoneEntryOffset,
    ) {
        /**
         * To be called when a signal requires this zone to be free. Updates the minimum sight
         * offset / requirement offset.
         */
        fun updateMinRequirementOffset(offset: Offset<PhysicsPath>) {
            minRequiredOffset = min(minRequiredOffset, offset)
        }

        /**
         * Generate a requirement for the given zone, according to the current simulation state
         * (callbacks). Returns null if the zone isn't yet generating requirements.
         */
        fun generateRequirement(
            zoneId: ZoneId,
            callbacks: IncrementalRequirementCallbacks,
            closedSignalStops: List<PathStop>,
        ): SpacingRequirement? {
            if (minRequiredOffset > callbacks.currentPathOffset) return null
            var beginTime = callbacks.arrivalTimeInRange(minRequiredOffset, Offset(Distance.MAX))
            val simCurrentTime = callbacks.currentTime
            require(beginTime <= simCurrentTime)

            val lastClosedStopBeforeEntryOffset =
                closedSignalStops.lastOrNull { it.pathOffset < zoneEntryOffset }?.pathOffset
            if (lastClosedStopBeforeEntryOffset != null) {
                val stopDepartureTime = callbacks.departureFromStop(lastClosedStopBeforeEntryOffset)
                val minRequirementTime = stopDepartureTime - CLOSED_SIGNAL_RESERVATION_MARGIN
                beginTime = max(minRequirementTime, beginTime)
                if (beginTime > simCurrentTime) return null // after a stop not departed from yet
            }

            var endTime = callbacks.departureTimeFromRange(Offset.zero(), zoneExitOffset)
            var isComplete = true
            if (endTime >= simCurrentTime) {
                endTime = simCurrentTime
                isComplete = callbacks.simulationComplete
            }
            require(beginTime <= endTime)
            return SpacingRequirement(zoneId, beginTime, endTime, isComplete)
        }
    }

    /** Saves some simulation data within one processUpdate call */
    private data class SimulationCacheData(
        val blockIds: List<BlockId>,
        val routeIds: List<RouteId>,
        val context: EnvelopeSimContext?,
    ) {
        val etcsBrakingSimulator by lazy { ETCSBrakingSimulatorImpl(context!!) }
    }
}

// Some basic utils

/** Clear the first elements in order, stop when the predicate isn't met anymore (excluded). */
fun <T> ArrayDeque<T>.removeWhile(f: (T) -> Boolean) {
    while (isNotEmpty() && f(this[0])) {
        removeFirst()
    }
}

fun sortAndMergeRequirements(
    spacingRequirements: List<SpacingRequirement>
): List<SpacingRequirement> {
    val sortedRequirements: List<SpacingRequirement> =
        spacingRequirements.sortedWith(compareBy({ it.zone.index }, { it.beginTime }))
    val resultRequirements = mutableListOf<SpacingRequirement>()
    sortedRequirements.forEach { spacingRequirement ->
        val prevSpacingRequirement = resultRequirements.lastOrNull()
        if (prevSpacingRequirement == null) {
            resultRequirements.add(spacingRequirement)
            return@forEach
        }
        if (
            spacingRequirement.zone == prevSpacingRequirement.zone &&
                spacingRequirement.beginTime <= prevSpacingRequirement.endTime &&
                spacingRequirement.isComplete == prevSpacingRequirement.isComplete
        ) {
            resultRequirements[resultRequirements.size - 1] =
                SpacingRequirement(
                    prevSpacingRequirement.zone,
                    prevSpacingRequirement.beginTime,
                    spacingRequirement.endTime,
                    prevSpacingRequirement.isComplete,
                )
        } else {
            resultRequirements.add(spacingRequirement)
        }
    }
    resultRequirements.sortWith(
        compareBy({ it.beginTime }, { it.endTime }, { it.zone.index }, { it.isComplete })
    )
    return resultRequirements
}
