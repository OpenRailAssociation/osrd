package fr.sncf.osrd.envelope_sim

import com.google.common.primitives.Doubles
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeShape
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeComplexMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.allowances.Allowance
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.areTimesEqual
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.MethodSource

class AllowanceRangesTests {
    private fun makeSimpleMarecoEnvelopeWithRanges(
        context: EnvelopeSimContext,
        speed: Double,
        stop: Boolean,
        value1: AllowanceValue,
        value2: AllowanceValue,
    ): Envelope {
        val path = context.path
        val stops = if (stop) doubleArrayOf(6000.0, path.length) else doubleArrayOf(path.length)
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(context, speed, stops)
        val ranges =
            listOf(
                AllowanceRange(0.0, 0.3 * path.length, value1),
                AllowanceRange(0.3 * path.length, path.length, value2),
            )
        val allowance = MarecoAllowance(0.0, path.length, 1.0, ranges)
        return allowance.apply(maxEffortEnvelope, context)
    }

    @Test
    fun testRangesFlat() {
        val testContext = SimpleContextBuilder.makeSimpleContext(100000.0, 0.0)
        val marecoEnvelope =
            makeSimpleMarecoEnvelopeWithRanges(
                testContext,
                44.4,
                false,
                AllowanceValue.Percentage(10.0),
                AllowanceValue.Percentage(20.0),
            )
        EnvelopeShape.check(
            marecoEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.DECREASING,
        )
        Assertions.assertTrue(marecoEnvelope.continuous)
    }

