package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.conflicts.IncrementalRequirementEnvelopeAdapter
import fr.sncf.osrd.conflicts.SpacingRequirementAutomaton
import fr.sncf.osrd.envelope.Envelope.Companion.make
import fr.sncf.osrd.envelope.EnvelopeTestUtils
import fr.sncf.osrd.envelope_sim.SimpleRollingStock.STANDARD_TRAIN
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.stdcm.STDCMAStarHeuristic
import fr.sncf.osrd.stdcm.STDCMHeuristicBuilder
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.stdcm.graph.TimeData
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelopeImpl
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
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
                STDCMStep(listOf(EdgeLocation(blocks[0], Offset(50.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[1], Offset(25.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[1], Offset(75.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[2], Offset(0.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[3], Offset(100.meters))), 1.0, true),
            )

        val heuristic =
            STDCMHeuristicBuilder(
                    infra,
                    infra,
                    steps,
                    Double.POSITIVE_INFINITY,
                    STANDARD_TRAIN,
                    mrspBuilder = CachedBlockMRSPBuilder(infra, infra, null),
                    allowance = null,
                )
                .build()

        // Current block = 0
        var explorer =
            initInfraExplorer(infra, infra, steps.first().locations.first(), steps).single()

        assertEquals(400.0 - 50.0, getLocationRemainingTime(infra, explorer, 50.meters, heuristic))
        assertEquals(400.0 - 85.0, getLocationRemainingTime(infra, explorer, 85.meters, heuristic))

        // Current block = 1
        explorer = explorer.cloneAndExtendLookahead().single().moveForward()
        assertEquals(
            400.0 - 100.0 - 25.0,
            getLocationRemainingTime(infra, explorer, 25.meters, heuristic),
        )
        assertEquals(
            400.0 - 100.0 - 75.0,
            getLocationRemainingTime(infra, explorer, 75.meters, heuristic),
        )

        // Current block = 2
        explorer = explorer.cloneAndExtendLookahead().single().moveForward()
        assertEquals(400.0 - 200.0, getLocationRemainingTime(infra, explorer, 0.meters, heuristic))

        explorer = explorer.cloneAndExtendLookahead().single().moveForward()
        assertEquals(0.0, getLocationRemainingTime(infra, explorer, null, heuristic))
    }

    @Test
    fun allowanceTest() {
        /*
        a ------> b ------> c
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", allowedSpeed = 1.0),
                infra.addBlock("b", "c", allowedSpeed = 1.0),
            )

        val steps =
            listOf(
                STDCMStep(listOf(EdgeLocation(blocks[0], Offset(0.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[1], Offset(100.meters))), null, true),
            )

        val heuristicWithAllowance =
            STDCMHeuristicBuilder(
                    infra,
                    infra,
                    steps,
                    Double.POSITIVE_INFINITY,
                    STANDARD_TRAIN,
                    mrspBuilder = CachedBlockMRSPBuilder(infra, infra, null),
                    allowance = AllowanceValue.Percentage(100.0),
                )
                .build()
        val heuristicWithoutAllowance =
            STDCMHeuristicBuilder(
                    infra,
                    infra,
                    steps,
                    Double.POSITIVE_INFINITY,
                    STANDARD_TRAIN,
                    mrspBuilder = CachedBlockMRSPBuilder(infra, infra, null),
                    allowance = null,
                )
                .build()

        val explorer =
            initInfraExplorer(infra, infra, steps.first().locations.first(), steps).single()

        val resWithAllowance =
            getLocationRemainingTime(infra, explorer, 50.meters, heuristicWithAllowance)
        val resWithoutAllowance =
            getLocationRemainingTime(infra, explorer, 50.meters, heuristicWithoutAllowance)

        assertEquals(resWithoutAllowance * 2, resWithAllowance, 1e-5)
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
        listOf(
            infra.addBlock("b", "x", allowedSpeed = 1.0),
            infra.addBlock("x", "y", allowedSpeed = 1.0),
        )

        val steps =
            listOf(
                STDCMStep(listOf(EdgeLocation(blocks[0], Offset(50.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[1], Offset(50.meters))), null, false),
                STDCMStep(listOf(EdgeLocation(blocks[3], Offset(50.meters))), 1.0, true),
            )

        val heuristics =
            STDCMHeuristicBuilder(
                    infra,
                    infra,
                    steps,
                    Double.POSITIVE_INFINITY,
                    STANDARD_TRAIN,
                    mrspBuilder = CachedBlockMRSPBuilder(infra, infra, null),
                    allowance = null,
                )
                .build()

        var explorer =
            initInfraExplorer(infra, infra, steps.first().locations.first(), steps).single()

        repeat(blocks.size - 1) {
            explorer =
                explorer.cloneAndExtendLookahead().single { candidate ->
                    candidate.getLookahead().all { blocks.contains(it.value) }
                }

            // While the lookahead is on the right path, the remaining distance shouldn't change
            assertEquals(
                400.0 - 50.0 - 50.0,
                getLocationRemainingTime(infra, explorer, 50.meters, heuristics),
            )
        }

        var wrongPathExplorer =
            initInfraExplorer(infra, infra, steps.first().locations.first(), steps).single()
        repeat(2) {
            wrongPathExplorer =
                wrongPathExplorer.cloneAndExtendLookahead().single {
                    it.getLookahead().last().value != blocks[1]
                }
        }
        // Lookahead on the wrong path, no possible result
        assertEquals(
            Double.POSITIVE_INFINITY,
            getLocationRemainingTime(infra, wrongPathExplorer, 50.meters, heuristics),
        )
    }

    /**
     * Returns the estimated remaining time at the given location. The instantiated stdcm edge
     * starts at edgeStart, the edgeOffset references this edge.
     */
    private fun getLocationRemainingTime(
        infra: DummyInfra,
        infraExplorer: InfraExplorer,
        offset: Distance?,
        heuristic: STDCMAStarHeuristic,
    ): Double {
        val defaultTimeData =
            TimeData(
                earliestReachableTime = 0.0,
                maxDepartureDelayingWithoutConflict = 0.0,
                departureTime = 0.0,
                timeOfNextConflictAtLocation = 0.0,
                totalRunningTime = 0.0,
                stopTimeData = listOf(),
                maxFirstDepartureDelaying = 0.0,
            )
        val withEnvelope =
            InfraExplorerWithEnvelopeImpl(
                infraExplorer,
                appendOnlyLinkedListOf(),
                SpacingRequirementAutomaton(
                    infra,
                    infra.fullInfra().loadedSignalInfra,
                    infra,
                    infra.fullInfra().signalingSimulator,
                    IncrementalRequirementEnvelopeAdapter(STANDARD_TRAIN, null, false),
                    infraExplorer.getIncrementalPath(),
                ),
                STANDARD_TRAIN,
            )
        val defaultNode =
            STDCMNode(
                defaultTimeData,
                0.0,
                withEnvelope,
                null,
                Offset(0.meters),
                null,
                null,
                null,
                0.0,
                null,
            )
        val defaultEdge =
            STDCMEdge(
                defaultTimeData,
                withEnvelope,
                withEnvelope,
                defaultNode,
                Offset(0.meters),
                false,
                0.0,
                0.0,
                Length(0.meters),
                0.0,
                null,
                make(
                    EnvelopeTestUtils.generateTimes(
                        doubleArrayOf(0.0, 1.0),
                        doubleArrayOf(1.0, 1.0),
                    )
                ),
            )

        val stepTracker = infraExplorer.getStepTracker().clone()
        for (block in infraExplorer.getPredecessorBlocks().toList()) {
            stepTracker.moveForward(block.value, Offset.zero(), infra.getBlockLength(block.value))
        }
        val blockOffset =
            offset?.let { Offset(it) } ?: infra.getBlockLength(infraExplorer.getCurrentBlock())
        stepTracker.moveForward(infraExplorer.getCurrentBlock(), Offset.zero(), blockOffset)

        return heuristic.invoke(defaultEdge, offset?.let { Offset(it) }, stepTracker)
    }
}
