package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirementAutomaton
import fr.sncf.osrd.conflicts.SpacingRequirements
import fr.sncf.osrd.envelope.EnvelopeConcat
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

data class InfraExplorerWithEnvelopeImpl(
    private val infraExplorer: InfraExplorer,
    private val envelopes: MutableList<EnvelopeTimeInterpolate>,
    private val spacingRequirementAutomaton: SpacingRequirementAutomaton,
    private val rollingStock: PhysicsRollingStock,
    private var spacingRequirementsCache: List<SpacingRequirement>? = null
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead().map { explorer ->
            InfraExplorerWithEnvelopeImpl(
                explorer,
                ArrayList(envelopes),
                spacingRequirementAutomaton.clone(),
                rollingStock,
                spacingRequirementsCache?.toList(),
            )
        }
    }

    override fun getFullEnvelope(): EnvelopeTimeInterpolate {
        return EnvelopeConcat.from(envelopes)
    }

    override fun addEnvelope(envelope: EnvelopeTimeInterpolate): InfraExplorerWithEnvelope {
        sanityChecks()
        envelopes.add(envelope)
        sanityChecks()
        return this
    }

    override fun interpolateTimeClamp(pathOffset: Offset<Path>): Double {
        return getFullEnvelope()
            .interpolateTotalTimeClamp(
                getIncrementalPath().toTravelledPath(pathOffset).distance.meters
            )
    }

    override fun getSpacingRequirements(): List<SpacingRequirement> {
        if (spacingRequirementsCache == null) {
            spacingRequirementAutomaton.incrementalPath = getIncrementalPath()
            // Path is complete and has been completely simulated
            val simulationComplete = getIncrementalPath().pathComplete && getLookahead().size == 0
            spacingRequirementAutomaton.callbacks =
                IncrementalRequirementEnvelopeAdapter(
                    rollingStock,
                    getFullEnvelope(),
                    simulationComplete
                )
            val updatedRequirements =
                spacingRequirementAutomaton.processPathUpdate() as? SpacingRequirements
                    ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
            spacingRequirementsCache = updatedRequirements.requirements
        }
        return spacingRequirementsCache!!
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
                    simulationComplete
                ),
                getIncrementalPath(),
            )
        val res =
            newAutomaton.processPathUpdate() as? SpacingRequirements
                ?: throw BlockAvailabilityInterface.NotEnoughLookaheadError()
        return res.requirements
    }

    override fun moveForward(): InfraExplorerWithEnvelope {
        sanityChecks()
        infraExplorer.moveForward()
        spacingRequirementsCache = null
        sanityChecks()
        return this
    }

    override fun getSimulatedLength(): Length<Path> {
        return Length(Distance.fromMeters(getFullEnvelope().endPos))
    }

    override fun clone(): InfraExplorerWithEnvelope {
        return InfraExplorerWithEnvelopeImpl(
            infraExplorer.clone(),
            envelopes.toMutableList(),
            spacingRequirementAutomaton.clone(),
            rollingStock,
            spacingRequirementsCache?.toList()
        )
    }

    /**
     * Asserts that there isn't too much or too little simulated length compared to the explore
     * position
     */
    private fun sanityChecks() {
        val incrementalPath = getIncrementalPath()
        if (!incrementalPath.pathStarted) return
        val pathBegin = getIncrementalPath().travelledPathBegin
        val minSimulatedLength = getPredecessorLength() - pathBegin
        val maxSimulatedLength = minSimulatedLength + getCurrentBlockLength().distance
        val simulatedLength = if (envelopes.isEmpty()) 0.meters else getSimulatedLength().distance
        assert(simulatedLength >= minSimulatedLength) { "missing simulations in infra explorer" }
        assert(simulatedLength <= maxSimulatedLength) { "too many simulations in infra explorer" }
    }
}
