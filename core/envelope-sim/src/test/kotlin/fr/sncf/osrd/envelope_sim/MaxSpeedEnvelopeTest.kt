package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope.EnvelopeShape
import fr.sncf.osrd.envelope.EnvelopeTransitions
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Test

class MaxSpeedEnvelopeTest {
    @Test
    fun testFlat() {
        val testContext = SimpleContextBuilder.makeSimpleContext(100000.0, 0.0)
        val stops = listOf(SimStop(Offset(8500.0.meters), RJSReceptionSignal.SHORT_SLIP_STOP))

        val flatMRSP = TestMRSPBuilder.makeSimpleMRSP(testContext, 44.4)
        val context = SimpleContextBuilder.makeSimpleContext(100000.0, 0.0)
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, flatMRSP)
        EnvelopeShape.check(
            maxSpeedEnvelope,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
        )
        val delta = 2 * maxSpeedEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 6529.0, 8500.0)
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false)
    }

    @Test
    fun testSteep() {
        val testContext = SimpleContextBuilder.makeSimpleContext(10000.0, 20.0)
        val stops = listOf(SimStop(Offset(8500.meters), RJSReceptionSignal.STOP))

        val flatMRSP = TestMRSPBuilder.makeSimpleMRSP(testContext, 44.4)
        val context = SimpleContextBuilder.makeSimpleContext(10000.0, 20.0)
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, flatMRSP)
        EnvelopeShape.check(
            maxSpeedEnvelope,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
        )
        val delta = 2 * maxSpeedEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 6529.0, 8500.0)
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false)
    }

    @Test
    fun testInitialStop() {
        val testContext = SimpleContextBuilder.makeSimpleContext(10000.0, 0.0)
        val stops = listOf(SimStop(Offset(0.meters), RJSReceptionSignal.OPEN))

        val flatMRSP = TestMRSPBuilder.makeSimpleMRSP(testContext, 44.4)
        val context = SimpleContextBuilder.makeSimpleContext(10000.0, 0.0)
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, flatMRSP)
        EnvelopeShape.check(maxSpeedEnvelope, EnvelopeShape.CONSTANT)
    }

    @Test
    fun testFlatNonConstDec() {
        val testRollingStock = SimpleRollingStock.MAX_DEC_TRAIN
        val effortCurveMap = SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP
        val testPath = FlatPath(10000.0, 0.0)
        val testContext =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                effortCurveMap,
            )
        val stops = listOf(SimStop(Offset(8500.meters), RJSReceptionSignal.SHORT_SLIP_STOP))

        val flatMRSP = TestMRSPBuilder.makeSimpleMRSP(testContext, 44.4)
        val context =
            EnvelopeSimContext(
                testRollingStock,
                testPath,
                SimpleContextBuilder.TIME_STEP,
                effortCurveMap,
            )
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, flatMRSP)
        EnvelopeShape.check(
            maxSpeedEnvelope,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
        )
        val delta = 2 * maxSpeedEnvelope.maxSpeed * SimpleContextBuilder.TIME_STEP
        // don't modify these values, they have been calculated with a 0.1s timestep so they can be
        // considered as
        // reference, the delta is supposed to absorb the difference for higher timesteps
        EnvelopeTransitions.checkPositions(maxSpeedEnvelope, delta, 7493.0, 8500.0)
        EnvelopeTransitions.checkContinuity(maxSpeedEnvelope, true, false)
    }

    @Test
    fun testWithComplexMRSP() {
        val length = 100000
        val testContext = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val stops =
            listOf(
                SimStop(Offset(50000.meters), RJSReceptionSignal.SHORT_SLIP_STOP),
                SimStop(Offset(length.meters), RJSReceptionSignal.SHORT_SLIP_STOP),
            )

        val mrsp = TestMRSPBuilder.makeComplexMRSP(testContext)
        val context = SimpleContextBuilder.makeSimpleContext(length.toDouble(), 0.0)
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, mrsp)
        EnvelopeShape.check(
            maxSpeedEnvelope,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
            EnvelopeShape.CONSTANT,
            EnvelopeShape.DECREASING,
        )
        EnvelopeTransitions.checkContinuity(
            maxSpeedEnvelope,
            false,
            true,
            true,
            true,
            false,
            false,
            false,
            true,
            true,
            true,
        )
    }
}
