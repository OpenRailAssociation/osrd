package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import org.junit.jupiter.api.Test;
import java.util.List;

public class EnvelopeSpeedCapTest {
    @Test
    void testSimpleCap() {
        var inputEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.COASTING),
                        new double[] {0, 2, 4},
                        new double[] {0, 2, 0}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(inputEnvelope, List.of(), 1);

        var expectedEnvelope = Envelope.make(
                EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.COASTING),
                        new double[] {0, 0.5},
                        new double[] {0, 1}
                ),
                EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.CONSTANT_SPEED),
                        new double[] {0.5, 3.5},
                        new double[] {1, 1}
                ),
                EnvelopePart.generateTimes(
                        List.of(EnvelopeProfile.COASTING),
                        new double[] {3.5, 4},
                        new double[] {1, 0}
                )
        );
        assertEquals(inputEnvelope.interpolateSpeed(0.5), expectedEnvelope.interpolateSpeed(0.5));
        EnvelopeTestUtils.assertEquals(expectedEnvelope, cappedEnvelope);

        // add a cap at 1.5, then a cap at 1, and ensure both are the same
        var doubleCappedEnvelope = EnvelopeSpeedCap.from(inputEnvelope, List.of(), 1.5);
        doubleCappedEnvelope = EnvelopeSpeedCap.from(doubleCappedEnvelope, List.of(), 1);
        EnvelopeTestUtils.assertEquals(doubleCappedEnvelope, cappedEnvelope);
    }

    @Test
    void testFlatCap() {
        var inputEnvelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 1},
                        new double[] {2, 2}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(inputEnvelope, List.of(), 1);

        var expectedEnvelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 1},
                        new double[] {1, 1}
                )
        );
        EnvelopeTestUtils.assertEquals(expectedEnvelope, cappedEnvelope);
    }

    @Test
    void testOpenEndCap() {
        var envelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 2},
                        new double[] {0, 2}
                ),
                // this part should be completely hidden away
                EnvelopeTestUtils.generateTimes(
                        new double[] {2, 4},
                        new double[] {2, 2}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(envelope, List.of(), 1);

        var expectedEnvelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 0.5},
                        new double[] {0, 1}
                ),
                EnvelopeTestUtils.generateTimes(
                        new double[] {0.5, 4},
                        new double[] {1, 1}
                )
        );
        EnvelopeTestUtils.assertEquals(cappedEnvelope, expectedEnvelope);
    }

    @Test
    void testOpenBeginCap() {
        var envelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 2},
                        new double[] {2, 2}
                ),
                // this part should be completely hidden away
                EnvelopeTestUtils.generateTimes(
                        new double[] {2, 4},
                        new double[] {2, 0}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(envelope, List.of(), 1);
        var expectedEnvelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 3.5},
                        new double[] {1, 1}
                ),
                EnvelopeTestUtils.generateTimes(
                        new double[] {3.5, 4},
                        new double[] {1, 0}
                )
        );
        EnvelopeTestUtils.assertEquals(cappedEnvelope, expectedEnvelope);
    }

    @Test
    void testMultipleCaps() {
        var envelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 2, 4},
                        new double[] {2, 0, 2}
                )
        );
        var cappedEnvelope = EnvelopeSpeedCap.from(envelope, List.of(), 1);

        var expectedEnvelope = Envelope.make(
                EnvelopeTestUtils.generateTimes(
                        new double[] {0, 1.5},
                        new double[] {1, 1}
                ),
                EnvelopeTestUtils.generateTimes(
                        new double[] {1.5, 2, 2.5},
                        new double[] {1, 0, 1}
                ),
                EnvelopeTestUtils.generateTimes(
                        new double[] {2.5, 4},
                        new double[] {1, 1}
                )
        );
        EnvelopeTestUtils.assertEquals(cappedEnvelope, expectedEnvelope);
    }
}
