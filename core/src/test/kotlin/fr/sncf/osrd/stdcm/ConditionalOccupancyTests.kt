package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.stdcm.preprocessing.OccupancySegment
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertTrue
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
                .setEndLocations(setOf(BlockLocation(block2, Offset(50.meters))))
                .run()
        assertTrue(res1 is STDCMCompleteResult)

        // Conflict
        val res2 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(BlockLocation(unavailableBlock, Offset(50.meters))))
                .run()
        assertTrue(res2 is STDCMPartialResult)
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
                .setEndLocations(setOf(BlockLocation(block2, Offset(50.meters))))
                .run()
        assertTrue(res1 is STDCMCompleteResult)

        // Conflict
        val res2 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(BlockLocation(unavailableBlock, Offset(50.meters))))
                .run()
        assertTrue(res2 is STDCMPartialResult)
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
                .setEndLocations(setOf(BlockLocation(block2, Offset(50.meters))))
                .run()
        assertTrue(res1 is STDCMCompleteResult)

        // End location on d --> e: no conflict
        val res2 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(BlockLocation(block4, Offset(50.meters))))
                .run()
        assertTrue(res2 is STDCMCompleteResult)

        // End location on g --> h: no conflict
        val res3 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(BlockLocation(block7, Offset(50.meters))))
                .run()
        assertTrue(res3 is STDCMCompleteResult)

        // End location on g --> i: conflict
        val res4 =
            initBuilder(infra.fullInfra(), occupancyGraph, block1)
                .setEndLocations(setOf(BlockLocation(unavailableBlock, Offset(50.meters))))
                .run()
        assertTrue(res4 is STDCMPartialResult)
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
                .setStartLocations(setOf(BlockLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(BlockLocation(blocks[2], Offset(50.meters))))
                .run()!!
        assertTrue {
            res is STDCMCompleteResult && res.departureTime + res.envelope.totalTime >= 3600
        }
    }

    private fun initBuilder(
        fullInfra: FullInfra,
        occupancyGraph: ImmutableMultimap<BlockId, OccupancySegment>,
        startBlock: BlockId,
    ): STDCMPathfindingBuilder {
        return STDCMPathfindingBuilder()
            .setInfra(fullInfra)
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(BlockLocation(startBlock, Offset(0.meters))))
    }
}
