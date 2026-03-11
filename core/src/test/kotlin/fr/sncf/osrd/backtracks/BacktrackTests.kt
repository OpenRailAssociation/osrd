package fr.sncf.osrd.backtracks

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.path_properties.makePathPropResponse
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.path.implementations.PartialBlockRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.splitAtBacktracks
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.standalone_sim.runStandaloneSimulation
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN
import fr.sncf.osrd.utils.Helpers.fullInfraFromFile
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import fr.sncf.osrd.utils.units.sumDistances
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.api.Disabled

/**
 * This class takes one fixed path that contains backtracks, and tests most parts of the codebase to
 * see if anything breaks. It doesn't include the pathfinding, the path is written by hand.
 *
 * The path tested is made so that route transitions, block transitions, and path begin/end line up
 * as little as possible. It makes it easier to catch offset errors.
 *
 * ```
 *     start at offset      backtrack at offset
 *     100m on a1->a2       3500m on a3->c2
 *     3100m on t.a         2500m on t.center
 *            v                      v
 *            =======================>
 *
 * op.a  s.a1   s.a2  s.a3
 * op______≷______≷____>>__
 *            t.a          \
 * op.b  s.b1    s.b2 s.b3  \    s.c1  s.c2  s.c3   s.c4  s.c5
 * op______≷______≷____>>____+____<<____>______<_____>_____<___op|
 *            t.b                         t.center             op.c
 *
 *           <======================
 *           ^                     ^
 *       end at offset        resume 400m back
 *       2600m on b2->b1      (length of the RS)
 *       3400 on t.b          2900m on c3->c1
 *                            2100m on t.center
 *
 * ```
 */
class BacktrackTests {

    val infra = fullInfraFromFile("y_infra/infra.json")
    val rollingStock: RollingStock = REALISTIC_FAST_TRAIN
    val path = buildPath(infra, rollingStock.length.meters)

    private fun buildPath(infra: FullInfra, rollingStockLength: Distance): TrainPath {
        val firstSignalNameList = listOf("s.right.a1", "s.right.a2", "s.right.a3", "s.right.c2")
        val secondSignalNameList = listOf("s.left.c3", "s.left.c1", "s.left.b2", "s.left.b1")

        fun signalsToBlocks(signalNameList: List<String>): List<Pair<BlockId, Length<Block>>> {
            val nameToSignal =
                infra.rawInfra.logicalSignals.associateBy { signalId ->
                    infra.rawInfra.getLogicalSignalName(signalId)
                }
            val signalList = signalNameList.map { nameToSignal[it]!! }
            val signalPairs = (signalList.dropLast(1) zip signalList.drop(1)).map { it.toList() }
            val signalPairToBlock =
                infra.blockInfra.blocks.associateBy { infra.blockInfra.getBlockSignals(it) }
            return signalPairs.map {
                val signalId = signalPairToBlock[it]!!
                Pair(signalId, infra.blockInfra.getBlockLength(signalId))
            }
        }
        val firstBlocks = signalsToBlocks(firstSignalNameList)
        val secondBlocks = signalsToBlocks(secondSignalNameList)

        // This is verbose, but it makes it easier to follow along
        val blockRanges =
            listOf(
                // a1 -> a2
                PartialBlockRange(
                    firstBlocks[0].first,
                    Offset(100.meters), // Start at offset 100m on first block
                    firstBlocks[0].second,
                    firstBlocks[0].second,
                ),
                // a2 -> a3
                PartialBlockRange(
                    firstBlocks[1].first,
                    Offset(0.meters),
                    firstBlocks[1].second,
                    firstBlocks[1].second,
                ),
                // a3 -> c2
                PartialBlockRange(
                    firstBlocks[2].first,
                    Offset(0.meters),
                    // Last block before backtrack ends at c2 (offset 3000m), and backtrack is at
                    // offset 2500m
                    firstBlocks[2].second - (3000.meters - 2500.meters),
                    firstBlocks[2].second,
                ),
                // Backtrack there: on track t.center at offset 2500m
                // c3 -> c1
                PartialBlockRange(
                    secondBlocks[0].first,
                    // c3 is at offset 5000m, 400m of train length
                    Offset(5000.meters - 2500.meters + rollingStockLength),
                    secondBlocks[0].second,
                    secondBlocks[0].second,
                ),
                // c1 -> b2
                PartialBlockRange(
                    secondBlocks[1].first,
                    Offset(0.meters),
                    secondBlocks[1].second,
                    secondBlocks[1].second,
                ),
                // b2 -> b1
                PartialBlockRange(
                    secondBlocks[2].first,
                    Offset(0.meters),
                    secondBlocks[2].second - 400.meters, // stop 400m before the end of the block
                    secondBlocks[2].second,
                ),
            )
        val backtrackLocation =
            Offset<PhysicsPath>(blockRanges.subList(0, 3).map { it.length }.sumDistances())

        return buildTrainPathFromBlockRanges(
            infra.rawInfra,
            infra.blockInfra,
            buildRangeList(blockRanges),
            routeNames =
                listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.bf.c->det.c1", "rt.det.c1->bf.b"),
            backtrackLocations = listOf(backtrackLocation),
        )
    }

    @Test
    fun testPathProperties() {
        // Smoke test, we only test for uncaught exceptions and failed asserts
        makePathPropResponse(path, infra.rawInfra)
    }

    @Test
    fun testPathSplit() {
        val paths = path.splitAtBacktracks()
        assertEquals(2, paths.size)
        val first = paths[0]
        val second = paths[1]

        assertEquals(first.getLength(), path.getBacktrackLocations().single())
        assertEquals(path.getLength(), first.getLength() + second.getLength().distance)
        assertEquals(path.getRoutes().size, first.getRoutes().size + second.getRoutes().size)

        val firstBlockRanges = first.getBlocks()
        val secondBlockRanges = second.getBlocks()
        val allBlockRanges = path.getBlocks()
        assertEquals(allBlockRanges.size, firstBlockRanges.size + secondBlockRanges.size)

        val firstBlocks = firstBlockRanges.map { it.value }.toSet()
        val secondBlocks = secondBlockRanges.map { it.value }.toSet()
        val allBlocks = allBlockRanges.map { it.value }.toSet()
        assert(firstBlocks.intersect(secondBlocks).isEmpty())
        assertEquals(allBlocks, firstBlocks.union(secondBlocks))
    }

    @Test
    @Disabled("Not working yet")
    fun testSimulation() {
        // Smoke test, we only test for uncaught exceptions and failed asserts
        runStandaloneSimulation(
            infra = infra,
            trainPath = path,
            rollingStock = REALISTIC_FAST_TRAIN,
            comfort = Comfort.STANDARD,
            constraintDistribution = RJSAllowanceDistribution.LINEAR,
            speedLimitTag = null,
            powerRestrictions = distanceRangeMapOf(),
            useElectricalProfiles = false,
            useSpeedLimits = true,
            timeStep = 2.0,
            schedule =
                listOf(
                    SimulationScheduleItem(Offset(9400.meters), null, 60.seconds, SHORT_SLIP_STOP),
                    SimulationScheduleItem(Offset(18100.meters), null, 0.seconds, OPEN),
                ),
            initialSpeed = 0.0,
            margins = RangeValues(),
            pathItemPositions = listOf(Offset(9400.meters), Offset(18100.meters)),
        )
    }
}
