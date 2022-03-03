package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePart;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

public class EnvelopeTest {
    @Test
    void testContinuity() {
        var partA = EnvelopePart.generateTimes(new double[] {0, 1}, new double[] {1, 1});
        var partB = EnvelopePart.generateTimes(new double[] {2, 3}, new double[] {1, 1});
        var partC = EnvelopePart.generateTimes(new double[] {1, 2}, new double[] {2, 2});
        var partD = EnvelopePart.generateTimes(new double[] {1, 2}, new double[] {1, 1});
        assertThrows(RuntimeException.class, () -> Envelope.make(partA, partB));
        assertTrue(Envelope.make(partA, partD).continuous);
        assertFalse(Envelope.make(partA, partC).continuous);
    }

    @Test
    void testIterator() {
        var a = EnvelopePart.generateTimes(new double[] { 0, 2 }, new double[] { 2, 2 });
        var envelope = Envelope.make(a);
        var res = new ArrayList<EnvelopePart>();
        envelope.iterator().forEachRemaining(res::add);
        assertEquals(1, res.size());
        assertEquals(a, res.get(0));
    }

    @Test
    void testMinMaxSpeed() {
        final var partA = EnvelopePart.generateTimes(new double[] { 0, 2 }, new double[] { 1, 2 });
        final var partB = EnvelopePart.generateTimes(new double[] { 2, 4 }, new double[] { 4, 3 });
        final var envelope = Envelope.make(partA, partB);

        assertEquals(1, partA.getMinSpeed());
        assertEquals(2, partA.getMaxSpeed());
        assertEquals(3, partB.getMinSpeed());
        assertEquals(4, partB.getMaxSpeed());

        assertEquals(1, envelope.getMinSpeed());
        assertEquals(4, envelope.getMaxSpeed());
    }

    @Test
    void testInterpolateSpeed() {
        var partA = EnvelopePart.generateTimes(new double[] { 0, 2 }, new double[] { 1, 2 });
        var partB = EnvelopePart.generateTimes(new double[] { 2, 3 }, new double[] { 2, 4 });
        var envelope = Envelope.make(partA, partB);

        assertEquals(1, envelope.interpolateSpeed(0));
        assertEquals(2, envelope.interpolateSpeed(2));
        assertEquals(4, envelope.interpolateSpeed(3));
    }

    @Test
    void testInterpolateTime() {
        var partA = EnvelopePart.generateTimes(new double[] { 0, 2 }, new double[] { 1, 1 });
        var partB = EnvelopePart.generateTimes(new double[] { 2, 4 }, new double[] { 1, 1 });
        var envelope = Envelope.make(partA, partB);

        assertEquals(1, partA.interpolateTotalTime(1));

        assertEquals(1, envelope.interpolateTotalTime(1));
        assertEquals(2, envelope.interpolateTotalTime(2));
        assertEquals(2, envelope.interpolateTotalTime(2));
        assertEquals(3, envelope.interpolateTotalTime(3));
        assertEquals(3.5, envelope.interpolateTotalTime(3.5));
        assertEquals(4, envelope.interpolateTotalTime(4));
    }
}
