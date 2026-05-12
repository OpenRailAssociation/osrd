package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.stdcm.DEFAULT_TIME_STEP
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.concatenateAndShiftEnvelopes
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.path.utils.FakePhysicsPath
import fr.sncf.osrd.stdcm.graph.FixedTimePoint
import fr.sncf.osrd.stdcm.graph.runSimulationWithFixedPoints
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.areSpeedsEqual
import fr.sncf.osrd.utils.areTimesEqual
import java.util.TreeSet
import kotlin.test.Test
import kotlin.test.assertEquals

class PostProcessingSimulationTests {
    fun makeTestEnvelope(
        endPos: Double,
        beginSpeed: Double = 0.0,
        endSpeed: Double = beginSpeed,
    ): Envelope {
        val profile =
            if (beginSpeed == endSpeed) {
                EnvelopeProfile.CONSTANT_SPEED
            } else if (beginSpeed < endSpeed) {
                EnvelopeProfile.ACCELERATING
            } else {
                EnvelopeProfile.BRAKING
            }

        if (endPos == 0.0) {
            require(beginSpeed == endSpeed)
            return Envelope(
                arrayOf(
                    EnvelopePart(
                        attrs = listOf(profile),
                        positions = doubleArrayOf(0.0),
                        speeds = doubleArrayOf(beginSpeed),
                        timeDeltas = doubleArrayOf(),
                    )
                )
            )
        }

        // Assuming constant acceleration/braking
        val meanSpeed = (beginSpeed + endSpeed) / 2
        require(meanSpeed > 0) { "Mean speed must be positive to compute time taken" }
        val timeTaken = endPos / meanSpeed

        val part =
            EnvelopePart(
                attrs = listOf(profile),
                positions = doubleArrayOf(0.0, endPos),
                speeds = doubleArrayOf(beginSpeed, endSpeed),
                timeDeltas = doubleArrayOf(timeTaken),
            )
        return Envelope(arrayOf(part))
    }

    @Test
    fun `runSimulationWithFixedPoints returns each envelope once when no fixed points apply`() {
        val envelope1 =
            concatenateAndShiftEnvelopes(
                listOf(
                    makeTestEnvelope(endPos = 1_000.0, beginSpeed = 0.0, endSpeed = 20.0),
                    makeTestEnvelope(endPos = 1_000.0, beginSpeed = 20.0, endSpeed = 0.0),
                )
            )

        val envelope2 = makeTestEnvelope(endPos = 1_000.0, beginSpeed = 0.0, endSpeed = 20.0)

        val envelopes = listOf(envelope1, envelope2)
        val rollingStocks = List(2) { TestTrains.REALISTIC_FAST_TRAIN }
        val physicsPath = FakePhysicsPath.flatUnelectrified(length = envelopes.sumOf { it.endPos })

        // No fixed points -> envelope shouldn't be modified
        val fixedPoints = sortedSetOf<FixedTimePoint>()
        val result =
            runSimulationWithFixedPoints(
                envelopes = envelopes,
                envelopeSimPath = physicsPath,
                rollingStocks = rollingStocks,
                fixedPoints = TreeSet(fixedPoints),
                timeStep = DEFAULT_TIME_STEP.seconds,
                comfort = null,
            )

        assertEquals(envelopes.size, result.size)
        envelopes.zip(result).forEach { (input, output) ->
            assert(arePositionsEqual(input.endPos, output.endPos))
            assert(areSpeedsEqual(input.endSpeed, output.endSpeed))
            assert(areTimesEqual(input.totalTime, output.totalTime))
            val inputParts = input.toList()
            val outputParts = output.toList()
            // Note: this assumes MARECO doesn't split or merge parts when given no room to
            // decelerate.
            // If this changes, we can remove this assertion
            assertEquals(inputParts.size, outputParts.size)
        }
    }
}
