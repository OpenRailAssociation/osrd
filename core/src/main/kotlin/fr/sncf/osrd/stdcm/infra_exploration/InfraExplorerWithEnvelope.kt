package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.utils.units.Offset

/** Explore the infra while running simulations. Builds one global envelope and path from the start of the train.
 * The path can extend further than the part that has been simulated
 * (see InfraExplorer for a more detailed explanation). */
interface InfraExplorerWithEnvelope : InfraExplorer {

    /** Access the full envelope from the train start. */
    fun getFullEnvelope(): EnvelopeTimeInterpolate

    /** Returns the envelope spanning over the last block. */
    fun getLastEnvelope(): EnvelopeTimeInterpolate

    /** Adds an envelope. */
    fun addEnvelope(envelope: EnvelopeTimeInterpolate): InfraExplorerWithEnvelope

    /** Calls `InterpolateTotalTimeClamp` on the underlying envelope, taking the travelled path offset into account. */
    fun interpolateTimeClamp(pathOffset: Offset<Path>): Double

    /** Only shallow copies are made.
     * Used to enable backtracking by cloning explorers at each step. */
    override fun clone(): InfraExplorerWithEnvelope

    override fun cloneAndExtendLookahead(): Collection<InfraExplorerWithEnvelope>
}

/** Init all InfraExplorersWithEnvelope starting at the given location. */
fun initInfraExplorerWithEnvelope(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    location: PathfindingEdgeLocationId<Block>,
    endBlocks: Collection<BlockId> = setOf()
): Collection<InfraExplorerWithEnvelope> {
    return initInfraExplorer(rawInfra, blockInfra, location, endBlocks = endBlocks)
        .map { explorer -> InfraExplorerWithEnvelopeImpl(explorer, mutableListOf()) }
}

/** Add an envelope to a simple InfraExplorer. */
fun InfraExplorer.withEnvelope(
    envelope: EnvelopeTimeInterpolate,
): InfraExplorerWithEnvelope {
    return InfraExplorerWithEnvelopeImpl(this, mutableListOf(envelope))
}
