package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeTestUtils.makeFlatPart;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import org.junit.jupiter.api.Test;

class MRSPEnvelopeBuilderTest {
    @Test
    void disjointGapFreeLimits() {
        /*
         *  +--------+        +-------+
         *           +--------+
         */
        var ep1 = makeFlatPart(TestAttr.A, 0, 1, 2);
        var ep2 = makeFlatPart(TestAttr.B, 1, 2, 1);
        var ep3 = makeFlatPart(TestAttr.C, 2, 3, 2);

        var envelope =
                new MRSPEnvelopeBuilder().addPart(ep1).addPart(ep2).addPart(ep3).build();

        var expectedEnvelope = Envelope.make(ep1, ep2, ep3);
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    void overlappingLimits() {
        /*
         *  +-----------------------------+
         *        +-----------+
         *              +-----------+
         *  0     1     2     3     4     5
         */
        var ep1 = makeFlatPart(TestAttr.A, 0, 5, 3);
        var ep2 = makeFlatPart(TestAttr.B, 1, 3, 2);
        var ep3 = makeFlatPart(TestAttr.C, 2, 4, 1);

        var envelope =
                new MRSPEnvelopeBuilder().addPart(ep1).addPart(ep2).addPart(ep3).build();

        /*
         *  +-----+                 +-----+
         *        +-----+
         *              +-----------+
         *  0     1     2     3     4     5
         */
        var expectedEnvelope = Envelope.make(
                makeFlatPart(TestAttr.A, 0, 1, 3),
                makeFlatPart(TestAttr.B, 1, 2, 2),
                makeFlatPart(TestAttr.C, 2, 4, 1),
                makeFlatPart(TestAttr.A, 4, 5, 3));
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    void overlappingSameSpeedLimits() {
        /*
         *  +-----+=====+-----+
         *  0     1     2     3
         */
        var ep1 = makeFlatPart(TestAttr.A, 0, 2, 2);
        var ep2 = makeFlatPart(TestAttr.B, 1, 3, 2);

        var envelope = new MRSPEnvelopeBuilder().addPart(ep1).addPart(ep2).build();

        /*
         *  +-----------+-----+
         *  0     1     2     3
         *
         *          OR
         *  +-----+-----------+
         *  0     1     2     3
         *
         * Both are valid, but we ensure the current implementation's behavior does not change.
         * It does not matter, if this breaks because the implementation changed, you can test for
         * the other case.
         */
        var expectedEnvelope = Envelope.make(makeFlatPart(TestAttr.A, 0, 2, 2), makeFlatPart(TestAttr.B, 2, 3, 2));
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }
}
