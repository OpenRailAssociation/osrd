package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class EnvelopeBuilderTest {

    @Test
    void parabolaCeiling() {
        /*
         *       ,--------,
         * ----+-----------+----------
         *    /             \
         */
        var ep1 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[]{0, 1, 2, 4, 8, 11, 12},
                new double[]{0, 2, 3, 4, 4, 3, 0},
                false
        );
        var ep2 = new EnvelopePart(
                EnvelopeType.TRAIN_LIMIT,
                new double[]{0, 12},
                new double[]{3.5, 3.5},
                false
        );

        var builder = new EnvelopeBuilder();
        builder.addPart(ep1);
        builder.addPart(ep2);
        var envelope = builder.build();

        assertEquals(3, envelope.parts.size());
        assertEquals(EnvelopeType.ECO, envelope.parts.get(0).type);
        assertEquals(4, envelope.parts.get(0).size());
        assertEquals(3, envelope.parts.get(0).positions[3], 0.0001);
        assertEquals(3.5, envelope.parts.get(0).speeds[3], 0.0001);

        assertEquals(EnvelopeType.TRAIN_LIMIT, envelope.parts.get(1).type);
        assertEquals(2, envelope.parts.get(1).size());

        assertEquals(EnvelopeType.ECO, envelope.parts.get(2).type);
        assertEquals(3, envelope.parts.get(2).size());
        assertEquals(9.5, envelope.parts.get(2).positions[0], 0.0001);
        assertEquals(3.5, envelope.parts.get(2).speeds[0], 0.0001);
    }

    @Test
    void disjointEnvelopePartsSameOutput() {
        var ep1 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[]{0, 1},
                new double[]{3, 2},
                false
        );
        var ep2 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[]{4, 6},
                new double[]{0, 2},
                false
        );

        var builder = new EnvelopeBuilder();
        builder.addPart(ep1);
        builder.addPart(ep2);
        var envelope = builder.build();

        assertEquals(2, envelope.parts.size());
        assertEquals(ep1, envelope.parts.get(0));
        assertEquals(ep2, envelope.parts.get(1));
    }

    @Test
    void disjointContinuation() {
        /*
         *  simultaneous start and disjoint continuation
         *  ------------
         *  \
         *   \
         *    \
         */

        var ep1 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[]{0, 2},
                new double[]{3, 0},
                false
        );
        var ep2 = new EnvelopePart(
                EnvelopeType.TRAIN_LIMIT,
                new double[]{0, 8},
                new double[]{4, 4},
                false
        );

        var builder = new EnvelopeBuilder();
        builder.addPart(ep1);
        builder.addPart(ep2);
        var envelope = builder.build();

        assertEquals(2, envelope.parts.size());
        assertEquals(ep1, envelope.parts.get(0));

        var part2Expected = new EnvelopePart(
                EnvelopeType.TRAIN_LIMIT,
                new double[]{2, 8},
                new double[]{4, 4},
                false
        );
        assertEquals(part2Expected, envelope.parts.get(1));
    }

    @Test
    void crossCommonPoint() {
        /*
         *  simultaneous start and disjoint continuation
         *         /
         *  ------x-----
         *       /
         */

        var ep1 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[]{0, 1, 3},
                new double[]{0, 1, 2},
                false
        );
        var ep2 = new EnvelopePart(
                EnvelopeType.TRAIN_LIMIT,
                new double[]{0, 1, 3},
                new double[]{1, 1, 1},
                false
        );

        var builder = new EnvelopeBuilder();
        builder.addPart(ep1);
        builder.addPart(ep2);
        var envelope = builder.build();

        assertEquals(2, envelope.parts.size());
        assertEquals(EnvelopeType.ECO, envelope.parts.get(0).type);
        assertEquals(2, envelope.parts.get(0).size());

        assertEquals(EnvelopeType.TRAIN_LIMIT, envelope.parts.get(1).type);
        assertEquals(2, envelope.parts.get(1).size());
    }

    @Test
    void envelopeCrossing() {
        /*
         *         /
         *  ------/-----
         *       /
         */

        var ep1 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[]{1, 2.5},
                new double[]{0.5, 2},
                false
        );
        var ep2 = new EnvelopePart(
                EnvelopeType.TRAIN_LIMIT,
                new double[]{0, 5},
                new double[]{1, 1},
                false
        );

        var builder = new EnvelopeBuilder();
        builder.addPart(ep1);
        builder.addPart(ep2);
        var envelope = builder.build();

        assertEquals(3, envelope.parts.size());

        var exectedEp1 = new EnvelopePart(EnvelopeType.TRAIN_LIMIT, new double[]{0, 1}, new double[]{1, 1}, false);
        var exectedEp2 = new EnvelopePart(EnvelopeType.ECO, new double[]{1, 1.5}, new double[]{0.5, 1}, false);
        var exectedEp3 = new EnvelopePart(EnvelopeType.TRAIN_LIMIT, new double[]{1.5, 5}, new double[]{1, 1}, false);
        assertEquals(exectedEp1, envelope.parts.get(0));
        assertEquals(exectedEp2, envelope.parts.get(1));
        assertEquals(exectedEp3, envelope.parts.get(2));
    }
}