package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope_sim.*
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

internal class EnvelopePartTest {
    @Test
    fun toStringTest() {
        val part =
            generateTimes(
                listOf(EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 5.0),
                doubleArrayOf(3.0, 4.0),
            )
        Assertions.assertEquals("EnvelopePart { EnvelopeProfile=ACCELERATING }", part.toString())
    }

    @Test
    fun getAttrTest() {
        val part =
            generateTimes(
                listOf(EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 5.0),
                doubleArrayOf(3.0, 4.0),
            )
        Assertions.assertEquals(
            EnvelopeProfile.ACCELERATING,
            part.getAttr(EnvelopeProfile::class.java),
        )
    }

    @Test
    fun interpolateSpeedTest() {
        val ep = EnvelopeTestUtils.generateTimes(doubleArrayOf(1.5, 5.0), doubleArrayOf(3.0, 4.0))
        val interpolatedSpeed = ep.interpolateSpeed(2.75)
        // the delta here is pretty high, as we allow both approximate and exact methods
        Assertions.assertEquals(3.36, interpolatedSpeed, 0.04)
    }

    @Test
    fun findStep() {
        val ep =
            EnvelopeTestUtils.generateTimes(
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 4.0, 4.0),
            )

        Assertions.assertEquals(0, ep.findLeft(1.5))
        Assertions.assertEquals(0, ep.findRight(1.5))

        Assertions.assertEquals(0, ep.findLeft(3.0))
        Assertions.assertEquals(1, ep.findRight(3.0))

        Assertions.assertEquals(1, ep.findLeft(3.5))
        Assertions.assertEquals(1, ep.findRight(3.5))

        Assertions.assertEquals(1, ep.findLeft(5.0))
        Assertions.assertEquals(1, ep.findRight(5.0))

        Assertions.assertEquals(-1, ep.findLeft(1.0))
        Assertions.assertEquals(-4, ep.findLeft(5.1))
        Assertions.assertEquals(-1, ep.findRight(1.0))
        Assertions.assertEquals(-4, ep.findRight(5.1))
    }

    @Test
    fun testEquals() {
        val ep1 =
            generateTimes(
                listOf(EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 4.0, 4.0),
            )
        val ep2 =
            generateTimes(
                listOf(EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 4.0, 4.0),
            )
        val ep3 =
            generateTimes(
                listOf(EnvelopeProfile.COASTING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 4.0, 4.0),
            )
        Assertions.assertEquals(ep1, ep2)
        Assertions.assertEquals(ep1.hashCode(), ep2.hashCode())
        Assertions.assertNotEquals(ep1, ep3)
        Assertions.assertNotEquals(ep1.hashCode(), ep3.hashCode())
    }

    @Test
    fun testGetMechanicalEnergyConsumed() {
        val length = 50000
        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val testEffortCurveMap = SimpleRollingStock.HYPERBOLIC_EFFORT_CURVE_MAP
        val testPath = FlatPath(length.toDouble(), 0.0)
        val testContext = EnvelopeSimContext(testRollingStock, testPath, 4.0, testEffortCurveMap)
        val allowanceValue = AllowanceValue.Percentage(10.0)

        val marecoAllowance =
            AllowanceTests.makeStandardMarecoAllowance(0.0, length.toDouble(), 1.0, allowanceValue)
        val envelopeAllowance =
            AllowanceTests.makeSimpleAllowanceEnvelope(testContext, marecoAllowance, 44.4, false)

        for (i in 0..<envelopeAllowance.size()) {
            val envelopePart = envelopeAllowance.get(i)
            val envelopePartEnergy =
                EnvelopePhysics.getPartMechanicalEnergyConsumed(
                    envelopePart,
                    testContext.path,
                    testContext.rollingStock,
                )
            val expectedEnvelopePartEnergy: Double
            when (i) {
                0 ->
                    expectedEnvelopePartEnergy =
                        (PhysicsRollingStock.getMaxEffort(1.0, testEffortCurveMap[0.0]) *
                            envelopePart.totalTimeUS / 1000000)
                1 -> {
                    Assertions.assertEquals(envelopePart.minSpeed, envelopePart.maxSpeed)
                    expectedEnvelopePartEnergy =
                        (testRollingStock.getRollingResistance(envelopePart.beginSpeed) *
                            envelopePart.totalDistance)
                }
                2 -> expectedEnvelopePartEnergy = 0.0
                3 -> {
                    Assertions.assertTrue(envelopePartEnergy <= 0)
                    continue
                }
                else -> expectedEnvelopePartEnergy = 0.0
            }
            Assertions.assertEquals(
                expectedEnvelopePartEnergy,
                envelopePartEnergy,
                0.1 * expectedEnvelopePartEnergy + 1000,
            )
        }
    }
}
