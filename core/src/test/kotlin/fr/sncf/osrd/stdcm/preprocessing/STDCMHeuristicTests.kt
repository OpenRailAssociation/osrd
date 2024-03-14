package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.envelope_sim.SimpleRollingStock
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.STDCMEdge
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

    private val maxDepartureDelay = 3600.0

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
                maxDepartureDelay,
            )
        assertEquals(4, heuristics.size)

        assertEquals(
            400.0 - 50.0,
            getLocationRemainingTime(infra, blocks[0], 0.meters, 50.meters, heuristics[0])
        )
        assertEquals(
            400.0 - 75.0 - 10.0,
            getLocationRemainingTime(infra, blocks[0], 75.meters, 10.meters, heuristics[0])
        )
        assertEquals(
            400.0 - 180.0,
            getLocationRemainingTime(infra, blocks[1], 0.meters, 80.meters, heuristics[1])
        )
        assertEquals(
            400.0 - 180.0,
            getLocationRemainingTime(infra, blocks[1], 0.meters, 80.meters, heuristics[2])
        )
        assertEquals(
            400.0 - 200.0,
            getLocationRemainingTime(infra, blocks[2], 0.meters, 0.meters, heuristics[3])
        )
        assertEquals(
            400.0 - 350.0,
            getLocationRemainingTime(infra, blocks[3], 25.meters, 25.meters, heuristics[3])
        )
        assertEquals(
            Double.POSITIVE_INFINITY,
            getLocationRemainingTime(infra, blocks[3], 0.meters, 50.meters, heuristics[0])
        )
    }

    /**
     * Returns the estimated remaining time at the given location. The instantiated stdcm edge
     * starts at edgeStart, the edgeOffset references this edge.
     */
    private fun getLocationRemainingTime(
        infra: DummyInfra,
        block: BlockId,
        edgeStart: Distance,
        edgeOffset: Distance,
        heuristic: AStarHeuristic<STDCMEdge, STDCMEdge>
    ): Double {
        val explorer =
            initInfraExplorerWithEnvelope(
                    infra.fullInfra(),
                    PathfindingEdgeLocationId(block, Offset(0.meters)),
                    listOf(),
                    SimpleRollingStock.STANDARD_TRAIN
                )
                .first()
        val edge =
            STDCMEdge(
                explorer,
                explorer,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                null,
                Offset(edgeStart),
                0,
                0.0,
                0,
                false,
                0.0,
                0.0,
                Length(edgeOffset),
                0.0,
                0.0,
            )
        return heuristic.apply(edge, Offset(edgeOffset)) / maxDepartureDelay
    }
}
