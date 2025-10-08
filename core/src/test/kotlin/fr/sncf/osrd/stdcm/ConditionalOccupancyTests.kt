package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertTrue
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class ConditionalOccupancyTests {

    @Test
    fun straightPathSimpleConditionalOccupancyTest() {
        /*
                 #     x
        a --> b --> c --> d

        #: conditional occupancy
        x: occupancy
         */

        val infra = DummyInfra()
        val block1 = infra.addBlock("a", "b")
        val block2 = infra.addBlock("b", "c")
        val unavailableBlock = infra.addBlock("c", "d")
        val occupancyGraph =
            ImmutableMultimap.of(
                block2,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                ),
            )

        // No conflicts
        val res1 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(block2, Offset(50.meters))))
                .run()
        assertNotNull(res1)

        // Conflict
        val res2 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(unavailableBlock, Offset(50.meters))))
                .run()
        assertNull(res2)
    }

    @Test
    fun simpleConditionalOccupancyTest() {
        /*

                 x
                --> d
           #   /
        a --> b --> c

        #: conditional occupancy
        x: occupancy
         */

        val infra = DummyInfra()
        val block1 = infra.addBlock("a", "b")
        val block2 = infra.addBlock("b", "c")
        val unavailableBlock = infra.addBlock("b", "d")
        val occupancyGraph =
            ImmutableMultimap.of(
                block1,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                    block2,
                ),
            )

        // No conflicts
        val res1 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(block2, Offset(50.meters))))
                .run()
        assertNotNull(res1)

        // Conflict
        val res2 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(unavailableBlock, Offset(50.meters))))
                .run()
        assertNull(res2)
    }

    @Test
    fun recursiveConditionalOccupanciesTest() {
        /*
                                         x
                                        --> i
                 #     #     #     #   /
                --> d --> e --> f --> g --> h
           #   /
        a --> b --> c

        #: conditional occupancy
        x: occupancy
         */
        val infra = DummyInfra()
        val block1 = infra.addBlock("a", "b")
        val block2 = infra.addBlock("b", "c")
        val block3 = infra.addBlock("b", "d")
        val block4 = infra.addBlock("d", "e")
        val block5 = infra.addBlock("e", "f")
        val block6 = infra.addBlock("f", "g")
        val block7 = infra.addBlock("g", "h")
        val unavailableBlock = infra.addBlock("g", "i")
        val occupancyGraph =
            ImmutableMultimap.of(
                block1,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                    block2,
                ),
                block3,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                    block7,
                ),
                block4,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                    block7,
                ),
                block5,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                    block7,
                ),
                block6,
                OccupancySegment(
                    0.0,
                    Double.POSITIVE_INFINITY,
                    0.meters,
                    100.meters,
                    unavailableBlock,
                    block7,
                ),
            )

        // End location on b --> c: no conflict
        val res1 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(block2, Offset(50.meters))))
                .run()
        assertNotNull(res1)

        // End location on d --> e: no conflict
        val res2 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(block4, Offset(50.meters))))
                .run()
        assertNotNull(res2)

        // End location on g --> h: no conflict
        val res3 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(block7, Offset(50.meters))))
                .run()
        assertNotNull(res3)

        // End location on g --> i: conflict
        val res4 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(EdgeLocation(unavailableBlock, Offset(50.meters))))
                .run()
        assertNull(res4)
    }

    @Test
    fun avoidConditionalOccupancy() {
        /*
                 #     x
        a --> b --> c --> d

        #: conditional occupancy
        x: occupancy

        Test that we can avoid the occupancy by adding delay
         */

        val infra = DummyInfra()
        val blocks =
            listOf(infra.addBlock("a", "b"), infra.addBlock("b", "c"), infra.addBlock("c", "d"))
        val occupancyGraph =
            ImmutableMultimap.of(
                blocks[0],
                OccupancySegment(0.0, 3600.0, 0.meters, 100.meters, blocks[2]),
            )

        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(50.meters))))
                .run()!!
        assertTrue { res.departureTime + res.envelope.totalTime >= 3600 }
    }

    private fun initBuilder(
        fullInfra: FullInfra,
        occupancyGraph: ImmutableMultimap<BlockId, OccupancySegment>,
        startBlock: BlockId,
    ): STDCMPathfindingBuilder {
        return STDCMPathfindingBuilder()
            .setInfra(fullInfra)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(startBlock, Offset(0.meters))))
    }
}
