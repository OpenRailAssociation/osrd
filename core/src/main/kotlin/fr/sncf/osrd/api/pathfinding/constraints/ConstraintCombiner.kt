package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.graph.EdgeToRanges
import fr.sncf.osrd.graph.Pathfinding

class ConstraintCombiner<EdgeT, OffsetType> : EdgeToRanges<EdgeT, OffsetType> {
    @JvmField val functions: MutableList<EdgeToRanges<EdgeT, OffsetType>> = ArrayList()

    override fun apply(edge: EdgeT): Collection<Pathfinding.Range<OffsetType>> {
        val res = HashSet<Pathfinding.Range<OffsetType>>()
        for (f in functions) res.addAll(f.apply(edge))
        return res
    }
}
