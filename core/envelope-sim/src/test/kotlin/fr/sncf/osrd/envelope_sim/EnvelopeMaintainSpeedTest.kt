package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope.Envelope.Companion.make
import fr.sncf.osrd.envelope.EnvelopeShape
import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class EnvelopeMaintainSpeedTest {
    @Test
    fun suddenSlope() {
        val stops = listOf<SimStop>()
        val path =
            EnvelopeSimPathBuilder.buildNonElectrified(
                10000.0,
                doubleArrayOf(0.0, 5000.0, 6000.0, 7000.0, 8000.0, 8500.0, 9000.0, 10000.0),
                doubleArrayOf(0.0, 40.0, -40.0, 0.0, 50.0, -50.0, 0.0),
            )
        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val context =
            EnvelopeSimContext(
                testRollingStock,
                path,
                SimpleContextBuilder.TIME_STEP,
                SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP,
            )

        val flatMRSP =
            make(
                generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 10000.0),
                    doubleArrayOf(44.4, 44.4),
                )
            )
        val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, flatMRSP)
        val maxEffortEnvelope = maxEffortEnvelopeFrom(context, 0.0, maxSpeedEnvelope)
        EnvelopeShape.check(
            maxEffortEnvelope,
            arrayOf(
                arrayOf(EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
                arrayOf(EnvelopeShape.DECREASING, EnvelopeShape.INCREASING),
                arrayOf(EnvelopeShape.CONSTANT),
            ),
        )
        Assertions.assertTrue(maxEffortEnvelope.continuous)
    }
}
