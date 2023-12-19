package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.conflicts.IncrementalPath
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/** Explore the infra, without running simulations.
 * Builds one global path from the start of the train, one block at a time.
 *
 * The path has several parts: the current block (on which is the train head), the path the train comes from,
 * and the *lookahead* (i.e. the path the train will follow later).
 *
 * ```
 * (...      predecessors  ) ( current block ) (           lookahead             )
 * ------> ----------------> ----------------> ----------------> ---------------->
 *                           (       ^       )                   (       ^       )
 *                           getCurrentBlock()                getLastBlockIdentifier()
 *                           getCurrentEdgePathProperties()
 *                           ...
 * ```
 * */
interface InfraExplorer {
    /** Get the IncrementalPath, the path type used to generate resource use.
     * Includes the whole paths: predecessors, current block, and lookahead. */
    fun getIncrementalPath(): IncrementalPath

    /** Get the path properties for the current edge only, starting at the given offset and for the given length.
     * If no length is given, the path covers the rest of the block. */
    fun getCurrentEdgePathProperties(offset: Offset<Block>, length: Distance?): PathProperties

    /** Returns an object that can be used to identify edges.
     * This is the *last edge of the lookahead*. */
    fun getLastEdgeIdentifier(): EdgeIdentifier

    /** Clone the current object and extend the lookahead by one block, for each block starting there. */
    fun cloneAndExtendLookahead(): Collection<InfraExplorer>

    /** Move the current block by one, following the lookahead section. */
    fun moveForward()

    /** Returns the current block. */
    fun getCurrentBlock(): BlockId

    /** Returns the length of the current block. */
    fun getCurrentBlockLength(): Length<Block>

    /** Returns a copy of the current instance. */
    fun clone(): InfraExplorer
}

/** Used to identify blocks */
interface EdgeIdentifier {
    override fun equals(other: Any?): Boolean
    override fun hashCode(): Int
}

/** Init all InfraExplorers starting at the given location. */
fun initInfraExplorer(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    location: PathfindingEdgeLocationId<Block>
): Collection<InfraExplorer> {
    throw NotImplementedError()
}
