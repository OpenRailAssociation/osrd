package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import org.junit.jupiter.api.Test;
import java.util.List;

class EnvelopePartTest {
    @Test
    void toStringTest() {
        var part = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[] {1.5, 5},
                new double[] {3, 4}
        );
        assertEquals("EnvelopePart { TestAttr=A }", part.toString());
    }

    @Test
    void getAttrTest() {
        var part = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[] {1.5, 5},
                new double[] {3, 4}
        );
        assertEquals(TestAttr.A, part.getAttr(TestAttr.class));
    }

    @Test
    void interpolateSpeedTest() {
        var ep = EnvelopePart.generateTimes(
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
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );

        assertEquals(0, ep.findLeft(1.5));
        assertEquals(0, ep.findRight(1.5));

        assertEquals(0, ep.findLeft(3));
        assertEquals(1, ep.findRight(3));

        assertEquals(1, ep.findLeft(3.5));
        assertEquals(1, ep.findRight(3.5));

        assertEquals(1, ep.findLeft(5));
        assertEquals(1, ep.findRight(5));

        assertEquals(-1,  ep.findLeft(1));
        assertEquals(-4,  ep.findLeft(5.1));
        assertEquals(-1,  ep.findRight(1));
        assertEquals(-4, ep.findRight(5.1));
    }

    @Test
    void testEquals() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        var ep2 = EnvelopePart.generateTimes(
                List.of(TestAttr.A),
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        var ep3 = EnvelopePart.generateTimes(
                List.of(TestAttr.B),
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        assertEquals(ep1, ep2);
        assertEquals(ep1.hashCode(), ep2.hashCode());
        assertNotEquals(ep1, ep3);
        assertNotEquals(ep1.hashCode(), ep3.hashCode());
    }

    @Test
    void testAreIntersecting() {
        // 4 ooooooooooooooooX <------ ep4
        //                 X
        // 3     --------X-------- <-- ep1
        //             X
        // 2         X  <------------- ep2
        //         X
        // 1 ****X**************** <-- ep3
        //     X
        // 0 X
        //   0   1   2   3   4   5
        final var ep1 = EnvelopePart.generateTimes(
                new double[] {1, 5},
                new double[] {3, 3}
        );
        final var ep2 = EnvelopePart.generateTimes(
                new double[] {0, 4},
                new double[] {0, 4}
        );
        final var ep3 = EnvelopePart.generateTimes(
                new double[] {0, 5},
                new double[] {1, 1}
        );
        final var ep4 = EnvelopePart.generateTimes(
                new double[] {0, 4},
                new double[] {4, 4}
        );
        assertTrue(EnvelopePhysics.areIntersecting(ep1, ep2));
        assertTrue(EnvelopePhysics.areIntersecting(ep2, ep3));
        assertFalse(EnvelopePhysics.areIntersecting(ep1, ep3));
        assertTrue(EnvelopePhysics.areIntersecting(ep2, ep4));
    }
}