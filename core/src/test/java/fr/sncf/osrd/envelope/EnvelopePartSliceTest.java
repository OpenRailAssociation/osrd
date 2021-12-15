package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeTestUtils.assertEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.EnvelopeTestMeta;
import org.junit.jupiter.api.Test;

public class EnvelopePartSliceTest {
    @Test
    void sliceIndex() {
        var testMeta = new EnvelopeTestMeta();
        var ep1 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {1.5, 3, 5},
                new double[] {3, 4, 4}
        );
        var ep2 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {1.5, 3},
                new double[] {3, 4}
        );
        var slice = ep1.sliceIndex(0, 1);
        assertEquals(slice, ep2);
        assertEquals(slice.hashCode(), ep2.hashCode());
    }

    @Test
    void sliceIndexFull() {
        var testMeta = new EnvelopeTestMeta();
        var ep1 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {1.5, 3, 5},
                new double[] {3, 3, 4}
        );
        var slice = ep1.sliceIndex(0, 2);
        assertEquals(slice, ep1);
        assertEquals(slice.hashCode(), ep1.hashCode());
    }

    @Test
    void sliceIndexEmpty() {
        var testMeta = new EnvelopeTestMeta();
        var ep1 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {1.5, 3, 5},
                new double[] {3, 3, 4}
        );
        var slice = ep1.sliceIndex(0, 0);
        assertNull(slice);
    }

    @Test
    void sliceOffsetEmpty() {
        var testMeta = new EnvelopeTestMeta();
        var ep1 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {1.5, 3, 5},
                new double[] {3, 3, 4}
        );
        var slice = ep1.slice(Double.NEGATIVE_INFINITY, 1.5);
        assertNull(slice);
    }

    @Test
    void sliceOffsetFull() {
        var testMeta = new EnvelopeTestMeta();
        var ep1 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {1.5, 3, 5},
                new double[] {3, 3, 4}
        );
        var slice = ep1.slice(Double.NEGATIVE_INFINITY, 5.0);
        assertEquals(ep1, slice);
    }

    @Test
    void sliceOffsetInterpolate() {
        var testMeta = new EnvelopeTestMeta();
        var ep1 = EnvelopePart.generateTimes(
                testMeta,
                new double[] {0, 3},
                new double[] {3.46, 0}
        );
        var slice = ep1.slice(Double.NEGATIVE_INFINITY, 2);
        var expectedSlice = new EnvelopePart(
                testMeta,
                new double[] {0, 2},
                new double[] {3.46, 2},
                new double[] {0.73}
        );
        EnvelopeTestUtils.assertEquals(expectedSlice, slice);
    }
}
