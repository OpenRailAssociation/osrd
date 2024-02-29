package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.arePositionsEqual
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.areTimesEqual
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class InfraExplorerWithEnvelopeTests {

    @Test
    fun testTwoDifferentPaths() {
        /*
                 c1
                ^
               /
        a --> b
               \
                v
                 c2
         */
        val infra = DummyInfra()
        val fullInfra = infra.fullInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c1"),
                infra.addBlock("c1", "d"),
                infra.addBlock("b", "c2"),
            )

        // a --> b
        val firstExplorers =
            initInfraExplorerWithEnvelope(
                fullInfra,
                PathfindingEdgeLocationId(blocks[0], Offset(0.meters)),
                rollingStock = REALISTIC_FAST_TRAIN
            )
        assertEquals(1, firstExplorers.size)
        val firstExplorer = firstExplorers.first()

        // current block a->b, lookahead b->c1 and b->c2
        val extended = firstExplorer.cloneAndExtendLookahead().toList()
        assertEquals(2, extended.size)

        // Move forward once, current block b->c1 and b->c2, lookahead c1->d->e and c2->d->e
        extended[0].addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(30.0, 30.0)
                )
            )
        )
        extended[0].moveForward()
        extended[1].addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(20.0, 20.0)
                )
            )
        )
        extended[1].moveForward()
        extended[0].addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(30.0, 30.0)
                )
            )
        )
        extended[1].addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(20.0, 20.0)
                )
            )
        )

        testEnvelopeTimeEquality(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 200.0),
                    doubleArrayOf(30.0, 30.0)
                )
            ),
            extended[0].getFullEnvelope()
        )
        testEnvelopeTimeEquality(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 200.0),
                    doubleArrayOf(20.0, 20.0)
                )
            ),
            extended[1].getFullEnvelope()
        )
    }

    @Test
    fun testClone() {
        /*
        a --> b --> c
         */
        val infra = DummyInfra()
        val fullInfra = infra.fullInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b"),
                infra.addBlock("b", "c"),
            )

        // a --> b
        val firstExplorers =
            initInfraExplorerWithEnvelope(
                fullInfra,
                PathfindingEdgeLocationId(blocks[0], Offset(0.meters)),
                rollingStock = REALISTIC_FAST_TRAIN
            )
        assertEquals(1, firstExplorers.size)
        var explorer = firstExplorers.first()

        // current block a->b, lookahead b->c
        val extended = explorer.cloneAndExtendLookahead().toList()
        assertEquals(1, extended.size)
        explorer = extended.first()

        // Move forward
        explorer.addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(30.0, 30.0)
                )
            )
        )
        explorer.moveForward()

        val cloned = explorer.clone()

        // Add different envelopes to each version
        explorer.addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(30.0, 30.0)
                )
            )
        )
        cloned.addEnvelope(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0),
                    doubleArrayOf(42.0, 42.0)
                )
            )
        )

        testEnvelopeTimeEquality(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 200.0),
                    doubleArrayOf(30.0, 30.0)
                )
            ),
            explorer.getFullEnvelope()
        )
        testEnvelopeTimeEquality(
            Envelope.make(
                EnvelopePart.generateTimes(
                    listOf(EnvelopeProfile.CONSTANT_SPEED),
                    doubleArrayOf(0.0, 100.0, 100.1, 200.0),
                    doubleArrayOf(30.0, 30.0, 42.00, 42.0)
                )
            ),
            cloned.getFullEnvelope()
        )
    }

    /**
     * Test that the envelope bounds are equal, then iterate by an arbitrary step length to test for
     * interpolateTotalTime equality.
     */
    private fun testEnvelopeTimeEquality(expected: Envelope, actual: EnvelopeTimeInterpolate) {
        assertTrue { arePositionsEqual(expected.beginPos, actual.beginPos) }
        assertTrue { arePositionsEqual(expected.endPos, actual.endPos) }
        var position = 126.0
        while (position < expected.endPos) {
            assertTrue(
                areTimesEqual(
                    expected.interpolateTotalTime(position),
                    actual.interpolateTotalTime(position),
                )
            )
            position += 1.0
        }
    }
}
