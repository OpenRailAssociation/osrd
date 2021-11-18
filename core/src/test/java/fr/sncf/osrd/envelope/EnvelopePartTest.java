package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class EnvelopePartTest {
    @Test
    void interpolateSpeedTest() {
        var ep = new EnvelopePart(
                EnvelopeType.ECO,
                new double[] {1.5, 5},
                new double[] {3, 4},
                false
        );
        var interpolatedSpeed = ep.interpolateSpeed(2.75);
        assertEquals(3.36, interpolatedSpeed, 0.01);
    }

    @Test
    void getPosIndex() {
        var ep = new EnvelopePart(
                EnvelopeType.ECO,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4},
                false
        );
        assertEquals(0, ep.getPosIndex(1.5));
        assertEquals(0, ep.getPosIndex(3));
        assertEquals(1, ep.getPosIndex(3.5));
        assertEquals(1, ep.getPosIndex(5));
        assertThrows(AssertionError.class, () -> ep.getPosIndex(1));
        assertThrows(AssertionError.class, () -> ep.getPosIndex(5.1));
    }

    @Test
    void testEquals() {
        var ep1 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4},
                false
        );
        var ep2 = new EnvelopePart(
                EnvelopeType.ECO,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4},
                false
        );
        var ep3 = new EnvelopePart(
                EnvelopeType.TRACK_LIMIT,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4},
                false
        );
        assertEquals(ep1, ep2);
        assertEquals(ep1.hashCode(), ep2.hashCode());
        assertNotEquals(ep1, ep3);
        assertNotEquals(ep1.hashCode(), ep3.hashCode());
    }
}