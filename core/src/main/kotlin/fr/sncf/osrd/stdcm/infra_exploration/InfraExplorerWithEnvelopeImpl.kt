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
        val cached = spacingRequirementsCache?.get()
        if (cached != null) return cached
        if (getFullEnvelope().endPos == 0.0) {
            // This case can happen when we start right at the end of a block
            return listOf()
        }

        val spacingRequirements = getSpacingRequirements(needFullRequirements = false)
        spacingRequirementsCache = SoftReference(spacingRequirements)
        return spacingRequirements
    }

    override fun getFullSpacingRequirements(): List<SpacingRequirement> {
        return getSpacingRequirements(needFullRequirements = true)
    }

    private fun getSpacingRequirements(needFullRequirements: Boolean): List<SpacingRequirement> {
        val lookaheadEndOffset = getLookaheadEndOffset()
        val start =
            if (needFullRequirements) Offset(0.meters)
            else spacingRequirementAutomatons.last().getCurrentPathEndOffset()
        val backtrackingLocations = infraExplorer.getBacktrackLocationsInRange(start)

        // Split the path so that we generate spacing resources just as if it was a succession of
        // trains ending on a backtracking location/the final destination.
        val subpathExtremities = backtrackingLocations.toMutableList()
        if (backtrackingLocations.firstOrNull() != start) {
            subpathExtremities.addFirst(start)
        }
        if (
            backtrackingLocations.lastOrNull() != lookaheadEndOffset || subpathExtremities.size < 2
        ) {
            subpathExtremities.addLast(lookaheadEndOffset)
        }

        return getSubPathSpacingRequirements(
            subpathExtremities,
            backtrackingLocations,
            needFullRequirements,
        )
    }

    /** Generate either the full or partial spacing requirements of a sub-path. */
    private fun getSubPathSpacingRequirements(
        subpathExtremities: List<Offset<PhysicsPath>>,
        backtrackingLocations: List<Offset<PhysicsPath>>,
        needFullRequirements: Boolean,
    ): List<SpacingRequirement> {
        val referenceAutomaton = spacingRequirementAutomatons.first()
        // Working on fresh automatons (created on the go) if generating full requirements.
        // Otherwise, using (and populating) automatons of the InfraExplorer itself, as they live
        // along the building of the path (and generate only what's changed).
        val spacingAutomatons =
            if (needFullRequirements) mutableListOf() else spacingRequirementAutomatons
        val lookaheadEndOffset = getLookaheadEndOffset()
        val simulatedEndOffset = Offset<PhysicsPath>(getFullEnvelope().endPos.meters)
        for ((subPathBegin, subPathEnd) in subpathExtremities.zipWithNext()) {
            val blockRanges =
                infraExplorer.getBlocksInRange(subPathBegin, subPathEnd).toMutableList()
            if (blockRanges.size > 1 && blockRanges.first().length == 0.meters) {
                blockRanges.removeFirst()
            }
            if (blockRanges.size > 1 && blockRanges.last().length == 0.meters) {
                blockRanges.removeLast()
            }
            val routeRanges =
                infraExplorer.getRoutesInRange(subPathBegin, subPathEnd).toMutableList()
            if (routeRanges.size > 1 && routeRanges.first().length == 0.meters) {
                routeRanges.removeFirst()
            }
            if (routeRanges.size > 1 && routeRanges.last().length == 0.meters) {
                routeRanges.removeLast()
            }

            val spacingRequirementAutomaton =
                if (
                    subPathBegin == Offset.zero<PhysicsPath>() ||
                        subPathBegin in backtrackingLocations
                ) {
                    // There should either be an existing automaton starting at this offset OR
                    // we need to create one.
                    val subSpacingAutomaton = spacingAutomatons.lastOrNull {
                        it.startOffset == subPathBegin
                    }
                    if (subSpacingAutomaton != null) subSpacingAutomaton
                    else {
                        val lastAutomatonStartOffset =
                            spacingAutomatons.lastOrNull()?.startOffset
                                ?: Offset(Int.MIN_VALUE.meters)
                        require(lastAutomatonStartOffset < subPathBegin)
                        spacingAutomatons.add(
                            SpacingResourceGenerator(
                                referenceAutomaton.rawInfra,
                                referenceAutomaton.blockInfra,
                                referenceAutomaton.loadedSignalInfra,
                                referenceAutomaton.simulator,
                                subPathBegin,
                                referenceAutomaton.context,
                            )
                        )
                        spacingAutomatons.last()
                    }
                } else {
                    // Nominal case: we take the last automaton starting before the
                    // subPathBegin, and it SHOULD exist.
                    spacingAutomatons.last {
                        it.startOffset <= subPathBegin && it.startOffset < subPathEnd
                    }
                }
            val endsAtDifferentBacktracking =
                (subPathEnd in backtrackingLocations) &&
                    subPathEnd != spacingRequirementAutomaton.startOffset
            val endsAtDestination = isPathComplete && (subPathEnd == lookaheadEndOffset)
            val isSubpathComplete = endsAtDifferentBacktracking || endsAtDestination
            spacingRequirementAutomaton.extendPath(
                blockRanges,
                routeRanges,
                infraExplorer.getStopsInRange(subPathBegin, subPathEnd),
                isSubpathComplete,
            )
        }
        val spacingRequirements = mutableListOf<SpacingRequirement>()
        for (automatonIdx in spacingAutomatons.indices) {
            // Subpath is complete and has been completely simulated
            val subPathEnd =
                spacingAutomatons.getOrNull(automatonIdx + 1)?.startOffset
                    ?: subpathExtremities.last()
            val endsAtBacktracking = automatonIdx < spacingAutomatons.size - 1
            val subSimulationComplete =
                (endsAtBacktracking && subPathEnd <= simulatedEndOffset) ||
                    (isPathComplete && getLookahead().isEmpty())
            spacingRequirements.addAll(
                spacingAutomatons[automatonIdx].processUpdate(
                    IncrementalRequirementEnvelopeAdapter(
                        getFullRollingStockRangeMap(),
                        getFullEnvelope(),
                        subSimulationComplete,
                        currentPathOffset = Offset.min(subPathEnd, simulatedEndOffset),
                        infiniteLastStop = endsAtBacktracking || endAtStop(),
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
