package fr.sncf.osrd.envelope_sim;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class EnvelopePathTest {
    @Test
    void testAverageGrade() {
        var path = new EnvelopePath(10, new double[] { 0, 3, 6, 9, 10 }, new double[] { 0, 2, -2, 0 });
        assertEquals(10, path.getLength());
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }

    @Test
    void testGetIndexBeforePos() {
        var path = new EnvelopePath(10, new double[] { 0, 3, 6, 9, 10 }, new double[] { 0, 2, -2, 0 });
        assertEquals(0, path.getIndexBeforePos(0));
        assertEquals(0, path.getIndexBeforePos(2));
        assertEquals(1, path.getIndexBeforePos(4));
        assertEquals(2, path.getIndexBeforePos(8));
        assertEquals(3, path.getIndexBeforePos(9));
        assertEquals(4, path.getIndexBeforePos(10));
    }

    @Test
    void testLowestGrade() {
        var path = new EnvelopePath(10, new double[] { 0, 3, 6, 9, 10 }, new double[] { 0, 2, -2, 0 });
        assertEquals(10, path.getLength());
        assertEquals(0, path.getLowestGrade(0, 3));
        assertEquals(-2, path.getLowestGrade(0, 10));
        assertEquals(0, path.getLowestGrade(9, 10));
        assertEquals(-2, path.getLowestGrade(6, 10));
        assertEquals(0, path.getLowestGrade(2, 4));
    }

    @Test
    void findHighGradePosition() {
        var path = new EnvelopePath(10, new double[] { 0, 3, 6, 9, 10 }, new double[] { 0, 2, -2, 0 });
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }
}
