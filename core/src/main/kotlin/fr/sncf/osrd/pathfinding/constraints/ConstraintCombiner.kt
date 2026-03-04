package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.SoftLazy
import fr.sncf.osrd.utils.units.OffsetRange
import java.util.concurrent.ConcurrentHashMap

/**
 * Combines several pathfinding constraint functions into a single one. Ranges are blocked if at
 * least one constraint blocks it.
 *
 * This class also handles caching: repeated calls on the same blocks reuse the previous results.
 *
 * This object (and its cache) can be shared across requests by using [getCachedConstraintCombiner].
 */
class ConstraintCombiner(val functions: List<PathfindingConstraint> = ArrayList()) :
    PathfindingConstraint {
    private val cache = ConcurrentHashMap<BlockId, Collection<OffsetRange<Block>>>()

    override fun apply(edge: BlockId): Collection<OffsetRange<Block>> {
        val cached = cache[edge]
        if (cached != null) return cached
        val res = HashSet<OffsetRange<Block>>()
        for (f in functions) res.addAll(f.apply(edge))
        cache[edge] = res
        return res
    }

    override fun getID(): String {
        return "ConstraintCombiner(${functions.joinToString(", ") { it.getID() }})"
    }

    companion object {
        data class CacheParameters(
            val infraName: String,
            val infraVersion: Int,
            val infraObjectId: Int, // For tests with modified infrastructures
            private val constraintIds: Set<String>,
        )

        val REUSABLE_CACHE by SoftLazy { ConcurrentHashMap<CacheParameters, ConstraintCombiner>() }

        /**
         * Returns a previous [ConstraintCombiner] that has the exact same parameter, if one has
         * already been used, and if it hasn't been cleared by the JVM.
         */
        fun getCachedConstraintCombiner(
            infra: FullInfra,
            constraints: List<PathfindingConstraint>,
        ): ConstraintCombiner {
            val key =
                CacheParameters(
                    infra.metadata.name,
                    infra.metadata.version,
                    System.identityHashCode(infra),
                    constraints.map { it.getID() }.toSet(),
                )
            return REUSABLE_CACHE.computeIfAbsent(key) { ConstraintCombiner(constraints) }
        }
    }
}

/** Initialize the constraints used to determine whether a block can be explored */
fun initConstraints(
    fullInfra: FullInfra,
    rollingStock: RollingStock,
    allowedTrackSections: Set<TrackSectionId>? = null,
): List<PathfindingConstraint> {
    return initConstraintsFromRSProps(
        fullInfra,
        rollingStock.isThermal,
        rollingStock.loadingGaugeType,
        rollingStock.modeNames.toList(),
        rollingStock.supportedSignalingSystems.toList(),
        allowedTrackSections,
    )
}

fun initConstraintsFromRSProps(
    infra: FullInfra,
    rollingStockIsThermal: Boolean,
    rollingStockLoadingGauge: RJSLoadingGaugeType,
    rollingStockSupportedElectrification: List<String>,
    rollingStockSupportedSignalingSystems: List<String>,
    allowedTrackSections: Set<TrackSectionId>? = null,
): List<PathfindingConstraint> {
    val res = mutableListOf<PathfindingConstraint>()
    if (!rollingStockIsThermal) {
        res.add(
            ElectrificationConstraints(
                infra.blockInfra,
                infra.rawInfra,
                rollingStockSupportedElectrification,
            )
        )
    }
    res.add(LoadingGaugeConstraints(infra.blockInfra, infra.rawInfra, rollingStockLoadingGauge))
    val sigSystemIds =
        rollingStockSupportedSignalingSystems.mapNotNull {
            infra.signalingSimulator.sigModuleManager.findSignalingSystem(it)
        }
    res.add(SignalingSystemConstraints(infra.blockInfra, listOf(sigSystemIds)))
    if (allowedTrackSections != null)
        res.add(TrackSectionConstraints(infra.blockInfra, infra.rawInfra, allowedTrackSections))
    return res
}
