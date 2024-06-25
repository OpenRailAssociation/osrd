package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.envelope_sim.SimpleRollingStock
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMAStarHeuristic
import fr.sncf.osrd.stdcm.STDCMHeuristicBuilder
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals

class STDCMHeuristicTests {

    @Test
    fun multipleStepsTest() {
        /*
        a ------> b ------> c ------> d ------> e
             ^       ^   ^   ^                ^
             0       1   2   3                4
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", allowedSpeed = 1.0),
                infra.addBlock("b", "c", allowedSpeed = 1.0),
                infra.addBlock("c", "d", allowedSpeed = 1.0),
                infra.addBlock("d", "e", allowedSpeed = 1.0),
            )

        val steps =
            listOf(
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[0], Offset(50.meters))),
                    null,
                    false
                ),
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[1], Offset(25.meters))),
                    null,
                    false
                ),
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[1], Offset(75.meters))),
                    null,
                    false
                ),
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[2], Offset(0.meters))),
                    null,
                    false
                ),
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[3], Offset(100.meters))),
                    1.0,
                    true
                ),
            )

        val heuristic =
            STDCMHeuristicBuilder(
                    infra,
                    infra,
                    steps,
                    Double.POSITIVE_INFINITY,
                    SimpleRollingStock.STANDARD_TRAIN,
                )
                .build()

        assertEquals(
            400.0 - 50.0,
            getLocationRemainingTime(infra, blocks[0], 50.meters, 0, heuristic)
        )
        assertEquals(
            400.0 - 85.0,
            getLocationRemainingTime(infra, blocks[0], 85.meters, 0, heuristic)
        )
        assertEquals(
            400.0 - 100.0 - 25.0,
            getLocationRemainingTime(infra, blocks[1], 25.meters, 1, heuristic)
        )
        assertEquals(
            400.0 - 100.0 - 75.0,
            getLocationRemainingTime(infra, blocks[1], 75.meters, 2, heuristic)
        )
        assertEquals(
            400.0 - 200.0,
            getLocationRemainingTime(infra, blocks[2], 0.meters, 3, heuristic)
        )
        assertEquals(0.0, getLocationRemainingTime(infra, blocks[3], null, 3, heuristic))
        assertEquals(
            Double.POSITIVE_INFINITY,
            getLocationRemainingTime(infra, blocks[3], 0.meters, 0, heuristic)
        )
    }

    @Test
    fun lookaheadTest() {
        /*
                   -------> x ------> y
                  /
        a ------> b ------> c ------> d ------> e
             ^         ^                   ^
             0         1                   2
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", allowedSpeed = 1.0),
                infra.addBlock("b", "c", allowedSpeed = 1.0),
                infra.addBlock("c", "d", allowedSpeed = 1.0),
                infra.addBlock("d", "e", allowedSpeed = 1.0),
            )
        val alternativeBlocks =
            listOf(
                infra.addBlock("b", "x", allowedSpeed = 1.0),
                infra.addBlock("x", "y", allowedSpeed = 1.0),
            )

        val steps =
            listOf(
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[0], Offset(50.meters))),
                    null,
                    false
                ),
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[1], Offset(50.meters))),
                    null,
                    false
                ),
                STDCMStep(
                    listOf(PathfindingEdgeLocationId(blocks[3], Offset(50.meters))),
                    1.0,
                    true
                ),
            )

        val heuristics =
            STDCMHeuristicBuilder(
                    infra,
                    infra,
                    steps,
                    Double.POSITIVE_INFINITY,
                    SimpleRollingStock.STANDARD_TRAIN,
                )
                .build()

        for (i in 1 until blocks.size) {
            val lookahead = mutableListOf<BlockId>()
            for (j in 1 ..< i) {
                lookahead.add(blocks[j])
            }
            // While the lookahead is on the right path, the remaining distance shouldn't change
            assertEquals(
                400.0 - 50.0 - 50.0,
                getLocationRemainingTime(
                    infra,
                    blocks[0],
                    50.meters,
                    0,
                    heuristics,
                    lookahead = lookahead
                )
            )
        }

        // Lookahead on the wrong path, no possible result
        assertEquals(
            Double.POSITIVE_INFINITY,
            getLocationRemainingTime(
                infra,
                blocks[0],
                50.meters,
                0,
                heuristics,
                lookahead = listOf(alternativeBlocks.first())
            )
        )
    }

    /**
     * Returns the estimated remaining time at the given location. The instantiated stdcm edge
     * starts at edgeStart, the edgeOffset references this edge.
     */
    private fun getLocationRemainingTime(
        infra: DummyInfra,
        block: BlockId,
        nodeOffsetOnEdge: Distance?,
        nbPassedSteps: Int,
        heuristic: STDCMAStarHeuristic,
        lookahead: List<BlockId> = listOf()
    ): Double {
        var explorer =
            initInfraExplorerWithEnvelope(
                    infra.fullInfra(),
                    PathfindingEdgeLocationId(block, Offset(0.meters)),
                    SimpleRollingStock.STANDARD_TRAIN
                )
                .first()

        // Extend the lookahead to include the blocks given as parameters
        while (!lookahead.all { explorer.getLookahead().contains(it) }) {
            explorer =
                explorer.cloneAndExtendLookahead().first { newExplorer ->
                    newExplorer.getLookahead().all { lookahead.contains(it) }
                }
        }
        val defaultEdge =
            STDCMEdge(
                explorer,
                explorer,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                null,
                Offset(0.meters),
                0,
                false,
                0.0,
                0.0,
                Length(0.meters),
                0.0
            )
        return heuristic.invoke(defaultEdge, nodeOffsetOnEdge?.let { Offset(it) }, nbPassedSteps)
    }
}
