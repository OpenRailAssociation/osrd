package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.etcs.BrakingType.IND
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulator
import fr.sncf.osrd.envelope_sim.etcs.ETCSBrakingSimulatorImpl
import fr.sncf.osrd.envelope_sim.etcs.EoaType
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.ZoneRange
import fr.sncf.osrd.path.interfaces.addLinearObjects
import fr.sncf.osrd.path.interfaces.mapPointObjects
import fr.sncf.osrd.path.interfaces.mapSubObjects
import fr.sncf.osrd.path.interfaces.subRange
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.signaling.SignalingSimulator
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.signaling.ZoneStatus
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Zone
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.sim_infra.api.getZonePathZone
import fr.sncf.osrd.standalone_sim.CLOSED_SIGNAL_RESERVATION_MARGIN
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.metersPerSecond
import fr.sncf.osrd.utils.units.toOffset
import kotlin.collections.iterator
import kotlin.math.max
import kotlin.math.min
import mu.KotlinLogging

val logger = KotlinLogging.logger {}

data class PathStop(
    val pathOffset: Offset<TrainPath>,
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
 */
data class SpacingResourceGenerator(
    val rawInfra: RawInfra,
    val blockInfra: BlockInfra,
    val loadedSignalInfra: LoadedSignalInfra,
    val simulator: SignalingSimulator,
    // TODO: Required for ETCS (STDCM doesn't provide it currently, will have to eventually)
    val context: EnvelopeSimContext? = null,
    var callbacks: IncrementalRequirementCallbacks? = null,
) {

    // We only keep a small part of the path (from the current train head to the end of the
    // lookahead section). Which makes it OK to copy the lists when the path branches.
    // NOTE: any field added here needs to be added to `clone`, and needs to be trimmed when the
    // train moves past the given objects.
    private val blockRanges = ArrayDeque<BlockRange>()
    private val routeRanges = ArrayDeque<RouteRange>()
    private val zoneRanges = ArrayDeque<ZoneRange>()
    private val stops = ArrayDeque<PathStop>()
    private val pendingSignals = ArrayDeque<PendingSignalData>()
    private val ongoingZoneRequirements = mutableMapOf<ZoneId, OngoingZoneRequirement>()

    private var isPathComplete: Boolean = false
    private var etcsSimulator: ETCSBrakingSimulator? = null

    /**
     * Add a new segment of the path. The ranges should cover the same range of `Offset<TrainPath`,
     * and any stop in that range needs to be listed.
     */
    fun extendPath(
        newBlockRanges: List<BlockRange>,
        newRouteRanges: List<RouteRange>,
        newStops: List<PathStop>,
        isPathComplete: Boolean,
    ) {
        // Some assertions on the inputs
        val previousPathEnd = blockRanges.lastOrNull()?.pathEnd ?: Offset.zero()
        val newPathEnd = newBlockRanges.last().pathEnd
        val emptyPathExtension = previousPathEnd == newPathEnd
        assert(!this.isPathComplete || emptyPathExtension)
        assert(newBlockRanges[0].pathBegin == previousPathEnd)
        assert(newRouteRanges[0].pathBegin == previousPathEnd)
        assert(newPathEnd == newRouteRanges.last().pathEnd)
        assert(newStops.all { it.pathOffset in previousPathEnd..newPathEnd })

        this.isPathComplete = isPathComplete
        if (emptyPathExtension) return

        val newZoneRanges =
            newBlockRanges
                .mapSubObjects(blockInfra::getBlockZonePaths, rawInfra::getZonePathLength)
                .map { it.mapValue<ZoneId, Zone>(rawInfra.getZonePathZone(it.value)) }
        assert(newPathEnd == newZoneRanges.last().pathEnd)

        if (previousPathEnd == Offset.zero<TrainPath>()) {
            // We only need to explicitly register zones if they're before the first signal
            for (zoneRange in newZoneRanges) {
                ongoingZoneRequirements.getOrPut(zoneRange.value) {
                    OngoingZoneRequirement(zoneRange.pathBegin, zoneRange.pathEnd)
                }
            }
        }

        blockRanges.addLinearObjects(newBlockRanges)
        routeRanges.addLinearObjects(newRouteRanges)
        zoneRanges.addLinearObjects(newZoneRanges)
        stops.addAll(newStops.filter { it.receptionSignal.isStopOnClosedSignal })
        val signals =
            newBlockRanges.mapPointObjects(
                blockInfra::getBlockSignals,
                blockInfra::getSignalsPositions,
            )
        for ((signal, pathOffset) in signals) {
            if (pendingSignals.lastOrNull()?.signal == signal)
                continue // block transition signals are listed on either block
            val physicalSignal = loadedSignalInfra.getPhysicalSignal(signal)
            val sightDistance = rawInfra.getSignalSightDistance(physicalSignal)
            val sightOffset = max(Offset.zero(), pathOffset - sightDistance)
            val sigSystemId = loadedSignalInfra.getSignalingSystem(signal)
            val isCurveBased = simulator.sigModuleManager.isCurveBased(sigSystemId)
            pendingSignals.add(PendingSignalData(signal, pathOffset, sightOffset, isCurveBased))
        }
        etcsSimulator = null // Resets ETCS cache (as it contains the path)
    }

    /** Update the simulation with new time/speed callbacks. */
    fun updateCallbacks(newCallbacks: IncrementalRequirementCallbacks): SpacingResourceGenerator {
        callbacks = newCallbacks
        return this
    }

    /**
     * Processes all the changes since last call. Returns null if the path is not long enough.
     *
     * Returns all requirements that are either new or were not complete at last call.
     */
    fun processUpdate(): List<SpacingRequirement>? {
        if (isLookaheadTooSmall()) return null
        val simulatedLength = callbacks!!.currentPathOffset
        val signalsToProcess = pendingSignals.takeWhile { it.sightOffset <= simulatedLength }
        val endOffsets = mutableMapOf<LogicalSignalId, Offset<TrainPath>>()
        for (signal in signalsToProcess.asReversed()) {
            // Reversing the list starts with the most likely to fail
            endOffsets[signal.signal] = getRequirementEndOffset(signal) ?: return null
        }

        for (signal in signalsToProcess) {
            pendingSignals.removeFirst()
            signalToOngoingRequirements(signal, endOffsets[signal.signal]!!)
        }

        val minRelevantPathOffset = pendingSignals.minOfOrNull { it.sightOffset } ?: simulatedLength
        blockRanges.removeWhile { it.pathEnd < minRelevantPathOffset }
        routeRanges.removeWhile { it.pathEnd < minRelevantPathOffset }
        zoneRanges.removeWhile { it.pathEnd < minRelevantPathOffset }

        return yieldCurrentRequirements()
    }

    /** Clone all the underlying values. Can be used to explore branching paths. */
    fun clone(): SpacingResourceGenerator {
        val res =
            SpacingResourceGenerator(
                rawInfra,
                blockInfra,
                loadedSignalInfra,
                simulator,
                context,
                callbacks,
            )
        res.blockRanges.addAll(blockRanges)
        res.routeRanges.addAll(routeRanges)
        res.zoneRanges.addAll(zoneRanges)
        res.stops.addAll(stops)
        res.pendingSignals.addAll(pendingSignals)
        res.isPathComplete = isPathComplete
        res.etcsSimulator = etcsSimulator
        for ((zone, data) in ongoingZoneRequirements) res.ongoingZoneRequirements[zone] =
            data.copy()
        return res
    }

    /** Returns the current end of the processed path. */
    fun getCurrentPathEndOffset(): Offset<TrainPath> {
        return blockRanges.lastOrNull()?.pathEnd ?: Offset.zero()
    }

    /**
     * First check on the lookahead length: ensures that it's long enough to cover any possible
     * visible signal.
     */
    private fun isLookaheadTooSmall(): Boolean {
        val callbacks = callbacks!!
        if (callbacks.simulationComplete || isPathComplete) return false
        val simulatedLength = callbacks.currentPathOffset
        val pathLength = blockRanges.lastOrNull()?.pathEnd ?: Offset.zero()
        val signalCanBeVisibleAfterLookahead =
            pathLength - simulatedLength < rawInfra.getLongestSightDistance()
        return signalCanBeVisibleAfterLookahead
    }

    /**
     * Processes a signal from the pending signal map. Sets values in the "ongoing requirement"
     * maps.
     *
     * End offsets are known at this point, so the path is long enough.
     */
    private fun signalToOngoingRequirements(
        signalData: PendingSignalData,
        endOffset: Offset<TrainPath>,
    ) {
        val zoneRanges =
            zoneRanges.subRange(signalData.offset, endOffset).filter { !it.isSinglePoint() }
        val requiredOffset =
            if (signalData.isCurveBased) getETCSFirstRequiredOffset(signalData)
            else signalData.sightOffset

        for (zoneRange in zoneRanges) {
            assert(requiredOffset <= zoneRange.pathBegin)
            val ongoingRequirementData =
                ongoingZoneRequirements.getOrPut(zoneRange.value) {
                    OngoingZoneRequirement(zoneRange.pathBegin, zoneRange.pathEnd)
                }
            ongoingRequirementData.updateMinRequirementOffset(requiredOffset)
        }
    }

    /** Returns the offset at which the ETCS "signal" can slow the train down. */
    private fun getETCSFirstRequiredOffset(signalData: PendingSignalData): Offset<TrainPath> {
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
        val envelope = callbacks!!.getRawEnvelopeIfSingle()
        // TODO: stop using a single envelope that's unavailable in STDCM and maybe move to a
        //   dedicated EnvelopeTimeInterpolate.getIntersection().
        //   Then probably protect its failure by returning
        //   SignalRequirementsCreationStatus.NOT_SEEN_IN_AVAILABLE_SIM.
        assert(envelope != null) {
            "A single envelope covering whole path is currently expected (used only through standalone simulation)"
        }

        val etcsSimulator = getETCSSimulator()
        val eoa =
            etcsSimulator
                .computeEoaLocations(
                    envelope!!,
                    listOf(signalData.offset),
                    listOf(isRouteDelimiter),
                    EoaType.SPACING,
                )
                .first()
        val curvesList = etcsSimulator.computeStopBrakingCurves(envelope, listOf(eoa))

        assert(curvesList.size == 1)
        return curvesList[eoa]!![IND]?.brakingCurve?.beginPos?.toOffset() ?: eoa.offsetEOA
    }

    /** Generates all ongoing requirements. Discards zones that have been cleared. */
    private fun yieldCurrentRequirements(): List<SpacingRequirement> {
        val callbacks = callbacks!!
        val res = mutableListOf<SpacingRequirement>()
        for ((zone, ongoingRequirementData) in ongoingZoneRequirements) {
            val requirement = ongoingRequirementData.generateRequirement(zone, callbacks, stops)
            if (requirement != null) res.add(requirement)
        }
        for (requirement in res) { // Avoid modifying while iterating
            if (requirement.isComplete) ongoingZoneRequirements.remove(requirement.zone)
        }
        stops.removeWhile { it.pathOffset < callbacks.currentPathOffset }
        return res
    }

    /**
     * Generate the `SignalingTrainState` for the given signal, using the speed range up to the next
     * signal.
     */
    private fun buildTrainState(signalData: PendingSignalData): SignalingTrainState? {
        val callbacks = callbacks!!
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
    private fun getRequirementEndOffset(signalData: PendingSignalData): Offset<TrainPath>? {
        if (signalData.isCurveBased)
            return blockRanges.first { it.pathBegin >= signalData.offset }.pathEnd
        val trainState = buildTrainState(signalData) ?: return null
        // Check if more path is needed for a valid solution
        // (i.e. the zone after the end of the path is still required)
        val lastZoneIndex = zoneRanges.lastIndex + 1
        if (!isPathComplete) {
            if (
                isZoneIndexRequiredForSignal(lastZoneIndex, signalData.signal, trainState) != false
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
        val initialUpperBound = min(lowerBound + 40, lastZoneIndex)
        var upperBound = initialUpperBound

        // Main loop, binary search
        while (true) {
            if (lowerBound == upperBound) break
            val probedZoneIndex = (upperBound + lowerBound) / 2
            val required =
                isZoneIndexRequiredForSignal(probedZoneIndex, signalData.signal, trainState)!!
            if (required) {
                lowerBound = probedZoneIndex + 1
            } else {
                upperBound = probedZoneIndex
            }
        }

        // Handle the case where the result is higher than the initial upper bound
        while (
            lowerBound in initialUpperBound..<lastZoneIndex &&
                isZoneIndexRequiredForSignal(lowerBound, signalData.signal, trainState)!!
        ) lowerBound++
        val firstNonRequiredZoneIndex = lowerBound
        return zoneRanges[firstNonRequiredZoneIndex - 1].pathEnd
    }

    /**
     * * Returns true if the zone is required to be clear for the signal to not be constraining.
     * * Returns false if it's not required.
     * * Returns null if we need a longer path to tell.
     */
    private fun isZoneIndexRequiredForSignal(
        probedZoneIndex: Int,
        signal: LogicalSignalId,
        trainState: SignalingTrainState,
    ): Boolean? {
        if (probedZoneIndex > zoneRanges.size) return null

        // TODO path migration: when we'll have backtracks:
        //  truncate at backtrack locations, and avoid "more path required"
        val blocks = blockRanges.map { it.value }

        val zoneStates = MutableList(zoneRanges.size) { ZoneStatus.CLEAR }
        if (probedZoneIndex < zoneStates.size) {
            zoneStates[probedZoneIndex] = ZoneStatus.OCCUPIED
        } // Otherwise we rely on the `followingZoneState` of `simulator.evaluate`
        val simulatedSignalStates =
            simulator.evaluate(
                rawInfra,
                loadedSignalInfra,
                blockInfra,
                blocks,
                routeRanges.map { it.value },
                blocks.size,
                zoneStates,
                ZoneStatus.OCCUPIED,
                firstZone = zoneRanges.first().value,
            )
        val signalState = simulatedSignalStates[signal]!!

        return simulator.sigModuleManager.isConstraining(
            loadedSignalInfra.getSignalingSystem(signal),
            signalState,
            trainState,
        )
    }

    /**
     * Return the ETCS simulator and cache it (until the next path extension). Only works if context
     * is provided.
     */
    private fun getETCSSimulator(): ETCSBrakingSimulator {
        val res = etcsSimulator ?: ETCSBrakingSimulatorImpl(context!!)
        etcsSimulator = res
        return res
    }

    /** Keeps track of relevant data for any signal on the path (but not yet cleared). */
    private data class PendingSignalData(
        /** ID of the logical signal */
        val signal: LogicalSignalId,
        /** Offset of the signal itself */
        val offset: Offset<TrainPath>,
        /** Offset at which the signal is seen by the train */
        val sightOffset: Offset<TrainPath>,
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
         */
        val zoneEntryOffset: Offset<TrainPath>,
        /** Offset where the train clears the zone. Does not consider the train length. */
        val zoneExitOffset: Offset<TrainPath>,
        /** The train first needs this zone to be free when the head reaches this offset. */
        var minRequiredOffset: Offset<TrainPath> = zoneEntryOffset,

        // When debugging requirements locally, this class can be patched to keep track of which
        // signal updated it. It can also be referenced in the generated [SpacingRequirement]. This
        // code *could* be commited with nullable fields, but it would add a small overhead even
        // when not debugging. TODO: discuss this in the PR
    ) {
        /**
         * To be called when a signal requires this zone to be free. Updates the minimum sight
         * offset / requirement offset.
         */
        fun updateMinRequirementOffset(offset: Offset<TrainPath>) {
            minRequiredOffset = min(minRequiredOffset, offset)
        }

        /**
         * Generate a requirement for the given zone, according to the current simulation state
         * (callbacks). Returns null if the zone isn't yet generating requirements.
         */
        fun generateRequirement(
            zoneId: ZoneId,
            callbacks: IncrementalRequirementCallbacks,
            stops: List<PathStop>,
        ): SpacingRequirement? {
            if (minRequiredOffset > callbacks.currentPathOffset) return null
            var beginTime = callbacks.arrivalTimeInRange(minRequiredOffset, Offset(Distance.MAX))
            val simCurrentTime = callbacks.currentTime
            assert(beginTime <= simCurrentTime)

            val lastPreviousStopOffset =
                stops.lastOrNull { it.pathOffset < zoneEntryOffset }?.pathOffset
            if (lastPreviousStopOffset != null) {
                val departureTime = callbacks.departureFromStop(lastPreviousStopOffset)
                val minRequirementTime = departureTime - CLOSED_SIGNAL_RESERVATION_MARGIN
                beginTime = max(minRequirementTime, beginTime)
                if (beginTime > simCurrentTime) return null // after a stop not departed from yet
            }

            var endTime = callbacks.departureTimeFromRange(Offset.zero(), zoneExitOffset)
            var isComplete = true
            if (endTime >= simCurrentTime) {
                endTime = simCurrentTime
                isComplete = callbacks.simulationComplete
            }
            assert(beginTime <= endTime)
            return SpacingRequirement(zoneId, beginTime, endTime, isComplete)
        }
    }
}

// Some basic utils

/** Clear the first elements in order, stop when the predicate isn't met anymore (excluded). */
fun <T> ArrayDeque<T>.removeWhile(f: (T) -> Boolean) {
    while (isNotEmpty() && f(this[0])) {
        removeFirst()
    }
}
