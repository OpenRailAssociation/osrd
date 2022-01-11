package fr.sncf.osrd.envelope;

import org.junit.jupiter.api.Test;

public class EnvelopeSpeedCapTest {
    @Test
    void testSimpleCap() {
        var inputEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 2, 4},
                        new double[] {0, 2, 0}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(inputEnvelope, null, 1);

        var expectedEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 0.5},
                        new double[] {0, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0.5, 3.5},
                        new double[] {1, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[] {3.5, 4},
                        new double[] {1, 0}
                )
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, cappedEnvelope);
    }

    @Test
    void testFlatCap() {
        var inputEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 1},
                        new double[] {2, 2}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(inputEnvelope, null, 1);

        var expectedEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 1},
                        new double[] {1, 1}
                )
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, cappedEnvelope);
    }

    @Test
    void testOpenEndCap() {
        var envelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 2},
                        new double[] {0, 2}
                ),
                // this part should be completely hidden away
                EnvelopePart.generateTimes(
                        null,
                        new double[] {2, 4},
                        new double[] {2, 2}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(envelope, null, 1);

        var expectedEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 0.5},
                        new double[] {0, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0.5, 4},
                        new double[] {1, 1}
                )
        );
        EnvelopeTestUtils.assertEquals(cappedEnvelope, expectedEnvelope);
    }

    @Test
    void testOpenBeginCap() {
        var envelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 2},
                        new double[] {2, 2}
                ),
                // this part should be completely hidden away
                EnvelopePart.generateTimes(
                        null,
                        new double[] {2, 4},
                        new double[] {2, 0}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(envelope, null, 1);
        var expectedEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 3.5},
                        new double[] {1, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[] {3.5, 4},
                        new double[] {1, 0}
                )
        );
        EnvelopeTestUtils.assertEquals(cappedEnvelope, expectedEnvelope);
    }

    @Test
    void testMultipleCaps() {
        var envelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 2, 4},
                        new double[] {2, 0, 2}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(envelope, null, 1);

        var expectedEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        null,
                        new double[] {0, 1.5},
                        new double[] {1, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[] {1.5, 2, 2.5},
                        new double[] {1, 0, 1}
                ),
                EnvelopePart.generateTimes(
                        null,
                        new double[] {2.5, 4},
                        new double[] {1, 1}
                )
        );
        EnvelopeTestUtils.assertEquals(cappedEnvelope, expectedEnvelope);
    }
}
