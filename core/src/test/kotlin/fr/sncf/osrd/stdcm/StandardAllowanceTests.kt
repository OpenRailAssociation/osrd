package fr.sncf.osrd.stdcm

import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class StandardAllowanceTests {
    /** Contains result with and without allowance, with the method above it makes testing easier  */
    @JvmRecord
    data class STDCMAllowanceResults(val withAllowance: STDCMResult?, val withoutAllowance: STDCMResult?)

    /** Test that the path found with a simple allowance is longer than the path we find with no allowance  */
    @Test
    fun testSimpleStandardAllowance() {
        /*
        a --> b --> c --> d
         */
        val infra = DummyInfra()
        val blocks = listOf(
            infra.addBlock("a", "b", 1000.meters, 30.0),
            infra.addBlock("b", "c", 1000.meters, 30.0),
            infra.addBlock("c", "d", 1000.meters, 30.0)
        )
        val allowance = AllowanceValue.Percentage(10.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(1000.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertNotNull(res.withoutAllowance)
        checkAllowanceResult(res, allowance)
    }

    /** Same test as the previous one, with a very high allowance value (1000%)  */
    @Test
    fun testVeryHighStandardAllowance() {
        /*
        a --> b --> c --> d
         */
        val infra = DummyInfra()
        val blocks = listOf(
            infra.addBlock("a", "b", 1000.meters, 30.0),
            infra.addBlock("b", "c", 1000.meters, 30.0),
            infra.addBlock("c", "d", 1000.meters, 30.0)
        )
        val allowance = AllowanceValue.Percentage(1000.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(1000.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertNotNull(res.withoutAllowance)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can add delays to avoid occupied sections with a standard allowance  */
    @Test
    fun testSimpleDelay() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val occupancyGraph = ImmutableMultimap.of(
            secondBlock, OccupancySegment(0.0, 3600.0, 0.meters, 100.meters)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(secondBlock, Offset(50.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance!!)
        Assertions.assertNotNull(res.withAllowance!!)
        val secondBlockEntryTime = (res.withAllowance.departureTime
                + res.withAllowance.envelope.interpolateTotalTime(infra.getBlockLength(firstBlock).distance.meters))
        Assertions.assertTrue(secondBlockEntryTime >= 3600 - TIME_STEP)
        occupancyTest(res.withAllowance, occupancyGraph, TIME_STEP)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can add delays on partial block ranges with a standard allowance  */
    @Test
    fun testBlockRangeOccupancy() {
        /*
        a ------> b

        The block is occupied from a certain point only, we check that we don't add too little or too much delay
         */
        val infra = DummyInfra()
        val block = infra.addBlock("a", "b", 10000.meters)
        val occupancyGraph = ImmutableMultimap.of(
            block, OccupancySegment(0.0, 3600.0, 5000.meters, 10000.meters)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setUnavailableTimes(occupancyGraph)
                .setStartLocations(setOf(EdgeLocation(block, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(block, Offset(10000.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance!!)
        Assertions.assertNotNull(res.withAllowance!!)
        val timeEnterOccupiedSection = (res.withAllowance.departureTime
                + res.withAllowance.envelope.interpolateTotalTime(5000.0))
        Assertions.assertEquals(3600.0, timeEnterOccupiedSection, 2 * TIME_STEP)
        occupancyTest(res.withAllowance, occupancyGraph, 2 * TIME_STEP)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can have both an engineering and a standard allowance  */
    @Test
    fun testEngineeringWithStandardAllowance() {
        /*
        a --> b -----> c --> d

        space
          ^
        d |############### end
          |############### /
          |###############/
        c |           ___/
          |       ___/
        b |   ___/
          |  /#################
        a |_/##################_> time

         */
        val infra = DummyInfra()
        val blocks = listOf(
            infra.addBlock("a", "b", 1000.meters, 30.0),
            infra.addBlock("b", "c", 10000.meters, 30.0),
            infra.addBlock("c", "d", 1000.meters, 30.0)
        )
        val occupancyGraph = ImmutableMultimap.of(
            blocks[0], OccupancySegment(120.0, Double.POSITIVE_INFINITY, 0.meters, 1000.meters),
            blocks[2], OccupancySegment(0.0, 1000.0, 0.meters, 1000.meters)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(1000.meters))))
            .setStandardAllowance(allowance)
            .run()!!
        occupancyTest(res, occupancyGraph, TIME_STEP)
        val thirdBlockEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(11000.0))
        Assertions.assertEquals(1000.0, thirdBlockEntryTime, 4 * TIME_STEP) // Errors build up, we need a high delta
    }

    /** Same test as the previous one, with very short blocks at the start and end  */
    @Test
    fun testEngineeringWithStandardAllowanceSmallBlocks() {
        /*
        a -> b -----> c -> d

        space
          ^
        d |###############
          |############### end
        c |           ___/
          |       ___/
        b |   ___/
          |  /
        a |_/##################_> time

         */
        val infra = DummyInfra()
        val blocks = listOf(
            infra.addBlock("a", "b", 1.meters, 30.0),
            infra.addBlock("b", "c", 10000.meters, 30.0),
            infra.addBlock("c", "d", 1.meters, 30.0)
        )
        val occupancyGraph = ImmutableMultimap.of(
            blocks[0], OccupancySegment(60.0, Double.POSITIVE_INFINITY, 0.meters, 1.meters),
            blocks[2], OccupancySegment(0.0, 1000.0, 0.meters, 1.meters)
        )
        val allowance = AllowanceValue.Percentage(20.0)
        val res = STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(1.meters))))
            .setStandardAllowance(allowance)
            .run()!!
        occupancyTest(res, occupancyGraph, TIME_STEP)
        val thirdBlockEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(10001.0))
        Assertions.assertEquals(1000.0, thirdBlockEntryTime, 3 * TIME_STEP)
    }

    /** This test checks that we add the right delay while backtracking several times, by adding mrsp drops  */
    @Test
    fun testManyMRSPDrops() {
        val infra = DummyInfra()
        val blocks = ArrayList<BlockId>()
        for (i in 0..9) {
            blocks.add(
                infra.addBlock(
                    i.toString(), String.format("%d.5", i),
                    1000.meters,
                    50.0
                )
            )
            blocks.add(
                infra.addBlock(
                    String.format("%d.5", i),
                    (i + 1).toString(),
                    10.meters,
                    5.0
                )
            )
        }
        val allowance = AllowanceValue.Percentage(50.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(blocks[blocks.size - 1], Offset(0.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withAllowance)
        Assertions.assertNotNull(res.withoutAllowance)
        checkAllowanceResult(res, allowance)
    }

    /** We shift de departure time a little more at each block  */
    @Test
    fun testMaximumShiftWithDelays() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |################################ end
          |################################/__________
        d |#################### /         /
          |####################/_________/____________
        c |############# /    /         /
          |#############/____/_________/______________
        b |#####  /    /    /         /
          |#####/     /    /         /
        a start______/____/_________/__________________> time

         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val thirdBlock = infra.addBlock("c", "d")
        val forthBlock = infra.addBlock("d", "e")
        val allowance = AllowanceValue.Percentage(100.0)
        val occupancyGraph = ImmutableMultimap.of(
            firstBlock, OccupancySegment(0.0, 200.0, 0.meters, 100.meters),
            secondBlock, OccupancySegment(0.0, 600.0, 0.meters, 100.meters),
            thirdBlock, OccupancySegment(0.0, 1200.0, 0.meters, 100.meters),
            forthBlock, OccupancySegment(0.0, 2000.0, 0.meters, 100.meters)
        )
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset(1.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        occupancyTest(res.withAllowance!!, occupancyGraph, TIME_STEP)
        checkAllowanceResult(res, allowance)
    }

    /** Test that we can have both an engineering and a standard allowance, with a time per distance allowance  */
    @Test
    fun testEngineeringWithStandardAllowanceTimePerDistance() {
        /*
        a --> b -----> c --> d

        space
          ^
        d |############### end
          |############### /
          |###############/
        c |           ___/
          |       ___/
        b |   ___/
          |  /#################
        a |_/##################_> time

         */
        val infra = DummyInfra()
        val blocks = listOf(
            infra.addBlock("a", "b", 1000.meters, 30.0),
            infra.addBlock("b", "c", 10000.meters, 30.0),
            infra.addBlock("c", "d", 1000.meters, 30.0)
        )
        val occupancyGraph = ImmutableMultimap.of(
            blocks[0], OccupancySegment(120.0, Double.POSITIVE_INFINITY, 0.meters, 1000.meters),
            blocks[2], OccupancySegment(0.0, 1000.0, 0.meters, 1000.meters)
        )
        val allowance = AllowanceValue.TimePerDistance(60.0)
        val res = STDCMPathfindingBuilder()
            .setInfra(infra.fullInfra())
            .setUnavailableTimes(occupancyGraph)
            .setStartLocations(setOf(EdgeLocation(blocks[0], Offset(0.meters))))
            .setEndLocations(setOf(EdgeLocation(blocks[2], Offset(1000.meters))))
            .setStandardAllowance(allowance)
            .run()!!
        occupancyTest(res, occupancyGraph, TIME_STEP)
        val thirdBlockEntryTime = (res.departureTime
                + res.envelope.interpolateTotalTime(11000.0))
        // 2 allowances + the extra safety TIME_STEP added when avoiding conflicts gives us 3 * TIME_STEP
        Assertions.assertEquals(1000.0, thirdBlockEntryTime, 3 * TIME_STEP)
    }

    /** Tests a simple path with no conflict, with a time per distance allowance and very low value  */
    @Test
    fun testSimplePathTimePerDistanceAllowanceLowValue() {
        /*
        a --> b --> c --> d --> e
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        infra.addBlock("b", "c")
        infra.addBlock("c", "d")
        val forthBlock = infra.addBlock("d", "e")
        val allowance = AllowanceValue.TimePerDistance(1.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset(100.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * TIME_STEP)
    }

    /** Tests a simple path with no conflict, with a time per distance allowance  */
    @Test
    fun testSimplePathTimePerDistanceAllowance() {
        /*
        a --> b --> c --> d --> e
         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        infra.addBlock("b", "c")
        infra.addBlock("c", "d")
        val forthBlock = infra.addBlock("d", "e")
        val allowance = AllowanceValue.TimePerDistance(15.0)
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset(100.meters))))
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * TIME_STEP)
    }

    /** We shift de departure time a little more at each block, with a time per distance allowance  */
    @Test
    fun testMaximumShiftWithDelaysTimePerDistance() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |################################ end
          |################################/__________
        d |#################### /         /
          |####################/_________/____________
        c |############# /    /         /
          |#############/____/_________/______________
        b |#####  /    /    /         /
          |#####/     /    /         /
        a start______/____/_________/__________________> time

         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        val thirdBlock = infra.addBlock("c", "d")
        val forthBlock = infra.addBlock("d", "e")
        val allowance = AllowanceValue.TimePerDistance(15.0)
        val occupancyGraph = ImmutableMultimap.of(
            firstBlock, OccupancySegment(0.0, 200.0, 0.meters, 100.meters),
            secondBlock, OccupancySegment(0.0, 600.0, 0.meters, 100.meters),
            thirdBlock, OccupancySegment(0.0, 1200.0, 0.meters, 100.meters),
            forthBlock, OccupancySegment(0.0, 2000.0, 0.meters, 100.meters)
        )
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(forthBlock, Offset(100.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        )
        Assertions.assertNotNull(res.withoutAllowance)
        Assertions.assertNotNull(res.withAllowance)
        occupancyTest(res.withAllowance!!, occupancyGraph, TIME_STEP)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * TIME_STEP)
    }

    /** The path we find must pass through an (almost) exact space-time point at the middle of the path,
     * we check that we can still do this with mareco  */
    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun testMarecoSingleSpaceTimePoint(isTimePerDistance: Boolean) {
        /*
        a --> b --> c --> d --> e

        space
        d ^
          |           end
        c |########## /
          |##########/
        b |         /#################
          |        / #################
        a |_______/__#################> time

         */
        val infra = DummyInfra()
        val firstBlock = infra.addBlock("a", "b", 1000.meters, 30.0)
        val secondBlock = infra.addBlock("b", "c", 1000.meters, 30.0)
        val thirdBlock = infra.addBlock("c", "d")
        var allowance: AllowanceValue = AllowanceValue.Percentage(100.0)
        if (isTimePerDistance)
            allowance = AllowanceValue.TimePerDistance(120.0)
        val occupancyGraph = ImmutableMultimap.of(
            firstBlock, OccupancySegment(2000 + TIME_STEP, Double.POSITIVE_INFINITY, 0.meters, 1000.meters),
            secondBlock, OccupancySegment(0.0, 2000 - TIME_STEP, 0.meters, 1000.meters)
        )
        val res = runWithAndWithoutAllowance(
            STDCMPathfindingBuilder()
                .setInfra(infra.fullInfra())
                .setStartLocations(setOf(EdgeLocation(firstBlock, Offset(0.meters))))
                .setEndLocations(setOf(EdgeLocation(thirdBlock, Offset(100.meters))))
                .setUnavailableTimes(occupancyGraph)
                .setStandardAllowance(allowance)
        )
        Assertions.assertEquals(0.0, res.withAllowance!!.envelope.endSpeed)
        Assertions.assertEquals(0.0, res.withoutAllowance!!.envelope.endSpeed)
        occupancyTest(res.withAllowance, occupancyGraph, 2 * TIME_STEP)

        // We need a high tolerance because there are several binary searches
        checkAllowanceResult(res, allowance, 4 * TIME_STEP)
    }

    companion object {
        private const val TIME_STEP = 2.0

        /** Runs the pathfinding with the given parameters, with and without allowance  */
        @JvmStatic
        fun runWithAndWithoutAllowance(builder: STDCMPathfindingBuilder): STDCMAllowanceResults {
            builder.setTimeStep(TIME_STEP)
            val resultWithAllowance = builder.run()
            builder.setStandardAllowance(null)
            val resultWithoutAllowance = builder.run()
            return STDCMAllowanceResults(
                resultWithAllowance,
                resultWithoutAllowance
            )
        }

        private fun checkAllowanceResult(results: STDCMAllowanceResults, value: AllowanceValue) {
            checkAllowanceResult(results, value, Double.NaN)
        }

        /** Compares the run time with and without allowance, checks that the allowance is properly applied  */
        @JvmStatic
        fun checkAllowanceResult(results: STDCMAllowanceResults, value: AllowanceValue, tolerance: Double) {
            var mutTolerance = tolerance
            if (java.lang.Double.isNaN(mutTolerance))
                mutTolerance = 2 * TIME_STEP
            val baseEnvelope = results.withoutAllowance!!.envelope
            val extraTime = value.getAllowanceTime(baseEnvelope.totalTime, baseEnvelope.totalDistance)
            val baseTime = baseEnvelope.totalTime
            val actualTime = results.withAllowance!!.envelope.totalTime
            Assertions.assertEquals(
                baseTime + extraTime,
                actualTime,
                mutTolerance
            )
        }
    }
}
