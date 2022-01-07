package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.EnvelopeTestMeta;
import org.junit.jupiter.api.Test;

class MRSPEnvelopeBuilderTest {
    public static final EnvelopePartMeta meta1 = new EnvelopeTestMeta();
    public static final EnvelopePartMeta meta2 = new EnvelopeTestMeta();
    public static final EnvelopePartMeta meta3 = new EnvelopeTestMeta();


    public static EnvelopePart makeFlatPart(EnvelopePartMeta meta, double beginPos, double endPos, double speed) {
        return EnvelopePart.generateTimes(
                meta,
                new double[]{beginPos, endPos},
                new double[]{speed, speed}
        );
    }

    @Test
    void disjointGapFreeLimits() {
        /*
         *  +--------+        +-------+
         *           +--------+
         */
        var ep1 = makeFlatPart(meta1, 0, 1, 2);
        var ep2 = makeFlatPart(meta2, 1, 2, 1);
        var ep3 = makeFlatPart(meta3, 2, 3, 2);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .addPart(ep3)
                .build();

        var expectedEnvelope = Envelope.make(ep1, ep2, ep3);
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    void disjointGapLimits() {
        /*
         *  +--------+
         *                 +--------+
         */
        var ep1 = makeFlatPart(meta1, 0, 1, 3);
        var ep2 = makeFlatPart(meta2, 4, 6, 2);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .build();

        assertEquals(2, envelope.size());
        assertEquals(ep1, envelope.get(0));
        assertEquals(ep2, envelope.get(1));
    }


    @Test
    void overlappingLimits() {
        /*
         *  +-----------------------------+
         *        +-----------+
         *              +-----------+
         *  0     1     2     3     4     5
         */
        var ep1 = makeFlatPart(meta1, 0, 5, 3);
        var ep2 = makeFlatPart(meta2, 1, 3, 2);
        var ep3 = makeFlatPart(meta3, 2, 4, 1);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .addPart(ep3)
                .build();

        /*
         *  +-----+                 +-----+
         *        +-----+
         *              +-----------+
         *  0     1     2     3     4     5
         */
        var expectedEnvelope = Envelope.make(
                makeFlatPart(meta1, 0, 1, 3),
                makeFlatPart(meta2, 1, 2, 2),
                makeFlatPart(meta3, 2, 4, 1),
                makeFlatPart(meta1, 4, 5, 3)
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }

    @Test
    void overlappingSameSpeedLimits() {
        /*
         *  +-----+=====+-----+
         *  0     1     2     3
         */
        var ep1 = makeFlatPart(meta1, 0, 2, 2);
        var ep2 = makeFlatPart(meta2, 1, 3, 2);

        var envelope = new MRSPEnvelopeBuilder()
                .addPart(ep1)
                .addPart(ep2)
                .build();

        /*
         *  +-----------+-----+
         *  0     1     2     3
         *
         *          OR
         *  +-----+-----------+
         *  0     1     2     3
         *
         * Both are valid, but we ensure the current implementation's behavior does not change.
         * It does not matter, it this breaks because the implementation changed, you can test for
         * the other case.
         */
        var expectedEnvelope = Envelope.make(
                makeFlatPart(meta1, 0, 2, 2),
                makeFlatPart(meta2, 2, 3, 2)
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, envelope, 0.001);
    }
}