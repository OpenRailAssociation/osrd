package fr.sncf.osrd.backtracks

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.RJSRoutingRequirement
import fr.sncf.osrd.api.RJSRoutingZoneRequirement
import fr.sncf.osrd.api.RJSSpacingRequirement
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.SignalCriticalPosition
import fr.sncf.osrd.api.path_properties.makePathPropResponse
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.standalone_sim.StopDetails
import fr.sncf.osrd.conflicts.PathStop
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.implementations.PartialBlockRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.splitAtBacktracks
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.STOP
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.standalone_sim.ZoneOccupationChangeEvent
import fr.sncf.osrd.standalone_sim.getSignalCriticalPositions
import fr.sncf.osrd.standalone_sim.runStandaloneSimulation
import fr.sncf.osrd.standalone_sim.zoneOccupationChangeEvents
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.Helpers.fullInfraFromFile
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.offsetRangeMapOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import fr.sncf.osrd.utils.units.sumDistances
import kotlin.test.Test
import kotlin.test.assertEquals

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

    private fun signalsToBlocks(signalNameList: List<String>): List<Pair<BlockId, Length<Block>>> {
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

    // Backtracking fully inside a unique detection zone, but just before backtracking, head is
    // in-sight of the next signal.
    private fun buildPathBacktrackingOverNothing(
        infra: FullInfra,
        rollingStockLength: Distance,
    ): TrainPath {
        val firstSignalNameList = listOf("s.right.a1", "s.right.a2", "s.right.a3", "s.right.c2")
        val secondSignalNameList = listOf("s.left.c3", "s.left.c1", "s.left.b2", "s.left.b1")

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
                    // offset 2800m
                    firstBlocks[2].second - (3000.meters - 2800.meters),
                    firstBlocks[2].second,
                ),
                // Backtrack there: on track t.center at offset 2800m, within sight-distance of the
                // next signal just before backtracking.
                // c3 -> c1
                PartialBlockRange(
                    secondBlocks[0].first,
                    // c3 is at offset 5000m, 400m of train length
                    Offset(5000.meters - 2800.meters + rollingStockLength),
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
            listOf(backtrackLocation),
            routeNames =
                listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.bf.c->det.c1", "rt.det.c1->bf.b"),
        )
    }

    // Backtracking with the queue over a route delimiter (signal is at the same place as detector).
    // So over multiple detection zones and the head passed the signal at the restart, not seeing
    // it.
    private fun buildPathBacktrackingOverRouteDelimiter(
        infra: FullInfra,
        rollingStockLength: Distance,
    ): TrainPath {
        val firstSignalNameList = listOf("s.right.a1", "s.right.a2", "s.right.a3", "s.right.c2")
        val secondSignalNameList = listOf("s.left.c3", "s.left.c1", "s.left.b2", "s.left.b1")

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
                    // offset 1100m
                    firstBlocks[2].second - (3000.meters - 1100.meters),
                    firstBlocks[2].second,
                ),
                // Backtrack there: on track t.center at offset 1100m, so that the tail is over the
                // signal (head passed it).
                // c1 -> b2
                PartialBlockRange(
                    secondBlocks[1].first,
                    // c1 is at offset 1000m, 400m of train length
                    Offset(1000.meters - 1100.meters + rollingStockLength),
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
            listOf(backtrackLocation),
            routeNames = listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.det.c1->bf.b"),
        )
    }

    // Backtracking shortly after route delimiter, in a single detection zone.
    // But at the restart, head is seeing the signal, already closer to it than signal's
    // sight-distance.
    // The final stop of the train is also with sight-distance of the last signal.
    private fun buildPathBacktrackingShortlyAfterRouteDelimiter(
        infra: FullInfra,
        rollingStockLength: Distance,
    ): TrainPath {
        val firstSignalNameList = listOf("s.right.a1", "s.right.a2", "s.right.a3", "s.right.c2")
        val secondSignalNameList = listOf("s.left.c3", "s.left.c1", "s.left.b2", "s.left.b1")

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
                    // offset 1500m
                    firstBlocks[2].second - (3000.meters - 1500.meters),
                    firstBlocks[2].second,
                ),
                // Backtrack there: on track t.center at offset 1500m, so that the restart is within
                // sight-distance of the signal
                // c3 -> c1
                PartialBlockRange(
                    secondBlocks[0].first,
                    // c3 is at offset 5000m, 400m of train length
                    Offset(5000.meters - 1500.meters + rollingStockLength),
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
                    secondBlocks[2].second -
                        100.meters, // stop 100m before the end of the block, within sight-distance
                    // of the signal
                    secondBlocks[2].second,
                ),
            )
        val backtrackLocation =
            Offset<PhysicsPath>(blockRanges.subList(0, 3).map { it.length }.sumDistances())

        return buildTrainPathFromBlockRanges(
            infra.rawInfra,
            infra.blockInfra,
            buildRangeList(blockRanges),
            listOf(backtrackLocation),
            routeNames =
                listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.bf.c->det.c1", "rt.det.c1->bf.b"),
        )
    }

    @Test
    fun testPathProperties() {
        // Smoke test, we only test for uncaught exceptions and failed asserts
        makePathPropResponse(
            buildPathBacktrackingOverNothing(infra, rollingStock.length.meters),
            infra.rawInfra,
        )
    }

    @Test
    fun testPathSplit() {
        val path = buildPathBacktrackingOverNothing(infra, rollingStock.length.meters)
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

    data class ZoneOccupation(val entry: Offset<PhysicsPath>, var exit: Offset<PhysicsPath>?)

    fun getZoneOccupations(
        zoneOccupationChangeEvents: List<ZoneOccupationChangeEvent>
    ): Map<ZoneId, List<ZoneOccupation>> {
        val mapZoneOccupations = mutableMapOf<ZoneId, MutableList<ZoneOccupation>>()
        zoneOccupationChangeEvents.forEach { event ->
            val updated = mapZoneOccupations.getOrDefault(event.zone, mutableListOf())
            if (event.isEntry) {
                val lastOccupation = updated.lastOrNull()
                // A zone is never entered twice in a row
                assert(lastOccupation == null || lastOccupation.exit != null)
                updated.addLast(ZoneOccupation(event.offset, null))
            } else {
                // A zone is always entered before exited
                assert(updated.last().exit == null)
                updated.last().exit = event.offset
            }
            mapZoneOccupations[event.zone] = updated
        }
        return mapZoneOccupations
    }

    private fun computeMrspWithStops(path: TrainPath, stops: List<TrainStop>): EnvelopeStopWrapper {
        val mrsp = computeMRSP(path, rollingStock, true, null, null, distanceRangeMapOf(), true)
        return EnvelopeStopWrapper(mrsp, stops)
    }

    @Test
    fun testZoneOccupationBacktrackOverNothing() {
        val path = buildPathBacktrackingOverNothing(infra, rollingStock.length.meters)
        val rollingStocks =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(
                    0.meters,
                    path.length.meters,
                    rollingStock as PhysicsRollingStock,
                )
            )
        val stops = listOf(TrainStop(9700.0, 60.0, SHORT_SLIP_STOP), TrainStop(18700.0, 0.0, OPEN))
        val envelope = computeMrspWithStops(path, stops)
        val zoneOccupationChangeEvents = zoneOccupationChangeEvents(path, envelope, rollingStocks)

        assertEquals(
            mapOf(
                Pair(ZoneId(1u), listOf(ZoneOccupation(Offset(0.meters), Offset(3300.meters)))),
                Pair(ZoneId(2u), listOf(ZoneOccupation(Offset(2900.meters), Offset(6300.meters)))),
                Pair(
                    ZoneId(3u),
                    listOf(
                        ZoneOccupation(Offset(5900.meters), Offset(8300.meters)),
                        ZoneOccupation(Offset(11100.meters), Offset(13500.meters)),
                    ),
                ),
                Pair(ZoneId(7u), listOf(ZoneOccupation(Offset(7900.meters), Offset(11500.meters)))),
                Pair(
                    ZoneId(6u),
                    listOf(ZoneOccupation(Offset(13100.meters), Offset(16500.meters))),
                ),
                Pair(
                    ZoneId(5u),
                    listOf(ZoneOccupation(Offset(16100.meters), Offset(19100.meters))),
                ),
            ),
            getZoneOccupations(zoneOccupationChangeEvents),
        )
        assertEquals(
            ZoneOccupationChangeEvent(99.600.seconds, Offset(8300.meters), false, ZoneId(3u)),
            zoneOccupationChangeEvents[6],
        )
        // check that stop time is correctly considered
        assertEquals(
            ZoneOccupationChangeEvent(193.201.seconds, Offset(11100.meters), true, ZoneId(3u)),
            zoneOccupationChangeEvents[7],
        )

        assertEquals(
            ZoneOccupationChangeEvent(94.800.seconds, Offset(7900.meters), true, ZoneId(7u)),
            zoneOccupationChangeEvents[5],
        )
        // check that stop time is correctly considered
        assertEquals(
            ZoneOccupationChangeEvent(198.001.seconds, Offset(11500.meters), false, ZoneId(7u)),
            zoneOccupationChangeEvents[8],
        )
    }

    @Test
    fun testZoneOccupationBacktrackingOverRouteDelimiter() {
        val path = buildPathBacktrackingOverRouteDelimiter(infra, rollingStock.length.meters)
        val rollingStocks =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(
                    0.meters,
                    path.length.meters,
                    rollingStock as PhysicsRollingStock,
                )
            )
        val stops = listOf(TrainStop(8000.0, 60.0, SHORT_SLIP_STOP), TrainStop(15300.0, 0.0, OPEN))
        val envelope = computeMrspWithStops(path, stops)
        val zoneOccupationChangeEvents = zoneOccupationChangeEvents(path, envelope, rollingStocks)

        assertEquals(
            mapOf(
                Pair(ZoneId(1u), listOf(ZoneOccupation(Offset(0.meters), Offset(3300.meters)))),
                Pair(ZoneId(2u), listOf(ZoneOccupation(Offset(2900.meters), Offset(6300.meters)))),
                Pair(ZoneId(3u), listOf(ZoneOccupation(Offset(5900.meters), Offset(10100.meters)))),
                Pair(ZoneId(7u), listOf(ZoneOccupation(Offset(7900.meters), Offset(8100.meters)))),
                Pair(ZoneId(6u), listOf(ZoneOccupation(Offset(9700.meters), Offset(13100.meters)))),
                Pair(
                    ZoneId(5u),
                    listOf(ZoneOccupation(Offset(12700.meters), Offset(15700.meters))),
                ),
            ),
            getZoneOccupations(zoneOccupationChangeEvents),
        )
        assertEquals(
            ZoneOccupationChangeEvent(94.800.seconds, Offset(7900.meters), true, ZoneId(7u)),
            zoneOccupationChangeEvents[5],
        )
        // check that stop time is correctly considered
        assertEquals(
            ZoneOccupationChangeEvent(157.200.seconds, Offset(8100.meters), false, ZoneId(7u)),
            zoneOccupationChangeEvents[6],
        )
    }

    @Test
    fun testZoneOccupationBacktrackShortlyAfterRouteDelimiter() {
        val path =
            buildPathBacktrackingShortlyAfterRouteDelimiter(infra, rollingStock.length.meters)
        val rollingStocks =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(
                    0.meters,
                    path.length.meters,
                    rollingStock as PhysicsRollingStock,
                )
            )
        val stops = listOf(TrainStop(8400.0, 60.0, STOP), TrainStop(16400.0, 0.0, OPEN))
        val envelope = computeMrspWithStops(path, stops)
        val zoneOccupationChangeEvents = zoneOccupationChangeEvents(path, envelope, rollingStocks)

        assertEquals(
            mapOf(
                Pair(ZoneId(1u), listOf(ZoneOccupation(Offset(0.meters), Offset(3300.meters)))),
                Pair(ZoneId(2u), listOf(ZoneOccupation(Offset(2900.meters), Offset(6300.meters)))),
                Pair(
                    ZoneId(3u),
                    listOf(
                        ZoneOccupation(Offset(5900.meters), Offset(8300.meters)),
                        ZoneOccupation(Offset(8500.meters), Offset(10900.meters)),
                    ),
                ),
                Pair(ZoneId(7u), listOf(ZoneOccupation(Offset(7900.meters), Offset(8900.meters)))),
                Pair(
                    ZoneId(6u),
                    listOf(ZoneOccupation(Offset(10500.meters), Offset(13900.meters))),
                ),
                Pair(
                    ZoneId(5u),
                    listOf(ZoneOccupation(Offset(13500.meters), Offset(16800.meters))),
                ),
            ),
            getZoneOccupations(zoneOccupationChangeEvents),
        )
        assertEquals(
            ZoneOccupationChangeEvent(99.600.seconds, Offset(8300.meters), false, ZoneId(3u)),
            zoneOccupationChangeEvents[6],
        )
        // check that stop time is correctly considered
        assertEquals(
            ZoneOccupationChangeEvent(162.seconds, Offset(8500.meters), true, ZoneId(3u)),
            zoneOccupationChangeEvents[7],
        )

        assertEquals(
            ZoneOccupationChangeEvent(94.800.seconds, Offset(7900.meters), true, ZoneId(7u)),
            zoneOccupationChangeEvents[5],
        )
        // check that stop time is correctly considered
        assertEquals(
            ZoneOccupationChangeEvent(166.800.seconds, Offset(8900.meters), false, ZoneId(7u)),
            zoneOccupationChangeEvents[8],
        )
    }

    @Test
    fun testSignalCriticalPositionBacktrackingOverNothing() {
        val path = buildPathBacktrackingOverNothing(infra, rollingStock.length.meters)
        val stops = listOf(TrainStop(9700.0, 60.0, SHORT_SLIP_STOP), TrainStop(18700.0, 0.0, OPEN))
        val envelope = computeMrspWithStops(path, stops)

        val pos =
            getSignalCriticalPositions(
                infra,
                envelope,
                path,
                stops
                    .filter { it.receptionSignal.isStopOnClosedSignal }
                    .map { PathStop(Offset(it.position.meters), it.receptionSignal) },
            )
        assertEquals(
            listOf(
                SignalCriticalPosition("s.right.a2", 30.seconds, Offset(2500.meters), "VL"),
                SignalCriticalPosition("s.right.a3", 66.seconds, Offset(5500.meters), "VL"),
                SignalCriticalPosition("s.left.c1", 188.401.seconds, Offset(10700.meters), "VL"),
                SignalCriticalPosition("s.left.b2", 248.401.seconds, Offset(15700.meters), "VL"),
            ),
            pos,
        )
    }

    @Test
    fun testSignalCriticalPositionBacktrackingOverRouteDelimiter() {
        val path = buildPathBacktrackingOverRouteDelimiter(infra, rollingStock.length.meters)
        val stops = listOf(TrainStop(8000.0, 60.0, SHORT_SLIP_STOP), TrainStop(15300.0, 0.0, OPEN))
        val envelope = computeMrspWithStops(path, stops)

        val pos =
            getSignalCriticalPositions(
                infra,
                envelope,
                path,
                stops
                    .filter { it.receptionSignal.isStopOnClosedSignal }
                    .map { PathStop(Offset(it.position.meters), it.receptionSignal) },
            )
        assertEquals(
            listOf(
                SignalCriticalPosition("s.right.a2", 30.seconds, Offset(2500.meters), "VL"),
                SignalCriticalPosition("s.right.a3", 66.seconds, Offset(5500.meters), "VL"),
                SignalCriticalPosition("s.left.b2", 207.601.seconds, Offset(12300.meters), "VL"),
            ),
            pos,
        )
    }

    @Test
    fun testSignalCriticalPositionBacktrackingShortlyAfterRouteDelimiter() {
        val path =
            buildPathBacktrackingShortlyAfterRouteDelimiter(infra, rollingStock.length.meters)
        val stops = listOf(TrainStop(8400.0, 60.0, STOP), TrainStop(16400.0, 0.0, OPEN))
        val envelope = computeMrspWithStops(path, stops)

        val pos =
            getSignalCriticalPositions(
                infra,
                envelope,
                path,
                stops
                    .filter { it.receptionSignal.isStopOnClosedSignal }
                    .map { PathStop(Offset(it.position.meters), it.receptionSignal) },
            )
        assertEquals(
            listOf(
                SignalCriticalPosition("s.right.a2", 30.seconds, Offset(2500.meters), "VL"),
                SignalCriticalPosition("s.right.a3", 66.seconds, Offset(5500.meters), "VL"),
                // Start seeing the signal only after backtracking
                SignalCriticalPosition("s.left.c1", 140.800.seconds, Offset(8400.meters), "VL"),
                SignalCriticalPosition("s.left.b2", 217.201.seconds, Offset(13100.meters), "VL"),
            ),
            pos,
        )
    }

    @Test
    fun testSimulationBacktrackingOverNothing() {
        val path = buildPathBacktrackingOverNothing(infra, rollingStock.length.meters)
        val resp =
            runStandaloneSimulation(
                infra = infra,
                trainPath = path,
                rollingStock = REALISTIC_FAST_TRAIN,
                comfort = Comfort.STANDARD,
                constraintDistribution = RJSAllowanceDistribution.LINEAR,
                speedLimitTag = null,
                powerRestrictions = offsetRangeMapOf(),
                useElectricalProfiles = false,
                useSpeedLimits = true,
                timeStep = 2.0,
                schedule =
                    listOf(
                        SimulationScheduleItem(
                            Offset(9700.meters),
                            null,
                            StopDetails(60.seconds, SHORT_SLIP_STOP, false),
                        ),
                        SimulationScheduleItem(
                            Offset(18700.meters),
                            null,
                            StopDetails(0.seconds, OPEN, false),
                        ),
                    ),
                initialSpeed = 0.0,
                margins = RangeValues(),
            )
        assertEquals(Offset(18700.meters), resp.finalOutput.positions.last())

        val backtrackingArrivalTime = 301.914.seconds
        val backtrackingDepartureTime = backtrackingArrivalTime + 60.seconds
        assertEquals(backtrackingArrivalTime, resp.finalOutput.pathItemTimes.first())
        val finalTime = 731.665.seconds
        assertEquals(finalTime, resp.finalOutput.pathItemTimes.last())
        assertEquals(finalTime, resp.finalOutput.times.last())
        assertEquals(
            listOf(
                RJSRoutingRequirement( // regular route at the start of the path
                    "rt.bf.a->det.a3",
                    0.seconds,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a1:INCREASING, det.a2:DECREASING]",
                            "INCREASING:det.a1",
                            "INCREASING:det.a2",
                            mapOf(),
                            126.463.seconds, // end of zone occupation
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.a2:INCREASING, det.a3:DECREASING]",
                            "INCREASING:det.a2",
                            "INCREASING:det.a3",
                            mapOf(),
                            182.153.seconds, // end of zone occupation
                        ),
                    ),
                ),
                RJSRoutingRequirement( // route occupied before backtracking
                    "rt.det.a3->bf.c",
                    108.618.seconds, // 1 signal upstream before entering route
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                            "INCREASING:det.a3",
                            "INCREASING:det.c1",
                            mapOf("switch" to "A_B1"),
                            224.235.seconds, // end of zone occupation
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.c1:INCREASING, det.c2:DECREASING]",
                            "INCREASING:det.c1",
                            "INCREASING:det.c2",
                            mapOf(),
                            backtrackingDepartureTime,
                        ),
                    ),
                ),
                RJSRoutingRequirement( // route occupied after backtracking
                    "rt.bf.c->det.c1",
                    backtrackingDepartureTime,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.c1:INCREASING, det.c2:DECREASING]",
                            "DECREASING:det.c2",
                            "DECREASING:det.c1",
                            mapOf(),
                            533.269.seconds, // end of zone occupation
                        )
                    ),
                ),
                RJSRoutingRequirement( // regular last route of a path
                    "rt.det.c1->bf.b",
                    // first seen signal is the entry (should have been 1 signal upstream if it had
                    // been seen)
                    506.655.seconds,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                            "DECREASING:det.c1",
                            "DECREASING:det.b3",
                            mapOf("switch" to "A_B2"),
                            580.905.seconds,
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.b2:INCREASING, det.b3:DECREASING]",
                            "DECREASING:det.b3",
                            "DECREASING:det.b2",
                            mapOf(),
                            637.857.seconds,
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.b1:INCREASING, det.b2:DECREASING]",
                            "DECREASING:det.b2",
                            "DECREASING:det.b1",
                            mapOf(),
                            finalTime,
                        ),
                    ),
                ),
            ),
            resp.finalOutput.routingRequirements,
        )
        assertEquals(
            listOf(
                RJSSpacingRequirement(
                    "zone.[det.a1:INCREASING, det.a2:DECREASING]",
                    0.seconds,
                    126.463.seconds,
                ),
                RJSSpacingRequirement(
                    "zone.[det.a2:INCREASING, det.a3:DECREASING]",
                    108.618.seconds,
                    182.153.seconds,
                ),
                RJSSpacingRequirement(
                    "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                    108.618.seconds,
                    224.235.seconds,
                ),
                RJSSpacingRequirement(
                    "zone.[det.c1:INCREASING, det.c2:DECREASING]",
                    108.618.seconds,
                    533.269.seconds,
                ),
                RJSSpacingRequirement(
                    "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                    506.655.seconds,
                    580.905.seconds,
                ),
                RJSSpacingRequirement(
                    "zone.[det.b2:INCREASING, det.b3:DECREASING]",
                    506.655.seconds,
                    637.857.seconds,
                ),
                RJSSpacingRequirement(
                    "zone.[det.b1:INCREASING, det.b2:DECREASING]",
                    506.655.seconds,
                    finalTime,
                ),
            ),
            resp.finalOutput.spacingRequirements,
        )
    }

    @Test
    fun testSimulationBacktrackingOverRouteDelimiter() {
        val path = buildPathBacktrackingOverRouteDelimiter(infra, rollingStock.length.meters)
        val resp =
            runStandaloneSimulation(
                infra = infra,
                trainPath = path,
                rollingStock = REALISTIC_FAST_TRAIN,
                comfort = Comfort.STANDARD,
                constraintDistribution = RJSAllowanceDistribution.LINEAR,
                speedLimitTag = null,
                powerRestrictions = offsetRangeMapOf(),
                useElectricalProfiles = false,
                useSpeedLimits = true,
                timeStep = 2.0,
                schedule =
                    listOf(
                        SimulationScheduleItem(
                            Offset(8000.meters),
                            null,
                            StopDetails(60.seconds, SHORT_SLIP_STOP, false),
                        ),
                        SimulationScheduleItem(
                            Offset(15300.meters),
                            null,
                            StopDetails(0.seconds, OPEN, false),
                        ),
                    ),
                initialSpeed = 0.0,
                margins = RangeValues(),
            )
        assertEquals(Offset(15300.meters), resp.finalOutput.positions.last())

        val backtrackingArrivalTime = 269.094.seconds
        val backtrackingDepartureTime = backtrackingArrivalTime + 60.seconds
        assertEquals(backtrackingArrivalTime, resp.finalOutput.pathItemTimes.first())
        val finalTime = 748.193.seconds
        assertEquals(finalTime, resp.finalOutput.pathItemTimes.last())
        assertEquals(finalTime, resp.finalOutput.times.last())
        assertEquals(
            listOf(
                RJSRoutingRequirement( // regular route at the start of the path
                    "rt.bf.a->det.a3",
                    0.seconds,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a1:INCREASING, det.a2:DECREASING]",
                            "INCREASING:det.a1",
                            "INCREASING:det.a2",
                            mapOf(),
                            126.463.seconds, // end of zone occupation
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.a2:INCREASING, det.a3:DECREASING]",
                            "INCREASING:det.a2",
                            "INCREASING:det.a3",
                            mapOf(),
                            186.632.seconds, // end of zone occupation
                        ),
                    ),
                ),
                RJSRoutingRequirement( // route occupied before backtracking
                    "rt.det.a3->bf.c",
                    108.618.seconds, // 1 signal upstream before entering route
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                            "INCREASING:det.a3",
                            "INCREASING:det.c1",
                            mapOf("switch" to "A_B1"),
                            backtrackingDepartureTime,
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.c1:INCREASING, det.c2:DECREASING]",
                            "INCREASING:det.c1",
                            "INCREASING:det.c2",
                            mapOf(),
                            backtrackingDepartureTime,
                        ),
                    ),
                ),
                RJSRoutingRequirement( // route occupied after backtracking and last route of path
                    "rt.det.c1->bf.b",
                    backtrackingDepartureTime,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                            "DECREASING:det.c1",
                            "DECREASING:det.b3",
                            mapOf("switch" to "A_B2"),
                            556.635.seconds,
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.b2:INCREASING, det.b3:DECREASING]",
                            "DECREASING:det.b3",
                            "DECREASING:det.b2",
                            mapOf(),
                            654.382.seconds, // impacted by short-slip stop slowdown
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.b1:INCREASING, det.b2:DECREASING]",
                            "DECREASING:det.b2",
                            "DECREASING:det.b1",
                            mapOf(),
                            finalTime,
                        ),
                    ),
                ),
            ),
            resp.finalOutput.routingRequirements,
        )
    }

    @Test
    fun testSimulationBacktrackingShortlyAfterRouteDelimiter() {
        val path =
            buildPathBacktrackingShortlyAfterRouteDelimiter(infra, rollingStock.length.meters)
        val resp =
            runStandaloneSimulation(
                infra = infra,
                trainPath = path,
                rollingStock = REALISTIC_FAST_TRAIN,
                comfort = Comfort.STANDARD,
                constraintDistribution = RJSAllowanceDistribution.LINEAR,
                speedLimitTag = null,
                powerRestrictions = offsetRangeMapOf(),
                useElectricalProfiles = false,
                useSpeedLimits = true,
                timeStep = 2.0,
                schedule =
                    listOf(
                        SimulationScheduleItem(
                            Offset(8400.meters),
                            null,
                            StopDetails(60.seconds, STOP, false),
                        ),
                        SimulationScheduleItem(
                            Offset(16400.meters),
                            null,
                            StopDetails(0.seconds, OPEN, false),
                        ),
                    ),
                initialSpeed = 0.0,
                margins = RangeValues(),
            )
        assertEquals(Offset(16400.meters), resp.finalOutput.positions.last())

        val backtrackingArrivalTime = 276.282.seconds
        val backtrackingDepartureTime = backtrackingArrivalTime + 60.seconds
        assertEquals(backtrackingArrivalTime, resp.finalOutput.pathItemTimes.first())
        val finalTime = 688.374.seconds
        assertEquals(finalTime, resp.finalOutput.pathItemTimes.last())
        assertEquals(finalTime, resp.finalOutput.times.last())
        assertEquals(
            listOf(
                RJSRoutingRequirement( // regular route at the start of the path
                    "rt.bf.a->det.a3",
                    0.seconds,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a1:INCREASING, det.a2:DECREASING]",
                            "INCREASING:det.a1",
                            "INCREASING:det.a2",
                            mapOf(),
                            126.463.seconds, // end of zone occupation
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.a2:INCREASING, det.a3:DECREASING]",
                            "INCREASING:det.a2",
                            "INCREASING:det.a3",
                            mapOf(),
                            184.631.seconds, // end of zone occupation
                        ),
                    ),
                ),
                RJSRoutingRequirement( // route occupied before backtracking
                    "rt.det.a3->bf.c",
                    108.618.seconds, // 1 signal upstream before entering route
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                            "INCREASING:det.a3",
                            "INCREASING:det.c1",
                            mapOf("switch" to "A_B1"),
                            256.282.seconds, // end of zone occupation
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.c1:INCREASING, det.c2:DECREASING]",
                            "INCREASING:det.c1",
                            "INCREASING:det.c2",
                            mapOf(),
                            backtrackingDepartureTime,
                        ),
                    ),
                ),
                RJSRoutingRequirement( // route occupied after backtracking
                    "rt.bf.c->det.c1",
                    backtrackingDepartureTime,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.c1:INCREASING, det.c2:DECREASING]",
                            "DECREASING:det.c2",
                            "DECREASING:det.c1",
                            mapOf(),
                            382.677.seconds, // end of zone occupation
                        )
                    ),
                ),
                RJSRoutingRequirement( // regular last route of a path
                    "rt.det.c1->bf.b",
                    // first seen signal is the entry, in sight when restarting after backtracking
                    // and required 20 s before restart on closed signal
                    backtrackingDepartureTime - 20.seconds,
                    listOf(
                        RJSRoutingZoneRequirement(
                            "zone.[det.a3:INCREASING, det.b3:INCREASING, det.c1:DECREASING]",
                            "DECREASING:det.c1",
                            "DECREASING:det.b3",
                            mapOf("switch" to "A_B2"),
                            514.590.seconds,
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.b2:INCREASING, det.b3:DECREASING]",
                            "DECREASING:det.b3",
                            "DECREASING:det.b2",
                            mapOf(),
                            588.374.seconds,
                        ),
                        RJSRoutingZoneRequirement(
                            "zone.[det.b1:INCREASING, det.b2:DECREASING]",
                            "DECREASING:det.b2",
                            "DECREASING:det.b1",
                            mapOf(),
                            finalTime,
                        ),
                    ),
                ),
            ),
            resp.finalOutput.routingRequirements,
        )
    }
}
