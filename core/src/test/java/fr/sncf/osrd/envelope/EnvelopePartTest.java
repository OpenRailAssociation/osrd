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
    void getRangeIndex() {
        var ep = EnvelopePart.generateTimes(
                null,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        assertEquals(0, ep.findStep(1.5));
        assertEquals(0, ep.findStep(3));
        assertEquals(1, ep.findStep(3.5));
        assertEquals(1, ep.findStep(5));
        assertThrows(AssertionError.class, () -> ep.findStep(1));
        assertThrows(AssertionError.class, () -> ep.findStep(5.1));
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