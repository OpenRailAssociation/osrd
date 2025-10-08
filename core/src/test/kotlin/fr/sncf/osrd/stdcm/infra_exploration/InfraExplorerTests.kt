package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.utils.routesOnBlock
import fr.sncf.osrd.stdcm.stepsFromLocations
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class InfraExplorerTests {

    @Test
    fun testSingleEdge() {
        /*
        a --> b
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b")

        val explorers =
            initInfraExplorer(
                infra,
                infra,
                EdgeLocation(block, Offset(0.meters)),
                stepsFromLocations(EdgeLocation(block, infra.getBlockLength(block))),
            )
        assertEquals(1, explorers.size)
        val explorer = explorers.first()
        assertTrue { explorer.getIncrementalPath().pathStarted }
        assertTrue { explorer.getIncrementalPath().pathComplete }
    }

    @Test
    fun testSinglePath() {
        /*
        a --> b --> c --> d --> e
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d"),
                infra.addBlock("d", "e"),
            )

        // a --> b
        val firstExplorers =
            initInfraExplorer(
                infra,
                infra,
                EdgeLocation(blocks[0], Offset(0.meters)),
                stepsFromLocations(EdgeLocation(blocks.last(), infra.getBlockLength(blocks.last()))),
            )
        assertEquals(1, firstExplorers.size)
        var explorer = firstExplorers.first()

        assertEquals(blocks[0], explorer.getCurrentBlock())
        assertThrows<AssertionError> { explorer.moveForward() } // Not enough lookahead
        assertFalse { explorer.getIncrementalPath().pathComplete }

        // Fully extend lookahead
        repeat(3) {
            val extended = explorer.cloneAndExtendLookahead()
            assertEquals(1, extended.size)
            explorer = extended.first()
        }

        assertTrue { explorer.getIncrementalPath().pathComplete }

        // Current block hasn't moved
        assertEquals(blocks[0], explorer.getCurrentBlock())

        // Move forward
        explorer.moveForward()
        assertEquals(blocks[1], explorer.getCurrentBlock())
        explorer.moveForward()
        assertEquals(blocks[2], explorer.getCurrentBlock())
        explorer.moveForward()
        assertEquals(blocks[3], explorer.getCurrentBlock())

        // Can't extend any further
        assertTrue { explorer.cloneAndExtendLookahead().isEmpty() }
    }

    @Test
    fun testTwoDifferentPaths() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c1"),
                infra.addBlock("c1", "d"),
                infra.addBlock("b", "c2"),
                infra.addBlock("c2", "d"),
                infra.addBlock("d", "e"),
            )

        // a --> b
        val firstExplorers =
            initInfraExplorer(infra, infra, EdgeLocation(blocks[0], Offset(0.meters)))
        assertEquals(1, firstExplorers.size)
        val firstExplorer = firstExplorers.first()

        assertThrows<AssertionError> { firstExplorer.moveForward() } // Not enough lookahead

        // current block a->b, lookahead b->c1 and b->c2
        val firstExplorerExtended = firstExplorer.cloneAndExtendLookahead().toList()
        assertEquals(2, firstExplorerExtended.size)
        assertEquals(
            firstExplorerExtended[0].getCurrentBlock(),
            firstExplorerExtended[1].getCurrentBlock(),
        )
        assertNotEquals(
            firstExplorerExtended[0].getLastEdgeIdentifier(),
            firstExplorerExtended[1].getLastEdgeIdentifier(),
        )

        // extend lookahead twice, current block a->b, lookahead b->c1->d->e and b->c2->d->e
        val extendedUntilEnd =
            firstExplorerExtended.map { explorer ->
                val extendedOnce = explorer.cloneAndExtendLookahead()
                assertEquals(1, extendedOnce.size)
                val extendedTwice = extendedOnce.first().cloneAndExtendLookahead()
                assertEquals(1, extendedTwice.size)
                extendedTwice.first()
            }
        // The current block still hasn't moved
        assertEquals(extendedUntilEnd[0].getCurrentBlock(), extendedUntilEnd[1].getCurrentBlock())
        // The lookahead now ends with the same block, but the lookahead differ, it should not be
        // equal
        assertNotEquals(
            extendedUntilEnd[0].getLastEdgeIdentifier(),
            extendedUntilEnd[1].getLastEdgeIdentifier(),
        )

        // Move forward once, current block b->c1 and b->c2, lookahead c1->d->e and c2->d->e
        extendedUntilEnd[0].moveForward()
        extendedUntilEnd[1].moveForward()
        assertNotEquals(
            extendedUntilEnd[0].getCurrentBlock(),
            extendedUntilEnd[1].getCurrentBlock(),
        )

        // Move forward 2 times, both explorers should be at current block d->e and no lookahead
        repeat(2) {
            extendedUntilEnd[0].moveForward()
            extendedUntilEnd[1].moveForward()
        }
        assertEquals(extendedUntilEnd[0].getCurrentBlock(), extendedUntilEnd[1].getCurrentBlock())
        assertEquals(
            extendedUntilEnd[0].getLastEdgeIdentifier(),
            extendedUntilEnd[1].getLastEdgeIdentifier(),
        )
    }

    @Test
    fun testBlockedPath() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2

         Same as testTwoDifferentPaths(), but with constraints applied on one of the path.
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c1"),
                infra.addBlock("c1", "d"),
                infra.addBlock("b", "c2"),
                infra.addBlock("c2", "d"),
                infra.addBlock("d", "e"),
            )

        // Every block is electrified, except b->c1
        for (block in infra.blockPool) block.voltage = "25000V"
        infra.blockPool[1].voltage = ""

        val electrificationConstraints =
            ElectrificationConstraints(infra, infra, TestTrains.FAST_ELECTRIC_TRAIN.modeNames)
        val constraints = listOf(electrificationConstraints)

        // a --> b
        val firstExplorers =
            initInfraExplorer(
                infra,
                infra,
                EdgeLocation(blocks[0], Offset(0.meters)),
                constraints = constraints,
            )
        assertEquals(1, firstExplorers.size)
        val firstExplorer = firstExplorers.first()

        // current block a->b, since b->c1 is not electrified, the lookahead is b->c2
        val firstExplorerExtended = firstExplorer.cloneAndExtendLookahead().toList()
        assertEquals(1, firstExplorerExtended.size)

        // we add the block c2->d in the lookahead
        val firstExplorerExtended2 =
            firstExplorerExtended.first().cloneAndExtendLookahead().toList()
        assertEquals(1, firstExplorerExtended2.size)

        // we add the block d->e in the lookahead
        val firstExplorerExtended3 =
            firstExplorerExtended2.first().cloneAndExtendLookahead().toList()
        assertEquals(1, firstExplorerExtended3.size)

        firstExplorerExtended3.first().moveForward()
        assertEquals(blocks[3], firstExplorerExtended3.first().getCurrentBlock())
        firstExplorerExtended3.first().moveForward()
        assertEquals(blocks[4], firstExplorerExtended3.first().getCurrentBlock())
        firstExplorerExtended3.first().moveForward()
        assertEquals(blocks[5], firstExplorerExtended3.first().getCurrentBlock())
    }

    /**
     * Test that there are two instances of InfraExplorer when starting on a point with overlapping
     * routes
     */
    @Test
    fun testStartingOnOverlappingRoutes() {
        val infra =
            Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))

        // First, look for a block that has more than one route
        var firstBlock: BlockId? = null
        for (block in infra.blockInfra.blocks) {
            val routes = infra.blockInfra.routesOnBlock(infra.rawInfra, block)
            if (routes.size > 1) {
                firstBlock = block
                break
            }
        }
        firstBlock!!
        val firstExplorers =
            initInfraExplorer(
                infra.rawInfra,
                infra.blockInfra,
                EdgeLocation(firstBlock, Offset(0.meters)),
            )
        assertEquals(2, firstExplorers.size) // There should be one instance per route
    }

    /** Test the path exploration when routes overlap */
    @Test
    fun testExplorationWithOverlappingRoutes() {
        // See overlapping_routes.py for a detailed infrastructure description
        //
        //      a1.nf                                   b1.nf
        //  |_____>>___                               ____>>______|
        //              \                            /
        //      a2.nf    \   center.1    center.3   /   b2.nf
        //  |_____>>______+______>_____>_____>_____+______>>______|
        //                        center.2
        //
        // >>: signal that delimits a route
        // >: signal that doesn't delimit a route
        // There are 4 routes on the middle section: a1->b1, a2->b1, a1->b2, a2->b2
        // Each branch also has a route between the signal and buffer stop.

        val infra =
            Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))
        val detector =
            infra.rawInfra.detectors.first { det ->
                infra.rawInfra.getDetectorName(det) == "det.center.1"
            }
        val blocks =
            infra.blockInfra.getBlocksStartingAtDetector(
                DirDetectorId(detector, Direction.INCREASING)
            )
        assertEquals(1, blocks.size)
        val block = blocks[0]

        // block 1->2, lookahead 2->3->bx
        val explorers =
            initInfraExplorer(
                infra.rawInfra,
                infra.blockInfra,
                EdgeLocation(block, Offset(0.meters)),
            )
        assertEquals(4, explorers.size) // There should be one instance per route
        assertFalse { allEqual(explorers.map { it.getLastEdgeIdentifier() }) }
        assertTrue { allEqual(explorers.map { it.getCurrentBlock() }) }

        // block 2->3, lookahead 3->bx
        explorers.forEach { it.moveForward() }
        assertFalse { allEqual(explorers.map { it.getLastEdgeIdentifier() }) }
        assertTrue { allEqual(explorers.map { it.getCurrentBlock() }) }

        // block 3->b1 and 3->b2
        explorers.forEach { it.moveForward() }
        assertFalse { allEqual(explorers.map { it.getLastEdgeIdentifier() }) }
        assertFalse { allEqual(explorers.map { it.getCurrentBlock() }) }
    }

    /**
     * Test that two InfraExplorer instances are created when extending and two routes are possible
     */
    @Test
    fun testRouteDivergence() {
        val infra =
            Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))

        val detector =
            infra.rawInfra.detectors.first { det -> infra.rawInfra.getDetectorName(det) == "bf.a1" }
        val blocks =
            infra.blockInfra.getBlocksStartingAtDetector(
                DirDetectorId(detector, Direction.INCREASING)
            )
        assertEquals(1, blocks.size)
        val block = blocks[0]

        // bf.a1 -> s.a1
        val explorers =
            initInfraExplorer(
                    infra.rawInfra,
                    infra.blockInfra,
                    EdgeLocation(block, Offset(0.meters)),
                )
                .toList()
        assertEquals(1, explorers.size)
        val extended = explorers[0].cloneAndExtendLookahead()
        assertEquals(2, extended.size) // Two routes start there (a1->b1 and a1->b2)
    }

    @Test
    fun testStops() {
        /*
        a --> b --> c --> d --> e
          [                  ]         path
          ^     ^   ^        ^         stops
         */
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
                infra.addBlock("c", "d"),
                infra.addBlock("d", "e"),
            )

        var explorer =
            initInfraExplorer(
                    infra,
                    infra,
                    EdgeLocation(blocks[0], Offset(50.meters)),
                    stepsFromLocations(
                        EdgeLocation(blocks[0], Offset(50.meters)),
                        EdgeLocation(blocks[1], Offset(50.meters)),
                        EdgeLocation(blocks[2], Offset(0.meters)),
                        EdgeLocation(blocks[3], Offset(50.meters)),
                        stops = true,
                    ),
                )
                .single()
        while (true) explorer = explorer.cloneAndExtendLookahead().firstOrNull() ?: break

        val incrementalPath = explorer.getIncrementalPath()
        assertEquals(4, incrementalPath.stopCount)
        assertEquals(Offset(50.meters), incrementalPath.getStopOffset(0))
        assertEquals(Offset(150.meters), incrementalPath.getStopOffset(1))
        assertEquals(Offset(200.meters), incrementalPath.getStopOffset(2))
        assertEquals(Offset(350.meters), incrementalPath.getStopOffset(3))
    }

    /** Similar test to the one above, but not starting on the first block on the route */
    @Test
    fun testStopsLongerRoute() {
        val infra =
            Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))
        val detector =
            infra.rawInfra.detectors.first { det ->
                infra.rawInfra.getDetectorName(det) == "det.center.2"
            }
        val block =
            infra.blockInfra
                .getBlocksStartingAtDetector(DirDetectorId(detector, Direction.INCREASING))
                .single()

        // block 1->2, lookahead 2->3->bx
        val explorers =
            initInfraExplorer(
                    infra.rawInfra,
                    infra.blockInfra,
                    EdgeLocation(block, Offset(32.meters)),
                    stepsFromLocations(EdgeLocation(block, Offset(42.meters)), stops = true),
                )
                .first()
        val incrementalPath = explorers.getIncrementalPath()
        assertEquals(1, incrementalPath.stopCount)
        assertEquals(
            Offset(10.meters),
            incrementalPath.toTravelledPath(incrementalPath.getStopOffset(0)),
        )
    }

    private fun <T> allEqual(list: List<T>): Boolean {
        for (i in 1..<list.size) {
            if (list[0] != list[i]) return false
        }
        return true
    }
}
