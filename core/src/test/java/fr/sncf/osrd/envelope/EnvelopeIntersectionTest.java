package fr.sncf.osrd.envelope;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

public class EnvelopeIntersectionTest {
    /** Test intersecting a deceleration with an acceleration */
    @Test
    public void testAccDecIntersection() {
        var intersection = EnvelopePhysics.intersectSteps(
                1, 0, 10, 6,
                0, 3.46, 3, 0
        );
        assertEquals(2, intersection.position, 0.01);
        assertEquals(2, intersection.speed, 0.01);
    }

    @Test
    public void testDecDecIntersection() {
        var intersection = EnvelopePhysics.intersectSteps(
                0, 3.16, 3.33, 0,
                0, 3.46, 3, 0
        );
        assertEquals(2, intersection.position, 0.01);
        assertEquals(2, intersection.speed, 0.01);
    }

    @Test
    public void testAccAccIntersection() {
        var intersection = EnvelopePhysics.intersectSteps(
                0.67, 0, 4, 3.16,
                1, 0, 4, 3.46
        );
        assertEquals(2, intersection.position, 0.01);
        assertEquals(2, intersection.speed, 0.01);
    }

    @Test
    public void testConstDecIntersection() {
        var intersection = EnvelopePhysics.intersectSteps(
                0, 2, 4, 2,
                0, 3.46, 3, 0
        );
        assertEquals(2, intersection.position, 0.01);
        assertEquals(2, intersection.speed, 0.01);
    }

    @Test
    public void testDecConstIntersection() {
        var intersection = EnvelopePhysics.intersectSteps(
                0, 3.16, 3.33, 0,
                0, 2, 4, 2
        );
        assertEquals(2, intersection.position, 0.01);
        assertEquals(2, intersection.speed, 0.01);
    }
}
