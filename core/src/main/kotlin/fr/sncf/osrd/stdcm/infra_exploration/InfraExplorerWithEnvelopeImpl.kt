package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.ConsistSchedule
import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.conflicts.SpacingResourceGenerator
import fr.sncf.osrd.conflicts.extendAutomatonsPath
import fr.sncf.osrd.conflicts.sortAndMergeRequirements
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeConcat
import fr.sncf.osrd.envelope.EnvelopeConcat.LocatedEnvelopeInterpolate
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.BlockLocation
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
    override val forcedOpStops: Set<BlockLocation> = emptySet(),
    private var stopTimeData: List<StopTimeData> = listOf(),
    // Can't be a soft reference: spacingRequirementAutomaton is stateful and only generates new
    // requirements (result would be nothing on second identical call).
    private var spacingRequirementsCache: List<SpacingRequirement>? = null,

    // Soft references tell the JVM that the values may be cleared when running out of memory
    private var envelopeCache: SoftReference<EnvelopeInterpolate>? = null,
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead().map { explorer ->
            InfraExplorerWithEnvelopeImpl(
                explorer,
                envelopes.shallowCopy(),
                spacingRequirementAutomatons.map { it.clone() }.toMutableList(),
                consistSchedule,
                forcedOpStops,
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
        val seenForcedOpStops = getStepTracker().getSeenForcedOpStops()
        val forcedOpStopOffsets =
            seenForcedOpStops.iterateBackwards().map { it.travelledPathOffset }.toList()
        val stopOffsets =
            seenSteps
                .iterateBackwards()
                .filter { it.originalStep.stop }
                .map { it.travelledPathOffset }
                .toList()
                .union(forcedOpStopOffsets)
                .sorted()
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

    /**
     * Returns the range map with rolling stocks used at each point (handling rolling stock
     * changes).
     *
     * Note: it could be cached to avoid repeated calls, but cache invalidation isn't entirely
     * trivial as it needs to happen (at least) when `stepTracker.seenSteps` increases. It could be
     * an future improvement, but we'd need to be careful on tests and measurements.
     */
    override fun getFullRollingStockRangeMap(): DistanceRangeMap<PhysicsRollingStock> {
        var previousStepPos = 0.meters
        return distanceRangeMapOf(
            getStepTracker()
                .getSeenSteps()
                .toList()
                .asSequence()
                .mapIndexedNotNull { stepIndex, step ->
                    if (!step.isPlanned) return@mapIndexedNotNull null
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
                    },
                ),
        )
    }

    override fun getPartialSpacingRequirements(): List<SpacingRequirement> {
        val cached = spacingRequirementsCache
        if (cached != null) return cached
        if (getFullEnvelope().endPos == 0.0) {
            // This case can happen when we start right at the end of a block
            return listOf()
        }

        val startOffset = spacingRequirementAutomatons.last().getCurrentPathEndOffset()
        val backtrackingLocations = infraExplorer.getBacktrackLocationsInRange(startOffset)
        // Generating partial requirement along the building of the path: use (and populate)
        // automatons of the InfraExplorer itself, and generate only what's changed.
        val spacingAutomatons = spacingRequirementAutomatons
        val spacingRequirements =
            getSubPathSpacingRequirements(
                startOffset,
                endOffset = getLookaheadEndOffset(),
                backtrackingLocations,
                spacingAutomatons,
            )
        spacingRequirementsCache = spacingRequirements
        return spacingRequirements
    }

    override fun getFullSpacingRequirements(): List<SpacingRequirement> {
        val startOffset = Offset.zero<PhysicsPath>()
        val backtrackingLocations = infraExplorer.getBacktrackLocationsInRange(startOffset)
        // Since we're generating the full requirements, we need to work on fresh automatons
        // (created on the go).
        val spacingAutomatons = mutableListOf<SpacingResourceGenerator>()
        return getSubPathSpacingRequirements(
            startOffset,
            endOffset = getLookaheadEndOffset(),
            backtrackingLocations,
            spacingAutomatons,
        )
    }

    /** Generate the spacing requirements between [startOffset] and [endOffset]. */
    private fun getSubPathSpacingRequirements(
        startOffset: Offset<PhysicsPath>,
        endOffset: Offset<PhysicsPath>,
        backtrackingLocations: List<Offset<PhysicsPath>>,
        spacingAutomatons: MutableList<SpacingResourceGenerator>,
    ): List<SpacingRequirement> {
        val simulatedEndOffset = Offset<PhysicsPath>(getFullEnvelope().endPos.meters)
        val blocksInRange = infraExplorer.getBlocksInRange(startOffset, endOffset)
        val routesInRange = infraExplorer.getRoutesInRange(startOffset, endOffset)
        val stopsInRange = infraExplorer.getStopsInRange(startOffset, endOffset)
        extendAutomatonsPath(
            spacingAutomatons,
            startOffset,
            endOffset,
            backtrackingLocations,
            referenceAutomaton = spacingRequirementAutomatons.first(),
            blocksInRange,
            routesInRange,
            stopsInRange,
            isPathComplete,
        )
        val spacingRequirements = mutableListOf<SpacingRequirement>()
        for (automatonIdx in spacingAutomatons.indices) {
            // Subpath is complete and has been completely simulated
            val subPathEnd = spacingAutomatons.getOrNull(automatonIdx + 1)?.startOffset ?: endOffset
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
                    ),
                ) ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError(),
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
            forcedOpStops,
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
