package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.conflicts.SpacingRequirementAutomaton
import fr.sncf.osrd.conflicts.SpacingRequirements
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeConcat
import fr.sncf.osrd.envelope.EnvelopeConcat.LocatedEnvelopeInterpolate
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.graph.StopTimeData
import fr.sncf.osrd.stdcm.graph.TimeData
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.lang.ref.SoftReference

data class InfraExplorerWithEnvelopeImpl(
    private val infraExplorer: InfraExplorer,
    private val envelopes: AppendOnlyLinkedList<LocatedEnvelopeInterpolate>,
    private val spacingRequirementAutomaton: SpacingRequirementAutomaton,
    private val rollingStock: PhysicsRollingStock,
    private var stopTimeData: List<StopTimeData> = listOf(),

    // Soft references tell the JVM that the values may be cleared when running out of memory
    private var spacingRequirementsCache: SoftReference<List<SpacingRequirement>>? = null,
    private var envelopeCache: SoftReference<EnvelopeInterpolate>? = null,
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead().map { explorer ->
            InfraExplorerWithEnvelopeImpl(
                explorer,
                envelopes.shallowCopy(),
                spacingRequirementAutomaton.clone(),
                rollingStock,
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
        val steps = getStepTracker().getSeenSteps()
        val stopOffsets = steps.filter { it.originalStep.stop }.map { it.travelledPathOffset }
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

    override fun withReplacedEnvelope(envelope: Envelope): InfraExplorerWithEnvelope {
        return copy(
            envelopes = appendOnlyLinkedListOf(LocatedEnvelopeInterpolate(envelope, 0.0, 0.0)),
            spacingRequirementAutomaton =
                SpacingRequirementAutomaton(
                    spacingRequirementAutomaton.rawInfra,
                    spacingRequirementAutomaton.loadedSignalInfra,
                    spacingRequirementAutomaton.blockInfra,
                    spacingRequirementAutomaton.simulator,
                    IncrementalRequirementEnvelopeAdapter(
                        rollingStock,
                        EnvelopeConcat.from(listOf(envelope)),
                        true,
                        endAtStop(),
                    ),
                    getIncrementalPath(),
                ),
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

    override fun interpolateDepartureFromClamp(pathOffset: Offset<TrainPath>): Double {
        return getFullEnvelope().interpolateDepartureFromClamp(pathOffset.meters)
    }

    override fun getSpacingRequirements(): List<SpacingRequirement> {
        val cached = spacingRequirementsCache?.get()
        if (cached != null) return cached
        if (getFullEnvelope().endPos == 0.0) {
            // This case can happen when we start right at the end of a block
            return listOf()
        }
        spacingRequirementAutomaton.incrementalPath = getIncrementalPath()
        // Path is complete and has been completely simulated
        val simulationComplete = getIncrementalPath().pathComplete && getLookahead().size == 0
        spacingRequirementAutomaton.callbacks =
            IncrementalRequirementEnvelopeAdapter(
                rollingStock,
                getFullEnvelope(),
                simulationComplete,
                endAtStop(),
            )
        val updatedRequirements =
            spacingRequirementAutomaton.processPathUpdate() as? SpacingRequirements
                ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
        spacingRequirementsCache = SoftReference(updatedRequirements.requirements)
        return updatedRequirements.requirements
    }

    override fun getFullSpacingRequirements(): List<SpacingRequirement> {
        val simulationComplete = getIncrementalPath().pathComplete && getLookahead().size == 0
        // We need a new automaton to get the resource uses over the whole path, and not just since
        // the last update
        val newAutomaton =
            SpacingRequirementAutomaton(
                spacingRequirementAutomaton.rawInfra,
                spacingRequirementAutomaton.loadedSignalInfra,
                spacingRequirementAutomaton.blockInfra,
                spacingRequirementAutomaton.simulator,
                IncrementalRequirementEnvelopeAdapter(
                    rollingStock,
                    getFullEnvelope(),
                    simulationComplete,
                    endAtStop(),
                ),
                getIncrementalPath(),
            )
        val res =
            newAutomaton.processPathUpdate() as? SpacingRequirements
                ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
        return res.requirements
    }

    override fun moveForward(): InfraExplorerWithEnvelope {
        infraExplorer.moveForward()
        spacingRequirementsCache = null
        return this
    }

    override fun getSimulatedLength(): Length<TravelledPath> {
        if (envelopes.isEmpty()) return Length(0.meters)
        val lastEnvelope = envelopes[envelopes.size - 1]
        return Length(Distance.fromMeters(lastEnvelope.startOffset + lastEnvelope.envelope.endPos))
    }

    override fun clone(): InfraExplorerWithEnvelope {
        return InfraExplorerWithEnvelopeImpl(
            infraExplorer.clone(),
            envelopes.shallowCopy(),
            spacingRequirementAutomaton.clone(),
            rollingStock,
            stopTimeData,
            spacingRequirementsCache,
        )
    }

    override fun endAtStop(): Boolean {
        val steps = getStepTracker().getSeenSteps()
        return steps
            .filter { it.originalStep.stop }
            .any { it.travelledPathOffset == getSimulatedLength() }
    }
}
