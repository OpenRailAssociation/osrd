package fr.sncf.osrd.api

import fr.sncf.osrd.api.stdcm.RequestConsistSchedule
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.graph.PathfindingConstraint
import fr.sncf.osrd.pathfinding.constraints.CachedBlockConstraintCombiner
import fr.sncf.osrd.pathfinding.constraints.initConstraints
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.train.RollingStock

/**
 * Associates a list of rolling stocks with their related pathfinding constraints. Both lists have
 * one entry per path step (even when the rolling stock doesn't change between two consecutive
 * steps). The rolling stocks indexes match the index of the step on which they begin to apply: the
 * rolling stock and pathfinding constraint at index n apply between the steps n and n+1. This class
 * provides two ways to be built:
 * - From a list of STDCM query inputs.
 * - From a list of rolling stocks and their pathfinding constraints. This approach is mostly useful
 *   for testing purposes.
 */
data class ConsistSchedule(
    val rollingStocks: List<PhysicsRollingStock>,
    val constraints: List<PathfindingConstraint>?,
) {
    init {
        require(!rollingStocks.isEmpty())
        require(constraints == null || rollingStocks.size == constraints.size)
    }

    companion object {
        operator fun invoke(
            consistSchedule: RequestConsistSchedule,
            infra: FullInfra,
            allowedTrackSections: Set<TrackSectionId> = emptySet(),
            totalSteps: Int,
        ): ConsistSchedule {
            val boundaries = consistSchedule.boundaries
            val rollingStocks =
                consistSchedule.values.map {
                    parseRawRollingStock(
                        it.physicsConsist,
                        it.loadingGaugeType,
                        it.supportedSignalingSystems,
                    )
                }
            return ConsistSchedule(
                rollingStocks,
                boundaries,
                infra,
                allowedTrackSections,
                totalSteps,
            )
        }

        operator fun invoke(
            rollingStocks: List<RollingStock>,
            boundaries: List<Int>,
            infra: FullInfra,
            allowedTrackSections: Set<TrackSectionId> = emptySet(),
            totalSteps: Int,
        ): ConsistSchedule {
            // Input validation:
            when {
                (rollingStocks.size != boundaries.size + 1) -> {
                    throw OSRDError(ErrorType.InvalidSTDCMInputs)
                        .withContext(
                            "cause",
                            "${boundaries.size} boundaries and ${rollingStocks.size} consist configurations provided. There should be n-1 boundaries for n consist configurations",
                        )
                }
                (!boundaries.zipWithNext().all { (a, b) -> a < b }) -> {
                    throw OSRDError(ErrorType.InvalidSTDCMInputs)
                        .withContext(
                            "cause",
                            "Consist change boundaries are not strictly increasing",
                        )
                }
                (!(boundaries.isEmpty() ||
                    (boundaries.first() != 0 && boundaries.last() != totalSteps - 1))) -> {
                    throw OSRDError(ErrorType.InvalidSTDCMInputs)
                        .withContext(
                            "cause",
                            "Consist change specified on the first or last step of the path",
                        )
                }
            }

            // Build the rolling stock and constraint for each step:
            val rollingStocksPerStep = mutableListOf<RollingStock>()
            val constraints = mutableListOf<PathfindingConstraint>()
            var previousBoundary = 0
            for ((index, rollingStock) in rollingStocks.withIndex()) {
                val boundary = boundaries.getOrNull(index) ?: totalSteps
                val constraint =
                    CachedBlockConstraintCombiner.getCachedConstraintCombiner(
                        infra,
                        initConstraints(infra, rollingStock, allowedTrackSections),
                    )
                (previousBoundary..<boundary).forEach { _ ->
                    rollingStocksPerStep.add(rollingStock)
                    constraints.add(constraint)
                }
                previousBoundary = boundary
            }
            return ConsistSchedule(rollingStocksPerStep, constraints)
        }
    }
}
