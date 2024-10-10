package fr.sncf.osrd.standalone_sim

import com.google.common.collect.ImmutableRangeMap
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.api.api_v2.standalone_sim.MarginValue
import fr.sncf.osrd.api.api_v2.standalone_sim.ReportTrain
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.external_generated_inputs.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.*
import fr.sncf.osrd.sim_infra.api.makePathProperties
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.*
import java.util.stream.Stream
import kotlin.math.min
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class StandaloneSimulationTest {
    private val infra = Helpers.tinyInfra
    private val routes =
        listOf(
                "rt.buffer_stop_c->tde.track-bar",
                "rt.tde.track-bar->tde.switch_foo-track",
                "rt.tde.switch_foo-track->buffer_stop_a"
            )
            .map { infra.rawInfra.getRouteFromName(it) }

    private val chunkPath = pathFromRoutes(infra.rawInfra, routes)
    private val pathProps = makePathProperties(infra.rawInfra, chunkPath, routes)
    private val rollingStock = TestTrains.REALISTIC_FAST_TRAIN
    private val pathLength = pathProps.getLength()

    // Build a reference max speed envelope
    private val mrsp = computeMRSP(pathProps, rollingStock, true, null)
    private val envelopeSimPath =
        EnvelopeTrainPath.from(infra.rawInfra, pathProps, ElectricalProfileMapping())
    private val electrificationMap =
        envelopeSimPath.getElectrificationMap(
            rollingStock.basePowerClass,
            ImmutableRangeMap.of(),
            rollingStock.powerRestrictions,
            true
        )
    private val curvesAndConditions =
        rollingStock.mapTractiveEffortCurves(electrificationMap, Comfort.STANDARD)
    private var context =
        EnvelopeSimContext(rollingStock, envelopeSimPath, 2.0, curvesAndConditions.curves)
    private val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, doubleArrayOf(), mrsp)
    private val maxEffortEnvelope = MaxEffortEnvelope.from(context, 0.0, maxSpeedEnvelope)

    /** Smoke test: we check that nothing crashes */
    @Test
    fun testBasicTrain() {
        val res =
            runStandaloneSimulation(
                infra,
                pathProps,
                chunkPath,
                routes.toIdxList(),
                ElectricalProfileMapping(),
                rollingStock,
                Comfort.STANDARD,
                RJSAllowanceDistribution.LINEAR,
                null,
                distanceRangeMapOf(),
                false,
                2.0,
                listOf(),
                0.0,
                RangeValues(listOf(), listOf()),
                listOf(),
            )
        println(res)
    }

    data class TestCase(
        val allowanceDistribution: RJSAllowanceDistribution = RJSAllowanceDistribution.LINEAR,
        val schedule: List<SimulationScheduleItem> = listOf(),
        val startSpeed: Double = 0.0,
        val margins: RangeValues<MarginValue> = RangeValues(),
        val pathLength: Distance,
        val powerRestrictions: DistanceRangeMap<String> = distanceRangeMapOf()
    )

    /**
     * Generate test cases for a combination of allowance distribution, scheduled points, start
     * speed, and margins.
     */
    private fun generateTestCases(): Stream<Arguments> {
        // Enumerate possible individual scheduled points
        val thirdDistance = Offset<TravelledPath>(pathLength / 3.0)
        val halfDistance = Offset<TravelledPath>(pathLength / 2.0)
        val twoThirdDistance = Offset<TravelledPath>(pathLength * (2.0 / 3.0))
        val possibleScheduledItem =
            listOf(
                SimulationScheduleItem(
                    thirdDistance,
                    maxEffortEnvelope
                        .interpolateDepartureFrom(thirdDistance.distance.meters)
                        .seconds + 60.seconds,
                    null,
                    OPEN
                ),
                SimulationScheduleItem(
                    halfDistance,
                    maxEffortEnvelope
                        .interpolateDepartureFrom(halfDistance.distance.meters)
                        .seconds + 120.seconds,
                    15.seconds,
                    OPEN
                ),
                SimulationScheduleItem(twoThirdDistance, null, 30.seconds, OPEN),
                SimulationScheduleItem(
                    Offset<TravelledPath>(pathLength),
                    maxEffortEnvelope.totalTime.seconds + 300.seconds,
                    0.seconds,
                    OPEN
                ),
            )

        // Try each combination on and off
        val schedules = mutableListOf<List<SimulationScheduleItem>>()
        for (i in 0 until (2 shl possibleScheduledItem.size)) {
            val schedule = mutableListOf<SimulationScheduleItem>()
            for ((j, item) in possibleScheduledItem.withIndex()) {
                if ((i and (1 shl j)) != 0) {
                    schedule.add(item)
                }
            }
            schedules.add(schedule)
        }

        // Margin values
        val margins: List<RangeValues<MarginValue>> =
            listOf(
                RangeValues(),
                RangeValues(listOf(), listOf(MarginValue.Percentage(10.0))),
                RangeValues(
                    listOf(Offset(pathLength / 2.0)),
                    listOf(
                        MarginValue.Percentage(10.0),
                        MarginValue.MinPer100Km(5.0),
                    ),
                )
            )

        // Power restriction values
        val powerRestrictionRangeMaps: List<DistanceRangeMap<String>> =
            listOf(
                distanceRangeMapOf(),
                distanceRangeMapOf(
                    listOf(
                        DistanceRangeMap.RangeMapEntry(0.meters, pathLength / 3.0, "Restrict1"),
                        DistanceRangeMap.RangeMapEntry(
                            pathLength / 3.0,
                            pathLength * 2.0 / 3.0,
                            "Restrict2"
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            pathLength * 2.0 / 3.0,
                            pathLength,
                            "Restrict1"
                        )
                    )
                )
            )

        // List all possible combinations
        val res = mutableListOf<TestCase>()
        for (schedule in schedules) {
            for (margin in margins) {
                for (startSpeed in listOf(0.0, 15.0)) {
                    for (distribution in RJSAllowanceDistribution.entries) {
                        for (powerRestrictions in powerRestrictionRangeMaps) {
                            res.add(
                                TestCase(
                                    schedule = schedule,
                                    margins = margin,
                                    startSpeed = startSpeed,
                                    allowanceDistribution = distribution,
                                    pathLength = pathLength,
                                    powerRestrictions = powerRestrictions
                                )
                            )
                        }
                    }
                }
            }
        }
        return res.map { Arguments.of(it) }.stream()
    }

    /** Parametrized test, checks the interactions between margins and scheduled points */
    @ParameterizedTest
    @MethodSource("generateTestCases")
    fun parametrizedTest(testCase: TestCase) {
        val res =
            runStandaloneSimulation(
                infra,
                pathProps,
                chunkPath,
                routes.toIdxList(),
                ElectricalProfileMapping(),
                rollingStock,
                Comfort.STANDARD,
                testCase.allowanceDistribution,
                null,
                testCase.powerRestrictions,
                false,
                2.0,
                testCase.schedule,
                testCase.startSpeed,
                testCase.margins,
                listOf(),
            )

        // Test scheduled points
        for (scheduledPoint in testCase.schedule) {
            val arrival =
                getTimeAt(
                    scheduledPoint.pathOffset,
                    res.finalOutput.positions,
                    res.finalOutput.times,
                    false
                )
            val departure =
                getTimeAt(
                    scheduledPoint.pathOffset,
                    res.finalOutput.positions,
                    res.finalOutput.times,
                    true
                )
            if (scheduledPoint.arrival != null) {
                assertEquals(scheduledPoint.arrival!!.seconds, arrival, 2.0)
            }
            assertEquals(scheduledPoint.stopFor?.seconds ?: 0.0, departure - arrival, 2.0)
        }

        // Test margin values
        val boundaries = mutableListOf<Offset<TravelledPath>>()
        boundaries.add(Offset(Distance.ZERO))
        boundaries.addAll(testCase.margins.internalBoundaries)
        boundaries.add(Offset(testCase.pathLength))
        for (i in 0 until testCase.margins.values.size) {
            val entryOffset = boundaries[i]
            val exitOffset = boundaries[i + 1]
            val baseTime =
                getTimeAt(exitOffset, res.base, false) - getTimeAt(entryOffset, res.base, true)
            val marginTime =
                getTimeAt(exitOffset, res.provisional, false) -
                    getTimeAt(entryOffset, res.provisional, true)
            val value =
                when (val rawValue = testCase.margins.values[i]) {
                    is MarginValue.MinPer100Km -> TimePerDistance(rawValue.value)
                    is MarginValue.Percentage -> Percentage(rawValue.percentage)
                    is MarginValue.None -> Percentage(0.0)
                }
            val expectedDiff =
                value.getAllowanceTime(
                    baseTime,
                    (exitOffset.distance - entryOffset.distance).meters
                )

            // We need a lot of tolerance here as the curves are simplified, and it's
            // not a stop location. We're not testing the exact values anyway
            // (there are margin-specific tests for that), just that allowances
            // are used.
            assertEquals(expectedDiff, marginTime - baseTime, 6.0)
        }
    }

    /** Test that the safety speeds are properly computed for a given path */
    @Test
    fun testSafetySpeed() {
        // Path length = 10400m
        // SIGNAL OFFSETS on this path: 150m and 10150m
        // Then, buffer stop at the end of the last route: 10400m
        val schedule =
            listOf(
                // Start of path, check that it doesn't extend beyond the start
                SimulationScheduleItem(
                    Offset(42.meters),
                    42.seconds,
                    42.seconds,
                    SHORT_SLIP_STOP,
                ),
                // OPEN, check that this is ignored
                SimulationScheduleItem(
                    Offset(10_000.meters),
                    42.seconds,
                    42.seconds,
                    OPEN,
                ),
                // STOP before the last buffer stop
                SimulationScheduleItem(
                    Offset(10_300.meters),
                    42.seconds,
                    42.seconds,
                    STOP,
                ),
            )
        val safetySpeedRanges =
            makeSafetySpeedRanges(infra, chunkPath, routes.toIdxList(), schedule)
        val expected =
            distanceRangeMapOf(
                listOf(
                    DistanceRangeMap.RangeMapEntry(0.meters, 50.meters, 30.kilometersPerHour),
                    DistanceRangeMap.RangeMapEntry(50.meters, 150.meters, 10.kilometersPerHour),
                    DistanceRangeMap.RangeMapEntry(
                        10_200.meters,
                        10_300.meters,
                        30.kilometersPerHour
                    ),
                    // Last buffer stop short slip range
                    DistanceRangeMap.RangeMapEntry(
                        10_300.meters,
                        10_400.meters,
                        10.kilometersPerHour
                    ),
                ),
            )
        assertEquals(expected, safetySpeedRanges)
    }

    /** Test that for a given safety speed range, they are correctly applied to the mrsp */
    @Test
    fun testSafetySpeedMRSP() {
        // Distance range spans across two mrsp sections, one below and one above 30km/h
        val safetySpeeds =
            distanceRangeMapOf(
                listOf(
                    DistanceRangeMap.RangeMapEntry(100.meters, 5_000.meters, 30.kilometersPerHour)
                )
            )
        val offsetEndSafetySpeed = 5_000 + rollingStock.length
        val mrspWithSafetySpeed = computeMRSP(pathProps, rollingStock, true, null, safetySpeeds)
        assertEquals(mrsp.endPos, mrspWithSafetySpeed.endPos)
        var position = 0.0
        while (position < mrsp.endPos) {
            var expected = mrsp.interpolateSpeedLeftDir(position, 1.0)
            if (position in 101.0..offsetEndSafetySpeed)
                expected = min(expected, 30.kilometersPerHour.metersPerSecond)
            val actual = mrspWithSafetySpeed.interpolateSpeedLeftDir(position, 1.0)
            assertEquals(expected, actual)
            position += 1.0
        }
    }

    /**
     * Returns the time at which the given offset is reached, interpolating linearly between points.
     */
    private fun getTimeAt(
        offset: Offset<TravelledPath>,
        train: ReportTrain,
        interpolateRight: Boolean
    ): Double {
        return getTimeAt(offset, train.positions, train.times, interpolateRight)
    }

    /**
     * Returns the time at which the given offset is reached, interpolating linearly between points.
     */
    private fun getTimeAt(
        offset: Offset<TravelledPath>,
        positions: List<Offset<TravelledPath>>,
        times: List<TimeDelta>,
        interpolateRight: Boolean
    ): Double {
        for (i in 1 until positions.size) {
            val pos = positions[i]
            if (pos >= offset) {
                if (interpolateRight && pos == offset && i < positions.size - 1) continue
                val prevPos = positions[i - 1]
                val time = times[i].seconds
                val prevTime = times[i - 1].seconds
                val posDelta = pos - prevPos
                val timeDelta = time - prevTime
                return prevTime + ((offset - prevPos) / posDelta) * timeDelta
            }
        }
        throw RuntimeException("Offset out of bounds")
    }
}
