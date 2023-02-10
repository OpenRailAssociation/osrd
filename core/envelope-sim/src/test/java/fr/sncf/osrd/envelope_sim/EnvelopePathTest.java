package fr.sncf.osrd.envelope_sim;

import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import org.junit.jupiter.api.Test;
import java.util.Map;

public class EnvelopePathTest {
    @Test
    void testAverageGrade() {
        var path = new EnvelopePath(10, new double[]{0, 3, 6, 9, 10}, new double[]{0, 2, -2, 0},
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
        var path = new EnvelopePath(10, new double[]{0, 3, 6, 9, 10}, new double[]{0, 2, -2, 0},
                ImmutableRangeMap.of());
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }

    @Test
    void getCatenaryModeAndProfileOnlyModes() {
        TreeRangeMap<Double, String> modes = TreeRangeMap.create();
        modes.put(Range.closed(3.0, 7.0), "1500");
        modes.put(Range.closed(7.1, 10.0), "25000");
        var path = new EnvelopePath(10, new double[] { 0, 10 }, new double[] { 0 }, modes);
        var modeAndProfileMap = path.getModeAndProfileMap(null);

        var modeAndProfile = modeAndProfileMap.get(0.);
        assertNull(modeAndProfile);

        modeAndProfile = modeAndProfileMap.get(4.);
        assertNotNull(modeAndProfile);
        assertEquals("1500", modeAndProfile.mode());
        assertNull(modeAndProfile.profile());

        modeAndProfile = modeAndProfileMap.get(7.05);
        assertNull(modeAndProfile);

        modeAndProfile = modeAndProfileMap.get(7.2);
        assertNotNull(modeAndProfile);
        assertEquals("25000", modeAndProfile.mode());
        assertNull(modeAndProfile.profile());
    }

    @Test
    void getCatenaryModeAndProfile() {
        TreeRangeMap<Double, String> modes = TreeRangeMap.create();
        modes.put(Range.closed(3.0, 7.0), "1500");
        modes.put(Range.closed(7.1, 10.0), "25000");

        RangeMap<Double, String> profiles1 = TreeRangeMap.create();
        profiles1.put(Range.closed(3.0, 7.0), "A");
        profiles1.put(Range.closed(7.1, 10.5), "25000");

        RangeMap<Double, String> profiles2 = TreeRangeMap.create();
        profiles2.put(Range.closedOpen(3.0, 4.0), "A");
        profiles2.put(Range.closedOpen(4.0, 6.0), "B");
        profiles2.put(Range.closed(6.0, 7.0), "A");
        profiles2.put(Range.closed(7.1, 10.5), "25000");

        var path = new EnvelopePath(10, new double[] { 0, 10 }, new double[] { 0 }, modes);
        path.setElectricalProfiles(Map.of("1", profiles1, "2", profiles2));

        var modeAndProfileMap = path.getModeAndProfileMap("2");

        assertEquals(6, modeAndProfileMap.asMapOfRanges().size());

        var modeAndProfile = modeAndProfileMap.get(3.5);
        assertNotNull(modeAndProfile);
        assertEquals("1500", modeAndProfile.mode());
        assertEquals("A", modeAndProfile.profile());

        modeAndProfile = modeAndProfileMap.get(5.);
        assertNotNull(modeAndProfile);
        assertEquals("1500", modeAndProfile.mode());
        assertEquals("B", modeAndProfile.profile());

        modeAndProfile = modeAndProfileMap.get(6.5);
        assertNotNull(modeAndProfile);
        assertEquals("1500", modeAndProfile.mode());
        assertEquals("A", modeAndProfile.profile());
    }
}
