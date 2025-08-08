package fr.sncf.osrd.envelope_sim

import com.google.common.collect.Range
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.envelope.EnvelopeShape
import fr.sncf.osrd.envelope.EnvelopeTransitions
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeComplexMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.MaxEffortEnvelopeBuilder.makeSimpleMaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class MaxEffortEnvelopeTest {
    @Test
    fun testFlat() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(6000.0, length.toDouble())
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops)
        EnvelopeShape.check(
            maxEffortEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
        )
        val delta = 2 * maxEffortEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 2726.0, 4029.0, 6000.0, 8292.0)
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }

    @Test
    fun testFlatNonConstDec() {
        val testRollingStock = SimpleRollingStock.MAX_DEC_TRAIN
        val testPath = FlatPath(10000.0, 0.0)
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(6000.0, testPath.length)
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops)
        EnvelopeShape.check(
            maxEffortEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
        )
        val delta = 2 * maxEffortEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(
            maxEffortEnvelope,
            delta,
            2726.0,
            4993.0,
            6000.0,
            8727.0,
            8993.0,
        )
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }

    @Test
    fun testSteep() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 20.0)
        val stops = doubleArrayOf(6000.0, length.toDouble())
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops)
        EnvelopeShape.check(
            maxEffortEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
        )
        val delta = 2 * maxEffortEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 4380.0, 6000.0, 8827.0)
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }

    @Test
    fun testSteepNonConstDec() {
        val testRollingStock = SimpleRollingStock.MAX_DEC_TRAIN
        val testPath = FlatPath(10000.0, 20.0)
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(6000.0, testPath.length)
        val maxEffortEnvelope = makeSimpleMaxEffortEnvelope(testContext, 44.4, stops)
        EnvelopeShape.check(
            maxEffortEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
        )
        val delta = 2 * maxEffortEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.01s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxEffortEnvelope, delta, 5216.0, 6000.0, 9417.0)
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }

    @Test
    fun testWithComplexMRSP() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf(50000.0, length.toDouble())
        val maxEffortEnvelope = makeComplexMaxEffortEnvelope(testContext, stops)
        EnvelopeShape.check(
            maxEffortEnvelope,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.INCREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.INCREASING,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
        )
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }

    @Test
    fun testAccelerationInShortPart() {
        val length = 10000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops = doubleArrayOf((length - 1).toDouble(), length.toDouble())
        makeSimpleMaxEffortEnvelope(testContext, 10000.0, stops)
    }

    @Test
    fun testOverlappingBrakingCurves() {
        val testContext = SimpleContextBuilder.makeSimpleContext(100.0, 0.0)
        val stops = listOf<SimStop>()
        val mrspBuilder = MRSPEnvelopeBuilder()
        mrspBuilder.addPart(
            generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(0.0, 50.0),
                doubleArrayOf(30.0, 30.0),
            )
        )
        mrspBuilder.addPart(
            generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(50.0, 51.0),
                doubleArrayOf(29.0, 29.0),
            )
        )
        mrspBuilder.addPart(
            generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(51.0, 100.0),
                doubleArrayOf(1.0, 1.0),
            )
        )
        val mrsp = mrspBuilder.build()
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(testContext, stops, mrsp)
        maxEffortEnvelopeFrom(testContext, 0.0, maxSpeedEnvelope)
    }

    @Test
    fun testNotEnoughTractionToStart() {
        val length = 10000
        val path = FlatPath(length.toDouble(), 1000.0)
        val testContext =
            EnvelopeSimContext(
                SimpleRollingStock.STANDARD_TRAIN,
                path,
                2.0,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(length.toDouble())
        val osrdError =
            Assertions.assertThrows(OSRDError::class.java) {
                makeSimpleMaxEffortEnvelope(testContext, 44.4, stops)
            }
        Assertions.assertEquals(osrdError.osrdErrorType, ErrorType.ImpossibleSimulationError)
    }

    @Test
    fun testNotEnoughTractionToRestart() {
        val length = 10000
        val path =
            EnvelopeSimPathBuilder.buildNonElectrified(
                length.toDouble(),
                doubleArrayOf(0.0, 5000.0, 5100.0, length.toDouble()),
                doubleArrayOf(0.0, 1000.0, 0.0),
            )
        val testContext =
            EnvelopeSimContext(
                SimpleRollingStock.STANDARD_TRAIN,
                path,
                2.0,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = doubleArrayOf(5100.0, length.toDouble())
        val osrdError =
            Assertions.assertThrows(OSRDError::class.java) {
                makeSimpleMaxEffortEnvelope(testContext, 44.4, stops)
            }
        Assertions.assertEquals(osrdError.osrdErrorType, ErrorType.ImpossibleSimulationError)
    }

    /**
     * Reproduces a bug where the train would "miss" accelerations when there are many small plateau
     * with identical max speed before an acceleration. See issue #3385.
     */
    @Test
    fun testSeveralSmallPlateau() {
        val testContext = SimpleContextBuilder.makeSimpleContext(100.0, 0.0)
        val stops = listOf(SimStop(Offset(3000.meters), RJSReceptionSignal.SHORT_SLIP_STOP))
        val mrspBuilder = MRSPEnvelopeBuilder()
        for (i in 0..199) {
            mrspBuilder.addPart(
                generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf((i * 10).toDouble(), ((i + 1) * 10).toDouble()),
                    doubleArrayOf(30.0, 30.0),
                )
            )
        }
        mrspBuilder.addPart(
            generateTimes(
                listOf(EnvelopeProfile.CONSTANT_SPEED),
                doubleArrayOf(2000.0, 3000.0),
                doubleArrayOf(1000.0, 1000.0),
            )
        )
        val mrsp = mrspBuilder.build()
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(testContext, stops, mrsp)
        maxEffortEnvelopeFrom(testContext, 0.0, maxSpeedEnvelope)
    }

    /**
     * The speed can't be maintained, just one time step before the last one. The MRSP also
     * increases during that last step. Reproduces a bug.
     */
    @Test
    fun testSingleStepDeclivity() {
        val testRollingStock = SimpleRollingStock.SHORT_TRAIN
        val testPath = FlatPath(10.0, 1000.0)
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP * 10,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )
        val stops = listOf<SimStop>()
        val speeds = TreeRangeMap.create<Double, Double>()
        speeds.put(Range.open(0.0, 9.0), 40.0)
        speeds.put(Range.open(9.0, 10.0), 60.0)
        val mrsp = TestMRSPBuilder.makeSimpleMRSP(testContext, speeds)
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(testContext, stops, mrsp)
        val maxEffortEnvelope = maxEffortEnvelopeFrom(testContext, 40.0, maxSpeedEnvelope)
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }
}
