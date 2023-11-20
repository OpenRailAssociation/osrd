package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.OccupancySegment
import fr.sncf.osrd.stdcm.preprocessing.implementation.computeUnavailableSpace
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class UnavailableSpaceBuilderTests {
    @Test
    @Throws(Exception::class)
    fun testNoOccupancy() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        val res =
            computeUnavailableSpace(
                infra.rawInfra,
                infra.blockInfra,
                setOf(),
                TestTrains.REALISTIC_FAST_TRAIN,
                0.0,
                0.0
            )
        assertTrue(res.isEmpty)
    }

    @Test
    fun testFirstBlockOccupied() {
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        val secondBlock = infra.addBlock("b", "c", 1000.meters)
        val res = computeUnavailableSpace(
            infra,
            infra,
            setOf(SpacingRequirement("a->b", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        assertEquals(
            setOf(
                OccupancySegment(0.0, 100.0, 0.meters, 1000.meters) // base occupancy
            ),
            res.get(firstBlock)
        )
        assertEquals(
            setOf( // The train needs to have fully cleared the first block,
                // its head can't be in the beginning of the second block
                OccupancySegment(0.0, 100.0, 0.meters, TestTrains.REALISTIC_FAST_TRAIN.getLength().meters)
            ),
            res.get(secondBlock)
        )
    }

    @Test
    fun testSecondBlockOccupied() {
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        val secondBlock = infra.addBlock("b", "c", 1000.meters)
        val res = computeUnavailableSpace(
            infra,
            infra,
            setOf(SpacingRequirement("b->c", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        assertEquals(
            setOf( // This block would display a warning and wouldn't be available
                OccupancySegment(0.0, 100.0, 0.meters, 1000.meters)
            ),
            res.get(firstBlock)
        )
        assertEquals(
            setOf(
                OccupancySegment(0.0, 100.0, 0.meters, 1000.meters) // base occupancy
            ),
            res.get(secondBlock)
        )
    }

    @Test
    fun testBranchingBlocks() {
        /*
        a1        b1
           \      ^
            v    /
            center
            ^    \
           /      v
         a2       b2
         */
        val infra = DummyInfra()
        val a1 = infra.addBlock("a1", "center", 1000.meters)
        val a2 = infra.addBlock("a2", "center", 1000.meters)
        val b1 = infra.addBlock("center", "b1", 1000.meters)
        val b2 = infra.addBlock("center", "b2", 1000.meters)
        val res = computeUnavailableSpace(
            infra,
            infra,
            setOf(SpacingRequirement("center->b1", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        assertEquals(
            setOf(
                OccupancySegment(0.0, 100.0, 0.meters, 1000.meters) // base occupancy
            ),
            res.get(b1)
        )
        assertEquals(
            setOf<OccupancySegment>(),
            res.get(b2)
        )
        assertEquals(
            setOf( // The previous block would display a warning
                OccupancySegment(0.0, 100.0, 0.meters, 1000.meters)
            ),
            res.get(b1)
        )
        assertEquals(res.get(a1), res.get(a2))
    }

    @Test
    fun testThirdBlock() {
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        infra.addBlock("b", "c", 1000.meters)
        infra.addBlock("c", "d", 1000.meters)
        val res = computeUnavailableSpace(
            infra,
            infra,
            setOf(SpacingRequirement("c->d", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        assertEquals(
            setOf( // Second block displays a warning, first block can't be used in the area where
                // the signal of the second block is visible
                OccupancySegment(0.0, 100.0, (1000 - 400).meters, 1000.meters)
            ),
            res.get(firstBlock)
        )
    }

    @Test
    fun testGridMargins() {
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters)
        val secondBlock = infra.addBlock("b", "c", 1000.meters)
        val res = computeUnavailableSpace(
            infra,
            infra,
            setOf(SpacingRequirement("b->c", 100.0, 200.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            20.0,
            60.0
        )
        // TimeStart and TimeEnd should be adjusted because of the margins
        // (20s before and 60s after)
        assertEquals(
            setOf(
                OccupancySegment(80.0, 260.0, 0.meters, 1000.meters)
            ),
            res.get(firstBlock)
        )
        assertEquals(
            setOf(
                OccupancySegment(80.0, 260.0, 0.meters, 1000.meters)
            ),
            res.get(secondBlock)
        )
    }
}
