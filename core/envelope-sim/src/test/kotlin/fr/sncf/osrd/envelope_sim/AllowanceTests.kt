package fr.sncf.osrd.envelope_sim

import com.carrotsearch.hppc.DoubleArrayList
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeShape
import fr.sncf.osrd.envelope.EnvelopeTransitions
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeComplexMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.allowances.AbstractAllowanceWithRanges
import fr.sncf.osrd.envelope_sim.allowances.Allowance
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.reporting.exceptions.ErrorCause
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.areSpeedsEqual
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class AllowanceTests {
    /** Test the continuity of the binary search */
    private fun testBinarySearchContinuity(
        maxEffortEnvelope: Envelope,
        allowance: AbstractAllowanceWithRanges,
        context: EnvelopeSimContext,
        lowSpeed: Double,
        highSpeed: Double,
    ) {
        // We check that when the speed parameter goes up, the speed goes up at every point of the
        // envelope
        val previousEnvelope = allowance.computeIteration(maxEffortEnvelope, context, lowSpeed)
        val speedFactor = 1.001
        var speed = lowSpeed
        while (speed < highSpeed) {
            val envelope = allowance.computeIteration(maxEffortEnvelope, context, speed)
            for (part in envelope) {
                for (i in 0..<part.stepCount()) {
                    val position = part.getPointSpeed(i)
                    val newSpeed = envelope.interpolateSpeed(position)
                    val prevSpeed = previousEnvelope.interpolateSpeed(position)
                    Assertions.assertTrue(
                        prevSpeed < newSpeed || areSpeedsEqual(prevSpeed, newSpeed)
                    )
                }
            }
            speed *= speedFactor
        }
    }

    @Test
    fun testBinarySearchContinuity() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(0.5 * length, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = AllowanceValue.Percentage(10.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testBinarySearchContinuity(maxEffortEnvelope, marecoAllowance, testContext, 10.0, 80.0)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testBinarySearchContinuity(maxEffortEnvelope, linearAllowance, testContext, 8.0, 70.0)
    }

    @Test
    fun complexTestBinarySearchContinuity() {
        val length = 50000
        val trainPath =
            EnvelopeSimPathBuilder.buildNonElectrified(
                length.toDouble(),
                doubleArrayOf(0.0, 800.0, 35000.0, length.toDouble()),
                doubleArrayOf(0.0, 50.0, -10.0),
            )
        val testContext =
            EnvelopeSimContext(
                SimpleRollingStock.STANDARD_TRAIN,
                trainPath,
                2.0,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf()
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.0, stops)
        val allowanceValue = AllowanceValue.Percentage(50.0)

        // test mareco distribution
        val marecoAllowance = makeStandardMarecoAllowance(0.0, 50000.0, 1.0, allowanceValue)
        testBinarySearchContinuity(maxEffortEnvelope, marecoAllowance, testContext, 10.0, 80.0)
    }

    private fun testAllowanceShapeFlat(context: EnvelopeSimContext, allowance: Allowance) {
        val allowanceEnvelope = makeSimpleAllowanceEnvelope(context, allowance, 44.4, true)
        EnvelopeShape.check(
            allowanceEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.DECREASING,
        )
        val delta = 2 * allowanceEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.1s time step, so they can
        // be considered as
        // reference, the delta is supposed to absorb the difference for higher time steps
        EnvelopeTransitions.checkPositions(
            allowanceEnvelope,
            delta,
            1411.0,
            5094.0,
            6000.0,
            6931.0,
            9339.0,
        )
        Assertions.assertTrue(allowanceEnvelope.continuous)
    }

    @Test
    fun testMarecoShapeFlat() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val allowanceValue = AllowanceValue.Percentage(10.0)
        val allowance = makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceShapeFlat(testContext, allowance)
    }

    private fun testAllowanceShapeSteep(context: EnvelopeSimContext, allowance: Allowance) {
        val allowanceEnvelope = makeSimpleAllowanceEnvelope(context, allowance, 44.4, true)
        EnvelopeShape.check(
            allowanceEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.DECREASING,
        )
        val delta = 2 * allowanceEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.1s time step, so they can
        // be considered as reference, the delta is supposed to absorb the difference for higher
        // time steps
        EnvelopeTransitions.checkPositions(
            allowanceEnvelope,
            delta,
            1839.0,
            4351.0,
            5747.0,
            6000.0,
            7259.0,
            8764.0,
            9830.0,
        )
        Assertions.assertTrue(allowanceEnvelope.continuous)
    }

    @Test
    fun testMarecoShapeSteep() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 20.0)
        val allowanceValue = AllowanceValue.Percentage(10.0)
        val allowance = makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceShapeSteep(testContext, allowance)
    }

    /**
     * Make sure that applying the given allowance to the given base will result in the correct
     * total time
     */
    private fun testAllowanceTime(
        base: Envelope,
        context: EnvelopeSimContext,
        allowance: AbstractAllowanceWithRanges,
    ) {
        val allowanceEnvelope = allowance.apply(base, context)
        val marginTime = allowanceEnvelope.totalTime
        val targetTime = allowance.getTargetTime(base)
        Assertions.assertEquals(marginTime, targetTime, context.timeStep)
    }

    private fun testTransitionPoints(
        base: Envelope,
        context: EnvelopeSimContext,
        allowance: AbstractAllowanceWithRanges,
    ) {
        val tolerance = 0.02 // percentage
        val beginPos = allowance.beginPos
        val endPos = allowance.endPos
        val allowanceEnvelope = allowance.apply(base, context)

        val timeBeginPointBase = base.interpolateDepartureFrom(beginPos)
        val timeEndPointBase = base.interpolateDepartureFrom(endPos)

        val timeBeginPoint = allowanceEnvelope.interpolateDepartureFrom(beginPos)
        val timeEndPoint = allowanceEnvelope.interpolateDepartureFrom(endPos)
        val expectedTimeEndPoint = timeEndPointBase + allowance.getAddedTime(base)

        // make sure begin has the same time before and after margin, and that end is offset by the
        // proper value
        Assertions.assertEquals(timeBeginPointBase, timeBeginPoint, context.timeStep)
        Assertions.assertEquals(expectedTimeEndPoint, timeEndPoint, context.timeStep)

        val speedBeginPointBase = base.interpolateSpeed(beginPos)
        val speedEndPointBase = base.interpolateSpeed(endPos)

        val speedBeginPoint = allowanceEnvelope.interpolateSpeed(beginPos)
        val speedEndPoint = allowanceEnvelope.interpolateSpeed(endPos)

        // make sure begin and end have the same speed before and after margin
        Assertions.assertEquals(
            speedBeginPointBase,
            speedBeginPoint,
            speedBeginPointBase * tolerance,
        )
        Assertions.assertEquals(speedEndPointBase, speedEndPoint, speedEndPointBase * tolerance)
    }

    /** Test mareco distribution with percentage time */
    @ParameterizedTest
    @ValueSource(doubles = [0.0, 10.0, 100.0])
    fun testPercentageTimeAllowances(value: Double) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)

        val stops = doubleArrayOf(50000.0, testContext.path.length)
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)

        val allowanceValue = AllowanceValue.Percentage(value)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceTime(maxEffortEnvelope, testContext, marecoAllowance)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceTime(maxEffortEnvelope, testContext, linearAllowance)
    }

    /** Test mareco with a time per distance allowance */
    @ParameterizedTest
    @ValueSource(doubles = [0.0, 4.5, 5.5])
    fun testTimePerDistanceAllowances(value: Double) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, testContext.path.length)
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)

        val allowanceValue = AllowanceValue.TimePerDistance(value)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceTime(maxEffortEnvelope, testContext, marecoAllowance)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceTime(maxEffortEnvelope, testContext, linearAllowance)
    }

    private fun testEngineeringAllowance(
        base: Envelope,
        context: EnvelopeSimContext,
        allowance: AbstractAllowanceWithRanges,
    ) {
        testAllowanceTime(base, context, allowance)
        testTransitionPoints(base, context, allowance)
    }

    @ParameterizedTest
    @ValueSource(doubles = [0.0, 60.0, 200.0])
    fun testEngineeringAllowancesFlat(value: Double) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = FixedTime(value)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 8.33, allowanceValue)
        testEngineeringAllowance(maxEffortEnvelope, testContext, marecoAllowance)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 8.33, allowanceValue)
        testEngineeringAllowance(maxEffortEnvelope, testContext, linearAllowance)
    }

    @ParameterizedTest
    @ValueSource(doubles = [0.0, 60.0, 200.0])
    fun testEngineeringAllowancesSteep(value: Double) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 20.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = FixedTime(value)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 8.33, allowanceValue)
        testEngineeringAllowance(maxEffortEnvelope, testContext, marecoAllowance)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 8.33, allowanceValue)
        testEngineeringAllowance(maxEffortEnvelope, testContext, linearAllowance)
    }

    /** Test engineering allowance with fixed time on a segment */
    @ParameterizedTest
    @ValueSource(doubles = [0.0, 60.0, 200.0])
    fun testEngineeringAllowancesOnSegment(value: Double) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(2000.0, 50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = FixedTime(value)
        val begin = 20000.0
        val end = 40000.0

        // test mareco distribution
        val marecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, allowanceValue)
        testEngineeringAllowance(maxEffortEnvelope, testContext, marecoAllowance)

        // test linear distribution
        val linearAllowance = makeStandardLinearAllowance(begin, end, 8.33, allowanceValue)
        testEngineeringAllowance(maxEffortEnvelope, testContext, linearAllowance)
    }

    /**
     * Test the engineering allowance with a high value on a short segment, expecting to get an
     * error
     */
    @Test
    fun testImpossibleEngineeringAllowances() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = FixedTime(20000.0)
        val begin = 20000.0
        val end = 40000.0

        // test mareco distribution
        val marecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, allowanceValue)
        val marecoThrown =
            Assertions.assertThrows(OSRDError::class.java) {
                marecoAllowance.apply(maxEffortEnvelope, testContext)
            }
        Assertions.assertEquals(
            marecoThrown.osrdErrorType,
            ErrorType.AllowanceConvergenceTooMuchTime,
        )

        // test linear distribution
        val linearAllowance = makeStandardLinearAllowance(begin, end, 8.33, allowanceValue)
        val linearThrown =
            Assertions.assertThrows(OSRDError::class.java) {
                linearAllowance.apply(maxEffortEnvelope, testContext)
            }
        Assertions.assertEquals(
            linearThrown.osrdErrorType,
            ErrorType.AllowanceConvergenceTooMuchTime,
        )
    }

    /**
     * Test the engineering allowance with a very short segment, to trigger intersectLeftRightParts
     * method
     */
    @Test
    fun testIntersectLeftRightParts() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = FixedTime(20.0)
        val begin = 20000.0
        val end = 21000.0

        // test mareco distribution
        val marecoAllowance = makeStandardMarecoAllowance(begin, end, 8.33, allowanceValue)
        val marecoThrown =
            Assertions.assertThrows(OSRDError::class.java) {
                marecoAllowance.apply(maxEffortEnvelope, testContext)
            }
        Assertions.assertEquals(
            marecoThrown.osrdErrorType,
            ErrorType.AllowanceConvergenceTooMuchTime,
        )

        // test linear distribution
        val linearAllowance = makeStandardLinearAllowance(begin, end, 8.33, allowanceValue)
        val linearThrown =
            Assertions.assertThrows(OSRDError::class.java) {
                linearAllowance.apply(maxEffortEnvelope, testContext)
            }
        Assertions.assertEquals(
            linearThrown.osrdErrorType,
            ErrorType.AllowanceConvergenceTooMuchTime,
        )
    }

    private fun testEngineeringOnStandardAllowance(
        maxEffortEnvelope: Envelope,
        context: EnvelopeSimContext,
        standardAllowance: AbstractAllowanceWithRanges,
        engineeringAllowance: AbstractAllowanceWithRanges,
    ) {
        val standardEnvelope = standardAllowance.apply(maxEffortEnvelope, context)
        val engineeringEnvelope = engineeringAllowance.apply(standardEnvelope, context)

        val baseTime = maxEffortEnvelope.totalTime
        val standardAllowanceAddedTime = standardAllowance.getAddedTime(maxEffortEnvelope)
        val engineeringAllowanceAddedTime = engineeringAllowance.getAddedTime(standardEnvelope)
        val targetTime = baseTime + standardAllowanceAddedTime + engineeringAllowanceAddedTime
        val marginTime = engineeringEnvelope.totalTime
        Assertions.assertEquals(marginTime, targetTime, 2 * context.timeStep)

        val engineeringAllowanceTargetTime = engineeringAllowance.getTargetTime(standardEnvelope)
        Assertions.assertEquals(marginTime, engineeringAllowanceTargetTime, context.timeStep)
    }

    @Test
    fun testEngineeringOnStandardAllowances() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val begin = 30000.0
        val end = 50000.0

        val standardAllowanceValue = AllowanceValue.Percentage(10.0)
        val engineeringAllowanceValue = FixedTime(30.0)

        // test mareco distribution
        val standardMarecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 8.33, standardAllowanceValue)
        val engineeringMarecoAllowance =
            makeStandardMarecoAllowance(begin, end, 8.33, engineeringAllowanceValue)
        testEngineeringOnStandardAllowance(
            maxEffortEnvelope,
            testContext,
            standardMarecoAllowance,
            engineeringMarecoAllowance,
        )

        // test linear distribution
        val standardLinearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 8.33, standardAllowanceValue)
        val engineeringLinearAllowance =
            makeStandardLinearAllowance(begin, end, 8.33, engineeringAllowanceValue)
        testEngineeringOnStandardAllowance(
            maxEffortEnvelope,
            testContext,
            standardLinearAllowance,
            engineeringLinearAllowance,
        )
    }

    private fun testSeveralEngineeringAllowances(
        maxEffortEnvelope: Envelope,
        testContext: EnvelopeSimContext,
        allowanceA: AbstractAllowanceWithRanges,
        allowanceB: AbstractAllowanceWithRanges,
    ) {
        val engineeringEnvelopeA = allowanceA.apply(maxEffortEnvelope, testContext)
        val engineeringEnvelopeB = allowanceB.apply(engineeringEnvelopeA, testContext)
        val baseTime = maxEffortEnvelope.totalTime
        val targetTime =
            baseTime +
                allowanceA.getAddedTime(maxEffortEnvelope) +
                allowanceB.getAddedTime(maxEffortEnvelope)
        val marginTime = engineeringEnvelopeB.totalTime
        Assertions.assertEquals(marginTime, targetTime, 2 * testContext.timeStep)
    }

    /** Test several engineering allowances on segments */
    @ParameterizedTest
    @ValueSource(ints = [30000, 50000, 70000])
    fun testSeveralEngineeringAllowances(value: Double) {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValueA = FixedTime(15.0)
        val allowanceValueB = FixedTime(30.0)

        // test mareco distribution
        val marecoAllowanceA = makeStandardMarecoAllowance(0.0, value, 8.33, allowanceValueA)
        val marecoAllowanceB =
            makeStandardMarecoAllowance(value, length.toDouble(), 8.33, allowanceValueB)
        testSeveralEngineeringAllowances(
            maxEffortEnvelope,
            testContext,
            marecoAllowanceA,
            marecoAllowanceB,
        )

        // test linear distribution
        val linearAllowanceA = makeStandardLinearAllowance(0.0, value, 8.33, allowanceValueA)
        val linearAllowanceB =
            makeStandardLinearAllowance(value, length.toDouble(), 8.33, allowanceValueB)
        testSeveralEngineeringAllowances(
            maxEffortEnvelope,
            testContext,
            linearAllowanceA,
            linearAllowanceB,
        )
    }

    /** Test standard mareco allowance with different slopes */
    @ParameterizedTest
    @ValueSource(ints = [0, 1, 2, 3, 4, 5, 6, 7])
    fun testDifferentSlopes(slopeProfile: Int) {
        // inputs
        val gradeValues: DoubleArray
        val gradePositions: DoubleArray
        when (slopeProfile) {
            0 -> { // no slope / ramp
                gradePositions = doubleArrayOf(0.0, 100000.0)
                gradeValues = doubleArrayOf(0.0)
            }
            1 -> { // ramp
                gradePositions = doubleArrayOf(0.0, 100000.0)
                gradeValues = doubleArrayOf(10.0)
            }
            2 -> { // low slope
                gradePositions = doubleArrayOf(0.0, 100000.0)
                gradeValues = doubleArrayOf(-2.0)
            }
            3 -> { // high slope
                gradePositions = doubleArrayOf(0.0, 100000.0)
                gradeValues = doubleArrayOf(-10.0)
            }
            4 -> { // high slope on a short segment
                gradePositions = doubleArrayOf(0.0, 50000.0, 60000.0, 100000.0)
                gradeValues = doubleArrayOf(0.0, -10.0, 0.0)
            }
            5 -> { // high slope on half
                gradePositions = doubleArrayOf(0.0, 50000.0, 100000.0)
                gradeValues = doubleArrayOf(0.0, -10.0)
            }
            6 -> { // high slope on acceleration
                gradePositions = doubleArrayOf(0.0, 10000.0, 100000.0)
                gradeValues = doubleArrayOf(-10.0, 0.0)
            }
            7 -> { // plenty of different slopes
                gradePositions =
                    doubleArrayOf(
                        0.0,
                        30000.0,
                        31000.0,
                        32000.0,
                        35000.0,
                        40000.0,
                        50000.0,
                        70000.0,
                        75000.0,
                        100000.0,
                    )
                gradeValues = doubleArrayOf(0.0, -20.0, 10.0, -15.0, 5.0, -2.0, 0.0, -10.0, 10.0)
            }
            else -> throw RuntimeException("Unable to handle this parameter in testDifferentSlopes")
        }

        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val length = 100000
        val testPath =
            EnvelopeSimPathBuilder.buildNonElectrified(
                length.toDouble(),
                gradePositions,
                gradeValues,
            )
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(50000.0, testContext.path.length)
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)

        val allowanceValue = AllowanceValue.Percentage(40.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceTime(maxEffortEnvelope, testContext, marecoAllowance)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        testAllowanceTime(maxEffortEnvelope, testContext, linearAllowance)
    }

    /** Test standard mareco allowance with different accelerating slopes */
    @Test
    @SuppressFBWarnings("FL_FLOATS_AS_LOOP_COUNTERS")
    fun testMarecoAcceleratingSlopes() {
        val length = 100000.0
        val gradeValues = DoubleArrayList()
        val gradePositions = DoubleArrayList()

        var begin = 0.0
        while (begin + 6000 < length) {
            gradePositions.add(begin)
            gradeValues.add(-10.0)
            gradePositions.add(begin + 2000)
            gradeValues.add(0.0)
            gradePositions.add(begin + 4000)
            gradeValues.add(10.0)
            gradePositions.add(begin + 6000)
            gradeValues.add(0.0)
            begin += 8000.0
        }
        gradePositions.add(length)

        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val testPath =
            EnvelopeSimPathBuilder.buildNonElectrified(
                length,
                gradePositions.toArray(),
                gradeValues.toArray(),
            )
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(50000.0, length)
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        val allowanceValue = AllowanceValue.Percentage(10.0)
        val allowance = makeStandardMarecoAllowance(0.0, testPath.length, 1.0, allowanceValue)
        val marecoEnvelope = allowance.apply(maxEffortEnvelope, testContext)
        val targetTime = allowance.getTargetTime(maxEffortEnvelope)
        val marginTime = marecoEnvelope.totalTime
        Assertions.assertEquals(marginTime, targetTime, testContext.timeStep)

        // The train space-speed curve is supposed to follow this complicated shape because of the
        // multiple
        // accelerating slopes.
        // If the test fails here, plot the curves to check if the curve makes sense and adapt the
        // shape.
        // It is not supposed to be an absolute shape, but at least to be triggered if MARECO
        // doesn't take into
        // account the accelerating slopes
        EnvelopeShape.check(
            marecoEnvelope,
            arrayOf(
                arrayOf(EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(
                    EnvelopeShape.DECREASING,
                    EnvelopeShape.INCREASING,
                    EnvelopeShape.DECREASING,
                    EnvelopeShape.INCREASING,
                    EnvelopeShape.DECREASING,
                    EnvelopeShape.INCREASING,
                ),
                arrayOf(EnvelopeShape.DECREASING),
                arrayOf(EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(
                    EnvelopeShape.DECREASING,
                    EnvelopeShape.INCREASING,
                    EnvelopeShape.DECREASING,
                ),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(
                    EnvelopeShape.DECREASING,
                    EnvelopeShape.INCREASING,
                    EnvelopeShape.DECREASING,
                ),
                arrayOf(EnvelopeShape.DECREASING),
            ),
        )
    }

    /**
     * Tests allowances on a short path where we can't reach max speed, we only check internal
     * asserts (convergence, envelope asserts)
     */
    @Test
    fun testShortAllowances() {
        val length = 100
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val allowanceValue = AllowanceValue.Percentage(10.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 100.0, false)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        makeSimpleAllowanceEnvelope(testContext, linearAllowance, 100.0, false)
    }

    /** Test allowance starting in a deceleration section */
    @Test
    fun testAllowancesStartDeceleration() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(6000.0, length.toDouble())

        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        var start = 0.0
        for (part in maxEffortEnvelope) {
            if (part.hasAttr(EnvelopeProfile.BRAKING)) {
                start = (part.beginPos + part.endPos) / 2
                break
            }
        }
        assert(start > 0)
        val allowanceValue = AllowanceValue.TimePerDistance(10.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        marecoAllowance.apply(maxEffortEnvelope, testContext)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        linearAllowance.apply(maxEffortEnvelope, testContext)
    }

    /** Test allowances ending in an acceleration section */
    @Test
    fun testAllowancesEndAcceleration() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(6000.0, length.toDouble())

        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        var end = 0.0
        for (part in maxEffortEnvelope) {
            if (part.hasAttr(EnvelopeProfile.ACCELERATING)) {
                end = (part.beginPos + part.endPos) / 2
            }
        }
        assert(end > 0)
        val allowanceValue = AllowanceValue.TimePerDistance(10.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        marecoAllowance.apply(maxEffortEnvelope, testContext)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        linearAllowance.apply(maxEffortEnvelope, testContext)
    }

    @Test
    fun testMarecoHighSlopeAtEnd() {
        val testRollingStock = SimpleRollingStock.SHORT_TRAIN

        val length = 15000
        val gradePositions = doubleArrayOf(0.0, 7000.0, 8100.0, length.toDouble())
        val gradeValues = doubleArrayOf(0.0, 40.0, 0.0)
        val testPath =
            EnvelopeSimPathBuilder.buildNonElectrified(
                length.toDouble(),
                gradePositions,
                gradeValues,
            )
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(length.toDouble())
        val begin = 3000
        val end = 8000

        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30.0, stops)
        val allowanceValue = FixedTime(10.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(begin.toDouble(), end.toDouble(), 1.0, allowanceValue)
        marecoAllowance.apply(maxEffortEnvelope, testContext)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(begin.toDouble(), end.toDouble(), 1.0, allowanceValue)
        linearAllowance.apply(maxEffortEnvelope, testContext)
    }

    @Test
    fun testAllowancesDiscontinuity() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(length.toDouble())
        val begin = 2000

        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 30.0, stops)
        val allowanceValue = AllowanceValue.Percentage(90.0)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(begin.toDouble(), length.toDouble(), 10.0, allowanceValue)
        marecoAllowance.apply(maxEffortEnvelope, testContext)

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(begin.toDouble(), length.toDouble(), 10.0, allowanceValue)
        linearAllowance.apply(maxEffortEnvelope, testContext)
    }

    @Test
    fun testAllowancesErrors() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val allowanceValue = AllowanceValue.Percentage(1e10)

        // test mareco distribution
        val marecoAllowance =
            makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        val marecoException =
            Assertions.assertThrows(OSRDError::class.java) {
                makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 44.4, true)
            }
        Assertions.assertEquals(
            marecoException.osrdErrorType,
            ErrorType.AllowanceConvergenceTooMuchTime,
        )

        // test linear distribution
        val linearAllowance =
            makeStandardLinearAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        val linearException =
            Assertions.assertThrows(OSRDError::class.java) {
                makeSimpleAllowanceEnvelope(testContext, linearAllowance, 44.4, true)
            }
        Assertions.assertEquals(
            linearException.osrdErrorType,
            ErrorType.AllowanceConvergenceTooMuchTime,
        )
        assert(linearException.cause == ErrorCause.USER)
    }

    @Test
    fun testShortLinear() {
        val length = 1000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0, 2.0)
        val stops = doubleArrayOf(length.toDouble())

        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 100.0, stops)

        val allowance =
            LinearAllowance(
                800.0,
                810.0,
                10.0,
                listOf(AllowanceRange(800.0, 810.0, AllowanceValue.Percentage(10.0))),
            )
        val thrown =
            Assertions.assertThrows(OSRDError::class.java) {
                allowance.apply(maxEffortEnvelope, testContext)
            }
        Assertions.assertEquals(thrown.osrdErrorType, ErrorType.AllowanceConvergenceTooMuchTime)
    }

    @Test
    fun testMarecoAfterLinear() {
        val length = 2524
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0, 2.0)
        val stops = doubleArrayOf(length.toDouble())

        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 100.0, stops)

        val firstAllowance =
            LinearAllowance(
                655.0,
                2258.0,
                9.1,
                listOf(AllowanceRange(655.0, 2258.0, AllowanceValue.Percentage(8.1))),
            )

        val secondAllowance =
            MarecoAllowance(
                485.0,
                2286.0,
                3.44,
                listOf(AllowanceRange(485.0, 2286.0, AllowanceValue.Percentage(13.0))),
            )
        secondAllowance.apply(firstAllowance.apply(maxEffortEnvelope, testContext), testContext)
    }

    @Test
    fun testPercentageAfterTimePerDistance() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0, 2.0)
        val stops = doubleArrayOf(10000.0)

        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 40.0, stops)

        val allowance =
            MarecoAllowance(
                0.0,
                10000.0,
                1.0,
                listOf(
                    AllowanceRange(0.0, 8000.0, AllowanceValue.TimePerDistance(1000.0)),
                    AllowanceRange(8000.0, 10000.0, AllowanceValue.Percentage(10.0)),
                ),
            )
        allowance.apply(maxEffortEnvelope, testContext)
    }

    companion object {
        /** test allowance data */
        fun makeStandardMarecoAllowance(
            beginPos: Double,
            endPos: Double,
            capacitySpeedLimit: Double,
            value: AllowanceValue,
        ): MarecoAllowance {
            val defaultRange = listOf(AllowanceRange(beginPos, endPos, value))
            return MarecoAllowance(beginPos, endPos, capacitySpeedLimit, defaultRange)
        }

        private fun makeStandardLinearAllowance(
            beginPos: Double,
            endPos: Double,
            capacitySpeedLimit: Double,
            value: AllowanceValue,
        ): LinearAllowance {
            val defaultRange = listOf(AllowanceRange(beginPos, endPos, value))
            return LinearAllowance(beginPos, endPos, capacitySpeedLimit, defaultRange)
        }

        /** build test allowance data */
        fun makeSimpleAllowanceEnvelope(
            context: EnvelopeSimContext,
            allowance: Allowance,
            speed: Double,
            stop: Boolean,
        ): Envelope {
            val path = context.path
            val stops = if (stop) doubleArrayOf(6000.0, path.length) else doubleArrayOf(path.length)
            val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(context, speed, stops)
            return allowance.apply(maxEffortEnvelope, context)
        }
    }
}
