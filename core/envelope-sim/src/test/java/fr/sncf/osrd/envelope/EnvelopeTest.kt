package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.Envelope.Companion.make
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.areSpeedsEqual
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

class EnvelopeTest {
    @Test
    fun testContinuity() {
        val partA =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 1.0), doubleArrayOf(1.0, 1.0))
        val partB =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(2.0, 3.0), doubleArrayOf(1.0, 1.0))
        val partC =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(1.0, 2.0), doubleArrayOf(2.0, 2.0))
        val partD =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(1.0, 2.0), doubleArrayOf(1.0, 1.0))
        assertThrows(RuntimeException::class.java) { make(partA, partB) }
        assertTrue(make(partA, partD).continuous)
        assertFalse(make(partA, partC).continuous)
    }

    @Test
    fun testIterator() {
        val a = EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 2.0), doubleArrayOf(2.0, 2.0))
        val envelope = make(a)
        val res = ArrayList<EnvelopePart>()
        envelope.iterator().forEachRemaining { e: EnvelopePart -> res.add(e) }
        assertEquals(1, res.size)
        assertEquals(a, res[0])
    }

    @Test
    fun testMinMaxSpeed() {
        val partA =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 2.0), doubleArrayOf(1.0, 2.0))
        val partB =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(2.0, 4.0), doubleArrayOf(4.0, 3.0))
        val envelope = make(partA, partB)

        assertEquals(1.0, partA.minSpeed)
        assertEquals(2.0, partA.maxSpeed)
        assertEquals(3.0, partB.minSpeed)
        assertEquals(4.0, partB.maxSpeed)

        assertEquals(1.0, envelope.minSpeed)
        assertEquals(4.0, envelope.maxSpeed)
    }

    @Test
    fun testInterpolateSpeed() {
        val partA =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 2.0), doubleArrayOf(1.0, 2.0))
        val partB =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(2.0, 3.0), doubleArrayOf(2.0, 4.0))
        val envelope = make(partA, partB)

        assertEquals(1.0, envelope.interpolateSpeed(0.0))
        assertEquals(2.0, envelope.interpolateSpeed(2.0))
        assertEquals(4.0, envelope.interpolateSpeed(3.0))
    }

    @Test
    fun testInterpolateDepartureFrom() {
        val partA =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 2.0), doubleArrayOf(1.0, 1.0))
        val partB =
            EnvelopeTestUtils.generateTimes(doubleArrayOf(2.0, 4.0), doubleArrayOf(1.0, 1.0))
        val envelope = make(partA, partB)

        assertEquals(1.0, partA.interpolateTotalTime(1.0))

        assertEquals(1.0, envelope.interpolateDepartureFrom(1.0))
        assertEquals(2.0, envelope.interpolateDepartureFrom(2.0))
        assertEquals(2.0, envelope.interpolateDepartureFrom(2.0))
        assertEquals(3.0, envelope.interpolateDepartureFrom(3.0))
        assertEquals(3.5, envelope.interpolateDepartureFrom(3.5))
        assertEquals(4.0, envelope.interpolateDepartureFrom(4.0))
    }

    @Test
    fun testMinEnvelopesThrowsWhenDifferentPositionRanges() {
        val envelopeA =
            make(
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(0.0, 10.0),
                    doubleArrayOf(100.0, 100.0),
                )
            )
        val envelopeB =
            make(
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(5.0, 10.0),
                    doubleArrayOf(100.0, 100.0),
                )
            )
        val envelopeC =
            make(
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(0.0, 15.0),
                    doubleArrayOf(100.0, 100.0),
                )
            )
        val envelopeD =
            make(
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(5.0, 15.0),
                    doubleArrayOf(100.0, 100.0),
                )
            )
        assertThrows(AssertionError::class.java) { minEnvelopes(envelopeA, envelopeB) }
        assertThrows(AssertionError::class.java) { minEnvelopes(envelopeA, envelopeC) }
        assertThrows(AssertionError::class.java) { minEnvelopes(envelopeA, envelopeD) }
    }

    @ParameterizedTest
    @MethodSource("minEnvelopePartsArgs")
    fun testMinEnvelopeParts(
        envelopeA: Envelope,
        envelopeB: Envelope,
        intersectionIndex: Int,
        expectedPositions: List<Double>,
        expectedSpeeds: List<Double>,
    ) {
        val minEnvelope = minEnvelopes(envelopeA, envelopeB)
        val resultingPoints = minEnvelope.iteratePoints()
        val resultingPositions = resultingPoints.map { it.position }
        val resultingSpeeds = resultingPoints.map { it.speed }

        // Check that both envelopes have an equal speed at their intersection.
        val intersectionPosition = resultingPositions[intersectionIndex]
        val intersectionSpeed = resultingSpeeds[intersectionIndex]
        val directionAscending = 1.0
        assertTrue(
            areSpeedsEqual(
                envelopeA.interpolateSpeedLeftDir(intersectionPosition, directionAscending),
                intersectionSpeed,
            )
        )
        assertTrue(
            areSpeedsEqual(
                envelopeB.interpolateSpeedLeftDir(intersectionPosition, directionAscending),
                intersectionSpeed,
            )
        )

        // Check that the positions and speeds are as expected.
        assertEquals(expectedPositions.size, resultingPositions.size)
        assertEquals(expectedSpeeds.size, resultingSpeeds.size)
        for (i in resultingPositions.indices) {
            assertTrue(arePositionsEqual(expectedPositions[i], resultingPositions[i]))
            assertTrue(areSpeedsEqual(expectedSpeeds[i], resultingSpeeds[i]))
        }
    }

    companion object {
        @JvmStatic
        private fun minEnvelopePartsArgs(): Stream<Arguments> {
            val partA =
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(0.0, 20.0),
                    doubleArrayOf(150.0, 50.0),
                )
            val partB =
                EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 20.0), doubleArrayOf(200.0, 0.0))
            val partC1 =
                EnvelopeTestUtils.generateTimes(doubleArrayOf(0.0, 10.0), doubleArrayOf(50.0, 0.0))
            val partC2 =
                EnvelopeTestUtils.generateTimes(
                    doubleArrayOf(10.0, 20.0),
                    doubleArrayOf(200.0, 0.0),
                )
            val envelopeA = make(partA)
            val envelopeB = make(partB)
            val envelopeC = make(partC1, partC2)
            val intersectionAB = 17.5
            val speedIntersectionAB = envelopeA.interpolateSpeed(intersectionAB)
            val intersectionAC = 19.166666666666668
            val speedIntersectionAC = envelopeA.interpolateSpeed(intersectionAC)
            return Stream.of(
                Arguments.of(
                    envelopeA,
                    envelopeB,
                    1,
                    listOf(0.0, intersectionAB, 20.0),
                    listOf(150.0, speedIntersectionAB, 0.0),
                ),
                Arguments.of(
                    envelopeA,
                    envelopeC,
                    3,
                    listOf(0.0, 10.0, 10.0, intersectionAC, 20.0),
                    listOf(50.0, 0.0, envelopeA.interpolateSpeed(10.0), speedIntersectionAC, 0.0),
                ),
            )
        }
    }
}
