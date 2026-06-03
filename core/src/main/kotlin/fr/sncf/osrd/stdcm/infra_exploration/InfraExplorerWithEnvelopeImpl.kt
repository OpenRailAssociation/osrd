package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.ConsistSchedule
import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.conflicts.SpacingResourceGenerator
import fr.sncf.osrd.conflicts.sortAndMergeRequirements
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeConcat
import fr.sncf.osrd.envelope.EnvelopeConcat.LocatedEnvelopeInterpolate
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.graph.StopTimeData
import fr.sncf.osrd.stdcm.graph.TimeData
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.lang.ref.SoftReference

data class InfraExplorerWithEnvelopeImpl(
    private val infraExplorer: InfraExplorer,
    private val envelopes: AppendOnlyLinkedList<LocatedEnvelopeInterpolate>,
    private val spacingRequirementAutomatons: MutableList<SpacingResourceGenerator>,
    private val consistSchedule: ConsistSchedule,
    private var stopTimeData: List<StopTimeData> = listOf(),

    // Soft references tell the JVM that the values may be cleared when running out of memory
    private var spacingRequirementsCache: SoftReference<List<SpacingRequirement>>? = null,
    private var envelopeCache: SoftReference<EnvelopeInterpolate>? = null,
    private var rollingStockRangeMapCache: SoftReference<DistanceRangeMap<PhysicsRollingStock>>? =
        null,
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead().map { explorer ->
            InfraExplorerWithEnvelopeImpl(
                explorer,
                envelopes.shallowCopy(),
                spacingRequirementAutomatons.map { it.clone() }.toMutableList(),
                consistSchedule,
                stopTimeData,
                spacingRequirementsCache,
            )
        }
    }

    override fun getFullEnvelope(): EnvelopeInterpolate {
        val cached = envelopeCache?.get()
        if (cached != null) return cached
        val res = EnvelopeConcat.fromLocated(envelopes.toList())
        val withStops = EnvelopeStopWrapper(res, generateReachedTrainStops())
        envelopeCache = SoftReference(withStops)
        return withStops
    }

    override fun generateReachedTrainStops(): List<TrainStop> {
        val seenSteps = getStepTracker().getSeenSteps()
        val stopOffsets =
            seenSteps
                .iterateBackwards()
                .filter { it.originalStep.stop }
                .map { it.travelledPathOffset }
                .toList()
                .reversed()
        val stopDurations = stopTimeData.map { it.currentDuration }

        // Stop offsets include the lookahead while stop durations doesn't.
        // We want the intersection, which is what `zip` does here.
        assert(stopDurations.size <= stopOffsets.size)
        return (stopOffsets zip stopDurations).map {
            TrainStop(it.first.meters, it.second, SHORT_SLIP_STOP)
        }
    }

    override fun addEnvelope(envelope: Envelope): InfraExplorerWithEnvelope {
        var prevEndOffset = 0.0
        var prevEndTime = 0.0
        if (envelopes.isNotEmpty()) {
            val lastEnvelope = envelopes[envelopes.size - 1]
            prevEndTime = lastEnvelope.startTime + lastEnvelope.envelope.totalTime
            prevEndOffset = lastEnvelope.startOffset + lastEnvelope.envelope.endPos
        }
        envelopes.add(LocatedEnvelopeInterpolate(envelope, prevEndOffset, prevEndTime))
        envelopeCache = null
        spacingRequirementsCache = null
        return this
    }

    override fun getCurrentRollingStock(): PhysicsRollingStock {
        val currentStepIndex = infraExplorer.getStepTracker().getCurrentReachedPlannedStepIndex()
        return consistSchedule.rollingStocks[currentStepIndex]
    }

    override fun withReplacedEnvelope(envelope: Envelope): InfraExplorerWithEnvelope {
        return copy(
            envelopes = appendOnlyLinkedListOf(LocatedEnvelopeInterpolate(envelope, 0.0, 0.0)),
            spacingRequirementAutomatons =
                spacingRequirementAutomatons.map { it.clone() }.toMutableList(),
            spacingRequirementsCache = null,
            envelopeCache = null,
        )
    }

    override fun updateTimeData(updatedTimeData: TimeData): InfraExplorerWithEnvelope {
        stopTimeData = updatedTimeData.stopTimeData
        envelopeCache = null
        spacingRequirementsCache = null
        return this
    }

    override fun interpolateDepartureFromClamp(pathOffset: Offset<PhysicsPath>): Double {
        return getFullEnvelope().interpolateDepartureFromClamp(pathOffset.meters)
    }

    override fun getFullRollingStockRangeMap(): DistanceRangeMap<PhysicsRollingStock> {
        val cache = rollingStockRangeMapCache?.get()
        if (cache != null) return cache
        var previousStepPos = 0.meters
        return distanceRangeMapOf(
            getStepTracker()
                .getSeenSteps()
                .toList()
                .asSequence()
                .filter { it.isPlanned }
                .withIndex()
                .map { (stepIndex, step) ->
                    val rollingStock: PhysicsRollingStock = consistSchedule.rollingStocks[stepIndex]
                    val stepPos = step.travelledPathOffset.distance
                    val res = DistanceRangeMap.RangeMapEntry(previousStepPos, stepPos, rollingStock)
                    previousStepPos = step.travelledPathOffset.distance
                    res
                }
                .plus(
                    run {
                        val lastStep =
                            getStepTracker().iterateSeenStepsBackwards().firstOrNull {
                                it.isPlanned
                            }
                        val rollingStock = getCurrentRollingStock()
                        val lookaheadEndOffset = getAllBlocks().last().pathEnd.distance
                        DistanceRangeMap.RangeMapEntry(
                            lastStep?.travelledPathOffset?.distance ?: 0.meters,
                            lookaheadEndOffset,
                            rollingStock,
                        )
                    }
                )
        )
    }

    override fun getSpacingRequirements(): List<SpacingRequirement> {
        // TODO: Remove once spacing requirements are fixed for paths with backtrackings.
        if (getBacktrackLocationsInRange().isNotEmpty()) return listOf()
        val cached = spacingRequirementsCache?.get()
        if (cached != null) return cached
        if (getFullEnvelope().endPos == 0.0) {
            // This case can happen when we start right at the end of a block
            return listOf()
        }
        val lookaheadEndOffset = getLookaheadEndOffset()
        val nextBacktracking =
            infraExplorer
                .getStepTracker()
                .iterateSeenStepsBackwards()
                .takeWhile { it.travelledPathOffset >= lookaheadEndOffset }
                .lastOrNull { it.isBacktracking }
                ?.travelledPathOffset ?: Offset(Double.POSITIVE_INFINITY.meters)
        val cappedSimulatedOffset = Offset<PhysicsPath>(getFullEnvelope().endPos.meters)
        //            Offset.min(Offset(getFullEnvelope().endPos.meters), nextBacktracking)

        val lastPathEndOffset = spacingRequirementAutomatons.last().getCurrentPathEndOffset()

        // Generate spacing resources just as if a succession of trains (splitting on backtracking)
        val updatedRequirements = mutableListOf<SpacingRequirement>()
        val backtrackingLocations = infraExplorer.getBacktrackLocationsInRange(lastPathEndOffset)

        val subpathExtremities = backtrackingLocations.toMutableList()
        if (backtrackingLocations.firstOrNull() != lastPathEndOffset) {
            subpathExtremities.addFirst(lastPathEndOffset)
        }
        if (
            backtrackingLocations.lastOrNull() != lookaheadEndOffset && subpathExtremities.size < 2
        ) {
            subpathExtremities.addLast(lookaheadEndOffset)
        }

        for ((subpathBegin, subpathEnd) in subpathExtremities.zipWithNext()) {
            val endAtBacktracking = (subpathEnd in backtrackingLocations)
            val isSubpathComplete = if (endAtBacktracking) true else isPathComplete
            val blockRanges =
                infraExplorer.getBlocksInRange(subpathBegin, subpathEnd).toMutableList()
            if (blockRanges.size > 1 && blockRanges.first().length == 0.meters) {
                blockRanges.removeFirst()
            }
            if (blockRanges.size > 1 && blockRanges.last().length == 0.meters) {
                blockRanges.removeLast()
            }
            val routeRanges =
                infraExplorer.getRoutesInRange(subpathBegin, subpathEnd).toMutableList()
            if (routeRanges.size > 1 && routeRanges.first().length == 0.meters) {
                routeRanges.removeFirst()
            }
            if (routeRanges.size > 1 && routeRanges.last().length == 0.meters) {
                routeRanges.removeLast()
            }

            val spacingRequirementAutomaton =
                if (subpathBegin in backtrackingLocations) {
                    val subSpacingAutomaton =
                        spacingRequirementAutomatons
                            .asReversed()
                            .asSequence()
                            .takeWhile { it.startOffset >= subpathBegin }
                            .firstOrNull { it.startOffset == subpathBegin }
                    if (subSpacingAutomaton != null) subSpacingAutomaton
                    else {
                        require(spacingRequirementAutomatons.last().startOffset < subpathBegin)
                        val firstAutomaton = spacingRequirementAutomatons.first()
                        spacingRequirementAutomatons.add(
                            SpacingResourceGenerator(
                                firstAutomaton.rawInfra,
                                firstAutomaton.blockInfra,
                                firstAutomaton.loadedSignalInfra,
                                firstAutomaton.simulator,
                                subpathBegin,
                                firstAutomaton.context,
                            )
                        )
                        spacingRequirementAutomatons.last()
                    }
                } else {
                    spacingRequirementAutomatons.asReversed().first {
                        it.startOffset <= subpathBegin
                    }
                }

            spacingRequirementAutomaton.extendPath(
                blockRanges,
                routeRanges,
                infraExplorer.getStopsInRange(subpathBegin, subpathEnd),
                isSubpathComplete,
            )
            // Subpath is complete and has been completely simulated
            val subSimulationComplete =
                (endAtBacktracking && subpathEnd == cappedSimulatedOffset) ||
                    (isPathComplete && getLookahead().isEmpty())
            val spacingRequirementAutomatonCallbacks =
                IncrementalRequirementEnvelopeAdapter(
                    getFullRollingStockRangeMap(),
                    getFullEnvelope(),
                    subSimulationComplete,
                    if (endAtBacktracking) Offset.min(subpathEnd, cappedSimulatedOffset)
                    else cappedSimulatedOffset,
                    endAtBacktracking || endAtStop(),
                )
            updatedRequirements.addAll(
                spacingRequirementAutomaton.processUpdate(spacingRequirementAutomatonCallbacks)
                    ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
            )
        }
        val res = sortAndMergeRequirements(updatedRequirements)
        spacingRequirementsCache = SoftReference(res)
        return res
    }

    override fun getFullSpacingRequirements(): List<SpacingRequirement> {
        val spacingRequirements = mutableListOf<SpacingRequirement>()

        val lookaheadEndOffset = getLookaheadEndOffset()
        val nextBacktracking =
            infraExplorer
                .getStepTracker()
                .iterateSeenStepsBackwards()
                .takeWhile { it.travelledPathOffset >= lookaheadEndOffset }
                .lastOrNull { it.isBacktracking }
                ?.travelledPathOffset ?: Offset(Double.POSITIVE_INFINITY.meters)
        val cappedSimulatedOffset = Offset<PhysicsPath>(getFullEnvelope().endPos.meters)
        //            Offset.min(Offset(getFullEnvelope().endPos.meters), nextBacktracking)

        // We need a new automaton to get the resource uses over the whole path, and not just since
        // the last update
        val firstAutomaton = spacingRequirementAutomatons.first()

        val backtrackingLocations = infraExplorer.getBacktrackLocationsInRange()

        val subpathExtremities = mutableListOf(Offset<PhysicsPath>(0.meters))
        subpathExtremities.addAll(backtrackingLocations)
        if (backtrackingLocations.lastOrNull() != lookaheadEndOffset)
            subpathExtremities.addLast(lookaheadEndOffset)

        for ((subpathBegin, subpathEnd) in subpathExtremities.zipWithNext()) {
            val endAtBacktracking = (subpathEnd in backtrackingLocations)
            val isSubpathComplete = if (endAtBacktracking) true else isPathComplete
            val subSimulationComplete =
                (endAtBacktracking && subpathEnd == cappedSimulatedOffset) ||
                    (isPathComplete && getLookahead().isEmpty())

            val blockRanges =
                infraExplorer.getBlocksInRange(subpathBegin, subpathEnd).toMutableList()
            if (blockRanges.size > 1 && blockRanges.first().length == 0.meters) {
                blockRanges.removeFirst()
            }
            if (blockRanges.size > 1 && blockRanges.last().length == 0.meters) {
                blockRanges.removeLast()
            }
            val routeRanges =
                infraExplorer.getRoutesInRange(subpathBegin, subpathEnd).toMutableList()
            if (routeRanges.size > 1 && routeRanges.first().length == 0.meters) {
                routeRanges.removeFirst()
            }
            if (routeRanges.size > 1 && routeRanges.last().length == 0.meters) {
                routeRanges.removeLast()
            }

            val newAutomaton =
                SpacingResourceGenerator(
                    firstAutomaton.rawInfra,
                    firstAutomaton.blockInfra,
                    firstAutomaton.loadedSignalInfra,
                    firstAutomaton.simulator,
                    subpathBegin,
                    firstAutomaton.context,
                )
            newAutomaton.extendPath(
                blockRanges,
                routeRanges,
                infraExplorer.getStopsInRange(subpathBegin, subpathEnd),
                isSubpathComplete,
            )
            spacingRequirements.addAll(
                newAutomaton.processUpdate(
                    IncrementalRequirementEnvelopeAdapter(
                        getFullRollingStockRangeMap(),
                        getFullEnvelope(),
                        subSimulationComplete,
                        if (endAtBacktracking) Offset.min(subpathEnd, cappedSimulatedOffset)
                        else cappedSimulatedOffset,
                        endAtBacktracking || endAtStop(),
                    )
                ) ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
            )
        }

        return sortAndMergeRequirements(spacingRequirements)
    }

    override fun moveForward(): InfraExplorerWithEnvelope {
        infraExplorer.moveForward()
        spacingRequirementsCache = null
        return this
    }

    override fun getSimulatedLength(): Length<PhysicsPath> {
        if (envelopes.isEmpty()) return Length(0.meters)
        val lastEnvelope = envelopes[envelopes.size - 1]
        return Length(Distance.fromMeters(lastEnvelope.startOffset + lastEnvelope.envelope.endPos))
    }

    override fun clone(): InfraExplorerWithEnvelope {
        return InfraExplorerWithEnvelopeImpl(
            infraExplorer.clone(),
            envelopes.shallowCopy(),
            spacingRequirementAutomatons.map { it.clone() }.toMutableList(),
            consistSchedule,
            stopTimeData,
            spacingRequirementsCache,
        )
    }

    override fun endAtStop(): Boolean {
        val seenSteps = getStepTracker().getSeenSteps()
        return seenSteps
            .iterateBackwards()
            .filter { it.originalStep.stop }
            .any { it.travelledPathOffset == getSimulatedLength() }
    }

    override fun toString(): String {
        return "InfraExplorerWithEnvelopeImpl(infraExplorer=$infraExplorer)"
    }
}