    /** Test ranges with time ratio then distance ratio allowance */
    @Test
    fun testRangesOfDifferentTypes() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val value1 = AllowanceValue.Percentage(10.0)
        val value2 = AllowanceValue.TimePerDistance(4.5)
        val rangesTransition = 70000
        val ranges =
            listOf(
                AllowanceRange(0.0, rangesTransition.toDouble(), value1),
                AllowanceRange(rangesTransition.toDouble(), length.toDouble(), value2),
            )
        val allowance = MarecoAllowance(0.0, length.toDouble(), 30 / 3.6, ranges)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)
        val baseTime1 = maxEffortEnvelope.getTimeBetween(0.0, rangesTransition.toDouble())
        val baseTime2 =
            maxEffortEnvelope.getTimeBetween(rangesTransition.toDouble(), length.toDouble())
        val totalBaseTime = maxEffortEnvelope.totalTime
        Assertions.assertTrue(areTimesEqual(totalBaseTime, baseTime1 + baseTime2))
        val distance = getDistance(allowance)
        val targetTime1 =
            baseTime1 + value1.getAllowanceTime(baseTime1, rangesTransition.toDouble())
        val targetTime2 =
            baseTime2 + value2.getAllowanceTime(baseTime2, distance - rangesTransition)
        val marginTime1 = marecoEnvelope.getTimeBetween(0.0, rangesTransition.toDouble())
        val marginTime2 =
            marecoEnvelope.getTimeBetween(rangesTransition.toDouble(), length.toDouble())
        Assertions.assertEquals(marginTime1, targetTime1, testContext.timeStep)
        Assertions.assertEquals(marginTime2, targetTime2, testContext.timeStep)
        Assertions.assertEquals(
            marecoEnvelope.totalTime,
            targetTime1 + targetTime2,
            testContext.timeStep,
        )
    }

    /** Test ranges with decreasing values */
    @Test
    fun testRangesWithDecreasingValues() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val value1 = AllowanceValue.Percentage(15.0)
        val value2 = AllowanceValue.Percentage(10.0)
        val value3 = AllowanceValue.Percentage(5.0)
        val rangesTransitions = doubleArrayOf(0.0, 30000.0, 70000.0, length.toDouble())
        val ranges =
            listOf(
                AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3),
            )
        val allowance = MarecoAllowance(0.0, length.toDouble(), 30 / 3.6, ranges)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)
        val baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val baseTime3 = maxEffortEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3])
        val totalBaseTime = maxEffortEnvelope.totalTime
        Assertions.assertTrue(areTimesEqual(totalBaseTime, baseTime1 + baseTime2 + baseTime3))
        val targetTime1 =
            baseTime1 +
                value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0])
        val targetTime2 =
            baseTime2 +
                value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1])
        val targetTime3 =
            baseTime3 +
                value3.getAllowanceTime(baseTime3, rangesTransitions[3] - rangesTransitions[2])
        val marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val marginTime3 = marecoEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3])
        Assertions.assertEquals(marginTime1, targetTime1, testContext.timeStep)
        Assertions.assertEquals(marginTime2, targetTime2, testContext.timeStep)
        Assertions.assertEquals(marginTime3, targetTime3, testContext.timeStep)
        Assertions.assertEquals(
            marecoEnvelope.totalTime,
            targetTime1 + targetTime2 + targetTime3,
            testContext.timeStep,
        )
    }

    /** Test ranges with increasing values */
    @Test
    fun testRangesWithIncreasingValues() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val value1 = AllowanceValue.Percentage(5.0)
        val value2 = AllowanceValue.Percentage(10.0)
        val value3 = AllowanceValue.Percentage(15.0)
        val rangesTransitions = doubleArrayOf(0.0, 30000.0, 70000.0, length.toDouble())
        val ranges =
            listOf(
                AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3),
            )
        val allowance = MarecoAllowance(0.0, length.toDouble(), 30 / 3.6, ranges)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)
        val baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val baseTime3 = maxEffortEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3])
        val totalBaseTime = maxEffortEnvelope.totalTime
        Assertions.assertTrue(areTimesEqual(totalBaseTime, baseTime1 + baseTime2 + baseTime3))
        val targetTime1 =
            baseTime1 +
                value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0])
        val targetTime2 =
            baseTime2 +
                value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1])
        val targetTime3 =
            baseTime3 +
                value3.getAllowanceTime(baseTime3, rangesTransitions[3] - rangesTransitions[2])
        val marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val marginTime3 = marecoEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3])
        Assertions.assertEquals(marginTime1, targetTime1, testContext.timeStep)
        Assertions.assertEquals(marginTime2, targetTime2, testContext.timeStep)
        Assertions.assertEquals(marginTime3, targetTime3, testContext.timeStep)
        Assertions.assertEquals(
            marecoEnvelope.totalTime,
            targetTime1 + targetTime2 + targetTime3,
            testContext.timeStep,
        )
    }

    /** Test that we can add precisely the needed time in adjacent ranges */
    @Test
    fun testRangesPassageTime() {
        val length = 90000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(length.toDouble())
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 100.0, stops)
        val value1 = FixedTime(50.0)
        val value2 = FixedTime(60.0)
        val value3 = FixedTime(80.0)
        val rangesTransitions = doubleArrayOf(0.0, 30000.0, 60000.0, length.toDouble())
        val ranges =
            listOf(
                AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3),
            )
        val allowance = MarecoAllowance(0.0, length.toDouble(), 1.0, ranges)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)

        // Check that we lose as much time as specified
        Assertions.assertEquals(
            maxEffortEnvelope.interpolateDepartureFrom(rangesTransitions[1]) + value1.time,
            marecoEnvelope.interpolateDepartureFrom(rangesTransitions[1]),
            testContext.timeStep,
        )
        Assertions.assertEquals(
            maxEffortEnvelope.interpolateDepartureFrom(rangesTransitions[2]) +
                value1.time +
                value2.time,
            marecoEnvelope.interpolateDepartureFrom(rangesTransitions[2]),
            testContext.timeStep,
        )
        Assertions.assertEquals(
            (maxEffortEnvelope.interpolateDepartureFrom(rangesTransitions[3]) +
                value1.time +
                value2.time +
                value3.time),
            marecoEnvelope.interpolateDepartureFrom(rangesTransitions[3]),
            testContext.timeStep,
        )
        Assertions.assertEquals(
            maxEffortEnvelope.totalTime + value1.time + value2.time + value3.time,
            marecoEnvelope.totalTime,
            testContext.timeStep,
        )

        // Checks that we don't accelerate to match the original speed for transitions
        Assertions.assertTrue(
            marecoEnvelope.interpolateSpeed(rangesTransitions[1]) <
                maxEffortEnvelope.interpolateSpeed(rangesTransitions[1])
        )
        Assertions.assertTrue(
            marecoEnvelope.interpolateSpeed(rangesTransitions[2]) <
                maxEffortEnvelope.interpolateSpeed(rangesTransitions[2])
        )
    }

    /** Test ranges with intersections being precisely on a stop point */
    @Test
    fun testRangesOnStopPoint() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val value1 = AllowanceValue.TimePerDistance(5.5)
        val value2 = AllowanceValue.Percentage(10.0)
        val rangesTransitions = doubleArrayOf(0.0, 50000.0, length.toDouble())
        val ranges =
            listOf(
                AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
            )
        val allowance = MarecoAllowance(0.0, length.toDouble(), 30 / 3.6, ranges)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)
        val baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val totalBaseTime = maxEffortEnvelope.totalTime
        Assertions.assertTrue(areTimesEqual(totalBaseTime, baseTime1 + baseTime2))
        val targetTime1 =
            baseTime1 +
                value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0])
        val targetTime2 =
            baseTime2 +
                value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1])
        val marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        Assertions.assertEquals(marginTime1, targetTime1, testContext.timeStep)
        Assertions.assertEquals(marginTime2, targetTime2, testContext.timeStep)
        Assertions.assertEquals(
            marecoEnvelope.totalTime,
            targetTime1 + targetTime2,
            testContext.timeStep,
        )
    }

    /** Test with a very short range */
    @ParameterizedTest
    @MethodSource("allowanceValues")
    fun testVeryShortRange(allowanceValues: DoubleArray) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val value1 = AllowanceValue.Percentage(allowanceValues[0])
        val value2 = AllowanceValue.Percentage(allowanceValues[1])
        val value3 = AllowanceValue.Percentage(allowanceValues[2])
        val rangesTransitions = doubleArrayOf(0.0, 30000.0, 30500.0, length.toDouble())
        val ranges =
            listOf(
                AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1),
                AllowanceRange(rangesTransitions[1], rangesTransitions[2], value2),
                AllowanceRange(rangesTransitions[2], rangesTransitions[3], value3),
            )
        val allowance = MarecoAllowance(0.0, length.toDouble(), 30 / 3.6, ranges)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)
        val baseTime1 = maxEffortEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val baseTime2 = maxEffortEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val baseTime3 = maxEffortEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3])
        val totalBaseTime = maxEffortEnvelope.totalTime
        Assertions.assertTrue(areTimesEqual(totalBaseTime, baseTime1 + baseTime2 + baseTime3))
        val targetTime1 =
            baseTime1 +
                value1.getAllowanceTime(baseTime1, rangesTransitions[1] - rangesTransitions[0])
        val targetTime2 =
            baseTime2 +
                value2.getAllowanceTime(baseTime2, rangesTransitions[2] - rangesTransitions[1])
        val targetTime3 =
            baseTime3 +
                value3.getAllowanceTime(baseTime3, rangesTransitions[3] - rangesTransitions[2])
        val marginTime1 = marecoEnvelope.getTimeBetween(rangesTransitions[0], rangesTransitions[1])
        val marginTime2 = marecoEnvelope.getTimeBetween(rangesTransitions[1], rangesTransitions[2])
        val marginTime3 = marecoEnvelope.getTimeBetween(rangesTransitions[2], rangesTransitions[3])
        Assertions.assertEquals(marginTime1, targetTime1, testContext.timeStep)
        Assertions.assertEquals(marginTime2, targetTime2, testContext.timeStep)
        Assertions.assertEquals(marginTime3, targetTime3, testContext.timeStep)
        Assertions.assertEquals(
            marecoEnvelope.totalTime,
            targetTime1 + targetTime2 + targetTime3,
            testContext.timeStep,
        )
    }

    /**
     * Test with an allowance range that starts very slightly after the path start, and ends around
     * the end of the acceleration part. This doesn't necessarily have to result in a valid envelope
     * as we're very close to asking for an impossible allowance, but we check that it doesn't crash
     * early
     */
    @Test
    fun testAllowanceRangeEdgeCase() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(length.toDouble())
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 10.0, stops)
        val value1 = AllowanceValue.Percentage(10.0)
        val rangesTransitions = doubleArrayOf(0.1, maxEffortEnvelope.get(0).endPos)
        val ranges = listOf(AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1))
        val allowance = LinearAllowance(rangesTransitions[0], rangesTransitions[1], 1.0, ranges)
        applyAllowanceIgnoringUserError(allowance, maxEffortEnvelope, testContext)
    }

    /**
     * Test with an allowance range that starts very slightly after the path start, and ends around
     * the end of the acceleration part, with a large time step. This doesn't necessarily have to
     * result in a valid envelope as we're very close to asking for an impossible allowance, but we
     * check that it doesn't crash early
     */
    @Test
    fun testAllowanceRangeEdgeCaseLargeTimeStep() {
        val length = 100000
        val testContext =
            SimpleContextBuilder.makeSimpleContext(
                length.toDouble(),
                0.0,
                SimpleContextBuilder.TIME_STEP * 2,
            )
        val stops = doubleArrayOf(length.toDouble())
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 10.0, stops)
        val value1 = AllowanceValue.Percentage(10.0)
        val rangesTransitions = doubleArrayOf(0.1, maxEffortEnvelope.get(0).endPos)
        val ranges = listOf(AllowanceRange(rangesTransitions[0], rangesTransitions[1], value1))
        val allowance = LinearAllowance(rangesTransitions[0], rangesTransitions[1], 1.0, ranges)
        applyAllowanceIgnoringUserError(allowance, maxEffortEnvelope, testContext)
    }

    /**
     * Regression test: reproduces
     * [this bug](https://github.com/OpenRailAssociation/osrd/issues/3199). This is an extreme
     * corner case. The last section computed is the section between the stop at 300m and the
     * transition at 301. Because it's after a stop, the speed is very low. The capacity speed limit
     * sets a binary search bound that is higher than the max speed on that part, resulting in a
     * linear allowance that goes faster. The transition can be weird.
     */
    @Test
    fun regressionTestCornerCase() {
        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val testPath = FlatPath(10000.0, 0.0)
        val stops = doubleArrayOf(300.0)
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val allowance =
            LinearAllowance(
                0.0,
                testPath.length,
                1.5,
                listOf(
                    AllowanceRange(0.0, 301.0, FixedTime(50.0)),
                    AllowanceRange(301.0, testPath.length, AllowanceValue.Percentage(50.0)),
                ),
            )
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 80.0, stops)
        allowance.apply(maxEffortEnvelope, testContext)
    }

    /**
     * This tests ensure that, even with several ranges, the error doesn't build up to more than the
     * tolerance for one binary search.
     */
    @ParameterizedTest
    @CsvSource("10, 1", "10, 11", "1, 11")
    fun errorBuildupTest(nRanges: Int, nStops: Int) {
        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val testPath = FlatPath(10000.0, 0.0)
        val rangeLength = testPath.length / nRanges
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val allowanceRanges = ArrayList<AllowanceRange>()
        for (i in 0..<nRanges) {
            allowanceRanges.add(
                AllowanceRange(
                    i * rangeLength,
                    (i + 1) * rangeLength,
                    AllowanceValue.Percentage(50.0),
                )
            )
        }

        val allowance = LinearAllowance(0.0, testPath.length, 1.5, allowanceRanges)
        val stopsDistance = testPath.length / nStops
        val stops = ArrayList<Double>()
        for (i in 0..<nStops) {
            stops.add((i + 1) * stopsDistance)
        }
        val maxEffortEnvelope =
            makeSimpleMaxEffortEnvelope(testContext, 30.0, Doubles.toArray(stops))
        val res = checkNotNull(allowance.apply(maxEffortEnvelope, testContext))
        val expectedTime = maxEffortEnvelope.totalTime * 1.5
        Assertions.assertEquals(expectedTime, res.totalTime, testContext.timeStep)
    }

    /** Applies the allowance to the envelope. Any user error (impossible margin) is ignored */
    private fun applyAllowanceIgnoringUserError(
        allowance: Allowance,
        envelope: Envelope,
        context: EnvelopeSimContext,
    ) {
        try {
            allowance.apply(envelope, context)
        } catch (e: OSRDError) {
            if (e.osrdErrorType != ErrorType.AllowanceConvergenceTooMuchTime) {
                throw e
            }
        }
    }

    companion object {
        fun getDistance(allowance: MarecoAllowance): Double {
            return allowance.endPos - allowance.beginPos
        }

        /** Test arguments for @testVeryShortRange */
        @JvmStatic
        fun allowanceValues(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(doubleArrayOf(5.0, 20.0, 10.0)),
                Arguments.of(doubleArrayOf(20.0, 5.0, 10.0)),
                Arguments.of(doubleArrayOf(5.0, 10.0, 20.0)),
                Arguments.of(doubleArrayOf(5.0, 40.0, 5.0)),
            )
        }
    }
}
