package fr.sncf.osrd.envelope_sim;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.TreeRangeMap;
import org.junit.jupiter.api.Test;

public class EnvelopePathTest {
    @Test
    void testAverageGrade() {
        var path = new EnvelopePath(10, new double[] { 0, 3, 6, 9, 10 }, new double[] { 0, 2, -2, 0 },
                ImmutableRangeMap.of());
        assertEquals(10, path.getLength());
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }

    @Test
    void findHighGradePosition() {
        var path = new EnvelopePath(10, new double[] { 0, 3, 6, 9, 10 }, new double[] { 0, 2, -2, 0 },
                ImmutableRangeMap.of());
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }

    @Test
    void getCatenaryProfile() {
        var path = new EnvelopePath(10, new double[] { 0, 10 }, new double[] { 0 },
                ImmutableRangeMap.of(Range.closed(3., 7.), "1500"));
        var profileMap = path.getCatenaryProfileMap();
        assertNull(profileMap.get(1.));
        assertNull(profileMap.get(8.));
        assertEquals("1500", profileMap.get(4.));
    }
}
