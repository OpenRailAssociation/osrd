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

data class InfraExplorerWithEnvelopeImpl(
    private val infraExplorer: InfraExplorer,
    private val envelopes: MutableList<EnvelopeTimeInterpolate>,
    private val spacingRequirementAutomaton: SpacingRequirementAutomaton,
    private val rollingStock: PhysicsRollingStock,
    private var spacingRequirements: List<SpacingRequirement>? = null
) : InfraExplorer by infraExplorer, InfraExplorerWithEnvelope {

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope> {
        return infraExplorer.cloneAndExtendLookahead().map { explorer ->
            InfraExplorerWithEnvelopeImpl(
                explorer,
                ArrayList(envelopes),
                spacingRequirementAutomaton.clone(),
                rollingStock,
                spacingRequirements?.toList(),
            )
        }
    }

    override fun getFullEnvelope(): EnvelopeTimeInterpolate {
        return EnvelopeConcat.from(envelopes)
    }

    override fun addEnvelope(envelope: EnvelopeTimeInterpolate): InfraExplorerWithEnvelope {
        envelopes.add(envelope)
        return this
    }

    override fun interpolateTimeClamp(pathOffset: Offset<Path>): Double {
        return getFullEnvelope()
            .interpolateTotalTimeClamp(
                getIncrementalPath().toTravelledPath(pathOffset).distance.meters
            )
    }

    override fun getSpacingRequirements(): List<SpacingRequirement> {
        if (spacingRequirements == null) {
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
            spacingRequirements = updatedRequirements.requirements
        }
        return spacingRequirements!!
    }

    override fun moveForward() {
        infraExplorer.moveForward()
        spacingRequirements = null
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
            spacingRequirements?.toList()
        )
    }
}
