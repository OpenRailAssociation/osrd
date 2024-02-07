package fr.sncf.osrd.envelope;

import static fr.sncf.osrd.envelope.EnvelopeTestUtils.assertEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import fr.sncf.osrd.envelope.EnvelopeTestUtils.TestAttr;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import java.util.List;
import org.junit.jupiter.api.Test;

public class EnvelopePartSliceTest {
    @Test
    void sliceIndex() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1.5, 3, 5}, new double[] {3, 4, 4});
        var ep2 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1.5, 3}, new double[] {3, 4});
        var slice = ep1.sliceIndex(0, 1);
        assertEquals(slice, ep2);
        assertEquals(slice.hashCode(), ep2.hashCode());
    }

    @Test
    void sliceIndexFull() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1.5, 3, 5}, new double[] {3, 3, 4});
        var slice = ep1.sliceIndex(0, 2);
        assertEquals(slice, ep1);
        assertEquals(slice.hashCode(), ep1.hashCode());
    }

    @Test
    void sliceIndexEmpty() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1.5, 3, 5}, new double[] {3, 3, 4});
        var slice = ep1.sliceIndex(0, 0);
        assertNull(slice);
    }

    @Test
    void sliceOffsetEmpty() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1.5, 3, 5}, new double[] {3, 3, 4});
        var slice = ep1.slice(Double.NEGATIVE_INFINITY, 1.5);
        assertNull(slice);
    }

    @Test
    void sliceOffsetFull() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1.5, 3, 5}, new double[] {3, 3, 4});
        var slice = ep1.slice(Double.NEGATIVE_INFINITY, 5.0);
        assertEquals(ep1, slice);
    }

    @Test
    void sliceOffsetInterpolate() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.BRAKING), new double[] {0, 3}, new double[] {3.46, 0});
        var slice = ep1.slice(Double.NEGATIVE_INFINITY, 2);
        var expectedSlice = new EnvelopePart(
                List.of(TestAttr.A, EnvelopeProfile.BRAKING),
                new double[] {0, 2},
                new double[] {3.46, 2},
                new double[] {0.73});
        EnvelopeTestUtils.assertEquals(expectedSlice, slice);
    }

    @Test
    void sliceWithImposedSpeeds() {
        var ep1 = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {1, 3, 5}, new double[] {3, 3, 4});
        var slice = ep1.sliceWithSpeeds(2, 3, 4, 3.5);
        var expectedSlice = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {2, 3, 4}, new double[] {3, 3, 3.5});
        assertEquals(expectedSlice, slice);
    }

    /** Reproduces a bug where the sliced part would have negative time deltas */
    @Test
    void sliceWithEpsilonAcceleration() {
        var ep = EnvelopePart.generateTimes(
                List.of(TestAttr.A, EnvelopeProfile.ACCELERATING), new double[] {0, 100}, new double[] {10, 10 + 1e-8});
        ep.slice(50, 100); // The relevant assertions are made in `EnvelopePart.runSanityChecks`
    }
}
