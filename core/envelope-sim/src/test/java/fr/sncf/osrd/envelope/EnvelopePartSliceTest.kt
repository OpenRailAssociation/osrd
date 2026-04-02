package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class EnvelopePartSliceTest {
    @Test
    fun sliceIndex() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 4.0, 4.0),
            )
        val ep2 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0),
                doubleArrayOf(3.0, 4.0),
            )
        val slice = ep1.sliceIndex(0, 1)
        EnvelopeTestUtils.assertEquals(slice, ep2)
        Assertions.assertEquals(slice.hashCode(), ep2.hashCode())
    }

    @Test
    fun sliceIndexFull() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 3.0, 4.0),
            )
        val slice = ep1.sliceIndex(0, 2)
        EnvelopeTestUtils.assertEquals(slice, ep1)
        Assertions.assertEquals(slice.hashCode(), ep1.hashCode())
    }

    @Test
    fun sliceIndexEmpty() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 3.0, 4.0),
            )
        val slice = ep1.sliceIndex(0, 0)
        Assertions.assertNull(slice)
    }

    @Test
    fun sliceOffsetEmpty() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 3.0, 4.0),
            )
        val slice = ep1.slice(Double.NEGATIVE_INFINITY, 1.5)
        Assertions.assertNull(slice)
    }

    @Test
    fun sliceOffsetFull() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.5, 3.0, 5.0),
                doubleArrayOf(3.0, 3.0, 4.0),
            )
        val slice = ep1.slice(Double.NEGATIVE_INFINITY, 5.0)
        EnvelopeTestUtils.assertEquals(ep1, slice)
    }

    @Test
    fun sliceOffsetInterpolate() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.BRAKING),
                doubleArrayOf(0.0, 3.0),
                doubleArrayOf(3.46, 0.0),
            )
        val slice = ep1.slice(Double.NEGATIVE_INFINITY, 2.0)
        val expectedSlice =
            EnvelopePart(
                listOf(TestAttr.A, EnvelopeProfile.BRAKING),
                doubleArrayOf(0.0, 2.0),
                doubleArrayOf(3.46, 2.0),
                doubleArrayOf(0.73),
            )
        EnvelopeTestUtils.assertEquals(expectedSlice, slice)
    }

    @Test
    fun sliceWithImposedSpeeds() {
        val ep1 =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(1.0, 3.0, 5.0),
                doubleArrayOf(3.0, 3.0, 4.0),
            )
        val slice = ep1.sliceWithSpeeds(2.0, 3.0, 4.0, 3.5)
        val expectedSlice =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(2.0, 3.0, 4.0),
                doubleArrayOf(3.0, 3.0, 3.5),
            )
        EnvelopeTestUtils.assertEquals(expectedSlice, slice)
    }

    /** Reproduces a bug where the sliced part would have negative time deltas */
    @Test
    fun sliceWithEpsilonAcceleration() {
        val ep =
            generateTimes(
                listOf(TestAttr.A, EnvelopeProfile.ACCELERATING),
                doubleArrayOf(0.0, 100.0),
                doubleArrayOf(10.0, 10 + 1e-8),
            )
        ep.slice(50.0, 100.0) // The relevant assertions are made in `EnvelopePart.runSanityChecks`
    }
}
