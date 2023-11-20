package fr.sncf.osrd.api.pathfinding.constraints

import fr.sncf.osrd.graph.EdgeToRanges
import fr.sncf.osrd.graph.Pathfinding

class ConstraintCombiner<EdgeT> : EdgeToRanges<EdgeT> {
    @JvmField
    val functions: MutableList<EdgeToRanges<EdgeT>> = ArrayList()
    override fun apply(edge: EdgeT): Collection<Pathfinding.Range> {
        val res = HashSet<Pathfinding.Range>()
        for (f in functions)
            res.addAll(f.apply(edge))
        return res
    }
}
