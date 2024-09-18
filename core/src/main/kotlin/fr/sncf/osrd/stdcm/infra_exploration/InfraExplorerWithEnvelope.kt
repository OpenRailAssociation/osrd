package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirementAutomaton
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.standalone_sim.result.ResultTrain
import fr.sncf.osrd.stdcm.graph.TimeData
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/**
 * Explore the infra while running simulations. Builds one global envelope and path from the start
 * of the train. The path can extend further than the part that has been simulated (see
 * InfraExplorer for a more detailed explanation).
 *
 * **The envelopes are scaled to account for the standard allowance (linearly)**. They can be used
 * to get an estimation of the train location at any given time, but the end speed should not be
 * used as a reference for new simulations.
 *
 * Generally speaking, the "current block" is the part where we are currently running simulations,
 * it doesn't have its envelope in the explorer. But there are some exceptions to this, such as when
 * the path and simulation are both complete. The envelopes always cover at least all the
 * predecessor blocks, and never extend into the lookahead.
 *
 * Note: the first envelope doesn't necessarily cover the first block in its entirety, while path
 * offsets start at offset=0 on the first block. There are two ways to properly handle time at path
 * offsets: either using `explorer.interpolateDepartureFromClamp`, or by converting the offsets into
 * `Offset<TravelledPath>` using the underlying incremental path.
 */
interface InfraExplorerWithEnvelope : InfraExplorer {

    /** Access the full envelope from the train start. */
    fun getFullEnvelope(): EnvelopeTimeInterpolate

    /** Adds an envelope. This is done in-place. */
    fun addEnvelope(envelope: Envelope): InfraExplorerWithEnvelope

    /**
     * Returns a copy with the given envelope, the previous one is ignored. This keeps stop data.
     */
    fun withNewEnvelope(envelope: Envelope): InfraExplorerWithEnvelope

    /** Add a stop to the end of the last simulated envelope */
    fun addStop(stopDuration: Double)

    /** Just for debugging purposes. */
    fun getStops(): List<TrainStop>

    /** Update the stop durations, following the updated time data */
    fun updateStopDurations(updatedTimeData: TimeData): InfraExplorerWithEnvelope

    /**
     * Calls `InterpolateDepartureFromClamp` on the underlying envelope, taking the travelled path
     * offset into account.
     */
    fun interpolateDepartureFromClamp(pathOffset: Offset<Path>): Double

    /** Returns the spacing requirements since the last update */
    fun getSpacingRequirements(): List<ResultTrain.SpacingRequirement>

    /** Returns all the spacing requirements over the whole path */
    fun getFullSpacingRequirements(): List<ResultTrain.SpacingRequirement>

    /** Returns the length of the simulated section of the path */
    fun getSimulatedLength(): Length<Path>

    /**
     * Only shallow copies are made. Used to enable backtracking by cloning explorers at each step.
     */
    override fun clone(): InfraExplorerWithEnvelope

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope>

    override fun moveForward(): InfraExplorerWithEnvelope
}

/** Init all InfraExplorersWithEnvelope starting at the given location. */
fun initInfraExplorerWithEnvelope(
    fullInfra: FullInfra,
    location: PathfindingEdgeLocationId<Block>,
    rollingStock: PhysicsRollingStock,
    stops: List<Collection<PathfindingEdgeLocationId<Block>>> = listOf(setOf()),
    constraints: List<PathfindingConstraint<Block>> = listOf()
): Collection<InfraExplorerWithEnvelope> {
    return initInfraExplorer(
            fullInfra.rawInfra,
            fullInfra.blockInfra,
            location,
            stops = stops,
            constraints
        )
        .map { explorer ->
            InfraExplorerWithEnvelopeImpl(
                explorer,
                appendOnlyLinkedListOf(),
                SpacingRequirementAutomaton(
                    fullInfra.rawInfra,
                    fullInfra.loadedSignalInfra,
                    fullInfra.blockInfra,
                    fullInfra.signalingSimulator,
                    IncrementalRequirementEnvelopeAdapter(rollingStock, null, false),
                    explorer.getIncrementalPath(),
                ),
                rollingStock
            )
        }
}
