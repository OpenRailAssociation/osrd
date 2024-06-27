package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.envelope_sim.SimpleRollingStock
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMAStarHeuristic
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.apply
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.makeSTDCMHeuristics
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

        val heuristics =
            makeSTDCMHeuristics(
                infra,
                infra,
                steps,
                Double.POSITIVE_INFINITY,
                SimpleRollingStock.STANDARD_TRAIN,
            )
        assertEquals(4, heuristics.size)

        assertEquals(
            400.0 - 50.0,
            getLocationRemainingTime(infra, blocks[0], 50.meters, 0, heuristics)
        )
        assertEquals(
            400.0 - 85.0,
            getLocationRemainingTime(infra, blocks[0], 85.meters, 0, heuristics)
        )
        assertEquals(
            400.0 - 100.0 - 25.0,
            getLocationRemainingTime(infra, blocks[1], 25.meters, 1, heuristics)
        )
        assertEquals(
            400.0 - 100.0 - 75.0,
            getLocationRemainingTime(infra, blocks[1], 75.meters, 2, heuristics)
        )
        assertEquals(
            400.0 - 200.0,
            getLocationRemainingTime(infra, blocks[2], 0.meters, 3, heuristics)
        )
        assertEquals(0.0, getLocationRemainingTime(infra, blocks[3], null, 3, heuristics))
        assertEquals(
            Double.POSITIVE_INFINITY,
            getLocationRemainingTime(infra, blocks[3], 0.meters, 0, heuristics)
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
        heuristics: List<STDCMAStarHeuristic<STDCMNode>>
    ): Double {
        val explorer =
            initInfraExplorerWithEnvelope(
                    infra.fullInfra(),
                    PathfindingEdgeLocationId(block, Offset(0.meters)),
                    SimpleRollingStock.STANDARD_TRAIN
                )
                .first()
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
                0.0,
                0,
                false,
                0.0,
                0.0,
                Length(0.meters),
                0.0
            )
        var locationOnEdge: Offset<Block>? = null
        if (nodeOffsetOnEdge != null) locationOnEdge = Offset(nodeOffsetOnEdge)
        val node = STDCMNode(0.0, 0.0, explorer, 0.0, 0.0, defaultEdge, 0, locationOnEdge, null)
        return heuristics.apply(node, nbPassedSteps)
    }
}
