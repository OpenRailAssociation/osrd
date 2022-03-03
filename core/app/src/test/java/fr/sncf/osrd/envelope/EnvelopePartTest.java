package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

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
}