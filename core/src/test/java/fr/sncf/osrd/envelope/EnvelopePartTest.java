package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.EnvelopeTestMeta;
import org.junit.jupiter.api.Test;

class EnvelopePartTest {
    @Test
    void interpolateSpeedTest() {
        var ep = EnvelopePart.generateTimes(
                null,
                new double[] {1.5, 5},
                new double[] {3, 4}
        );
        var interpolatedSpeed = ep.interpolateSpeed(2.75);
        // the delta here is pretty high, as we allow both approximate and exact methods
        assertEquals(3.36, interpolatedSpeed, 0.04);
    }

    @Test
    void findStep() {
        var ep = EnvelopePart.generateTimes(
                null,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );

        assertEquals(0, ep.findStepLeft(1.5));
        assertEquals(0, ep.findStepRight(1.5));

        assertEquals(0, ep.findStepLeft(3));
        assertEquals(1, ep.findStepRight(3));

        assertEquals(1, ep.findStepLeft(3.5));
        assertEquals(1, ep.findStepRight(3.5));

        assertEquals(1, ep.findStepLeft(5));
        assertEquals(1, ep.findStepRight(5));

        assertThrows(AssertionError.class, () -> ep.findStepLeft(1));
        assertThrows(AssertionError.class, () -> ep.findStepLeft(5.1));
        assertThrows(AssertionError.class, () -> ep.findStepRight(1));
        assertThrows(AssertionError.class, () -> ep.findStepRight(5.1));
    }

    @Test
    void testEquals() {
        var ep1 = EnvelopePart.generateTimes(
                null,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        var ep2 = EnvelopePart.generateTimes(
                null,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        var ep3 = EnvelopePart.generateTimes(
                new EnvelopeTestMeta(),
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        assertEquals(ep1, ep2);
        assertEquals(ep1.hashCode(), ep2.hashCode());
        assertNotEquals(ep1, ep3);
        assertNotEquals(ep1.hashCode(), ep3.hashCode());
    }
}