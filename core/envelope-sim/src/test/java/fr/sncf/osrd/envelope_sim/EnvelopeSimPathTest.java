package fr.sncf.osrd.envelope_sim;

import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.Map;

public class EnvelopeSimPathTest {
    @Test
    void testAverageGrade() {
        var path = new EnvelopeSimPath(10, new double[]{0, 3, 6, 9, 10}, new double[]{0, 2, -2, 0},
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
        var path = new EnvelopeSimPath(10, new double[]{0, 3, 6, 9, 10}, new double[]{0, 2, -2, 0},
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
        var path = new EnvelopeSimPath(10, new double[] { 0, 10 }, new double[] { 0 }, modes);
        var modeAndProfileMap = path.getElecCondMap(null, null, null, true);

        assertNull(modeAndProfileMap.get(0.));
        assertEquals(modeAndProfileMap.get(4.), new EnvelopeSimPath.ElectrificationConditions("1500", null, null));
        assertNull(modeAndProfileMap.get(7.05));
        assertEquals(modeAndProfileMap.get(7.2), new EnvelopeSimPath.ElectrificationConditions("25000", null, null));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void getCatenaryModeAndProfile(boolean withEmptyPowerRestrictionMap) {
        var path = EnvelopeSimPathBuilder.withElectricalProfiles1500();

        RangeMap<Double, EnvelopeSimPath.ElectrificationConditions> modeAndProfileMap;
        if (withEmptyPowerRestrictionMap)
            modeAndProfileMap = path.getElecCondMap("2", ImmutableRangeMap.of(), Map.of("Restrict1", "1"));
        else
            modeAndProfileMap = path.getElecCondMap("2", null, Map.of("Restrict1", "1"));

        assertEquals(7, modeAndProfileMap.asMapOfRanges().size());

        assertEquals(modeAndProfileMap.get(2.0), new EnvelopeSimPath.ElectrificationConditions("1500", null, null));
        assertEquals(modeAndProfileMap.get(3.5), new EnvelopeSimPath.ElectrificationConditions("1500", "A", null));
        assertEquals(modeAndProfileMap.get(5.5), new EnvelopeSimPath.ElectrificationConditions("1500", "C", null));
        assertEquals(modeAndProfileMap.get(6.5), new EnvelopeSimPath.ElectrificationConditions("1500", "B", null));
    }

    @Test
    void getCatenaryModeAndProfileWithPowerRestrictions() {
        var path = EnvelopeSimPathBuilder.withElectricalProfiles1500();

        RangeMap<Double, EnvelopeSimPath.ElectrificationConditions> modeAndProfileMap;
        var powerRestrictionMap = TreeRangeMap.<Double, String>create();
        powerRestrictionMap.put(Range.closed(2.5, 6.5), "Restrict2");

        modeAndProfileMap = path.getElecCondMap("1", powerRestrictionMap, Map.of("Restrict2", "2"));

        assertEquals(8, modeAndProfileMap.asMapOfRanges().size());

        assertNull(modeAndProfileMap.get(0.5));
        assertEquals(modeAndProfileMap.get(2.75),
                new EnvelopeSimPath.ElectrificationConditions("1500", null, "Restrict2"));
        assertEquals(modeAndProfileMap.get(3.25),
                new EnvelopeSimPath.ElectrificationConditions("1500", "A", "Restrict2"));
        assertEquals(modeAndProfileMap.get(4.5),
                new EnvelopeSimPath.ElectrificationConditions("1500", "B", "Restrict2"));
        assertEquals(modeAndProfileMap.get(5.5),
                new EnvelopeSimPath.ElectrificationConditions("1500", "C", "Restrict2"));
        assertEquals(modeAndProfileMap.get(6.25),
                new EnvelopeSimPath.ElectrificationConditions("1500", "B", "Restrict2"));
        assertEquals(modeAndProfileMap.get(6.75), new EnvelopeSimPath.ElectrificationConditions("1500", "A", null));
    }

    @Test
    void getCatenaryModeAndProfileWithPowerRestrictionsWithoutElectricalProfiles() {
        var path = EnvelopeSimPathBuilder.withElectricalProfiles1500();

        RangeMap<Double, EnvelopeSimPath.ElectrificationConditions> modeAndProfileMap;
        var powerRestrictionMap = TreeRangeMap.<Double, String>create();
        powerRestrictionMap.put(Range.closed(2.5, 6.5), "Restrict2");

        modeAndProfileMap = path.getElecCondMap("1", powerRestrictionMap, Map.of("Restrict2", "2"), true);

        assertEquals(4, modeAndProfileMap.asMapOfRanges().size());

        assertEquals(modeAndProfileMap.get(2.0), new EnvelopeSimPath.ElectrificationConditions("1500", null, null));
        assertEquals(modeAndProfileMap.get(4.5),
                new EnvelopeSimPath.ElectrificationConditions("1500", null, "Restrict2"));
        assertSame(modeAndProfileMap.get(4.5), modeAndProfileMap.get(5.5));
        assertSame(modeAndProfileMap.get(5.5), modeAndProfileMap.get(6.25));
        assertEquals(modeAndProfileMap.get(6.75), new EnvelopeSimPath.ElectrificationConditions("1500", null, null));
        assertEquals(modeAndProfileMap.get(9.0), new EnvelopeSimPath.ElectrificationConditions("25000", null, null));
    }
}
