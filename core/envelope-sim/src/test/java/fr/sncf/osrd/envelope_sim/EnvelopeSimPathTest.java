package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.EnvelopeSimPathBuilder.buildNonElectrified;
import static fr.sncf.osrd.envelope_utils.RangeMapUtils.fullyCovers;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import fr.sncf.osrd.envelope_sim.electrification.Electrified;
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.HashMap;
import java.util.Map;

public class EnvelopeSimPathTest {
    @Test
    void testAverageGrade() {
        var path = buildNonElectrified(10, new double[]{0, 3, 6, 9, 10}, new double[]{0, 2, -2, 0});
        assertEquals(10, path.getLength());
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }

    @Test
    void findHighGradePosition() {
        var path = buildNonElectrified(10, new double[]{0, 3, 6, 9, 10}, new double[]{0, 2, -2, 0});
        assertEquals(0, path.getAverageGrade(0, 3));
        assertEquals(0, path.getAverageGrade(0, 10));
        assertEquals(0, path.getAverageGrade(9, 10));
        assertEquals(-1.5, path.getAverageGrade(6, 10));
        assertEquals(1, path.getAverageGrade(2, 4));
    }

    @Test
    void getCatenaryModeAndProfileOnlyModes() {
        var modes = TreeRangeMap.<Double, Electrification>create();
        modes.put(Range.closed(0.0, 10.0), new NonElectrified());
        modes.put(Range.closed(3.0, 7.0), new Electrified("1500"));
        modes.put(Range.closed(7.1, 10.0), new Electrified("25000"));
        var path = new EnvelopeSimPath(10, new double[] { 0, 10 }, new double[] { 0 }, ImmutableRangeMap.copyOf(modes),
                new HashMap<>());
        var modeAndProfileMap = path.getElectrificationMap(null, null, null, true);

        assertTrue(fullyCovers(modeAndProfileMap, 10));

        assertEquals(modeAndProfileMap.get(0.), new NonElectrified());
        assertEquals(modeAndProfileMap.get(4.), new Electrified("1500"));
        assertEquals(modeAndProfileMap.get(7.05), new NonElectrified());
        assertEquals(modeAndProfileMap.get(7.2), new Electrified("25000"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void getCatenaryModeAndProfile(boolean withEmptyPowerRestrictionMap) {
        var path = EnvelopeSimPathBuilder.withElectricalProfiles1500();

        RangeMap<Double, Electrification> modeAndProfileMap;
        if (withEmptyPowerRestrictionMap)
            modeAndProfileMap = path.getElectrificationMap("2", ImmutableRangeMap.of(), Map.of("Restrict1", "1"));
        else
            modeAndProfileMap = path.getElectrificationMap("2", null, Map.of("Restrict1", "1"));

        assertTrue(fullyCovers(modeAndProfileMap, path.length));

        assertEquals(9, modeAndProfileMap.asMapOfRanges().size());

        assertEquals(modeAndProfileMap.get(2.0), new Electrified("1500", null, null));
        assertEquals(modeAndProfileMap.get(3.5), new Electrified("1500", "A", null));
        assertEquals(modeAndProfileMap.get(5.5), new Electrified("1500", "C", null));
        assertEquals(modeAndProfileMap.get(6.5), new Electrified("1500", "B", null));
    }

    @Test
    void getCatenaryModeAndProfileWithPowerRestrictions() {
        var path = EnvelopeSimPathBuilder.withElectricalProfiles1500();

        var powerRestrictionMap = TreeRangeMap.<Double, String>create();
        powerRestrictionMap.put(Range.closed(2.5, 6.5), "Restrict2");

        var modeAndProfileMap = path.getElectrificationMap("1", powerRestrictionMap, Map.of("Restrict2", "2"));

        assertTrue(fullyCovers(modeAndProfileMap, path.length));

        assertEquals(10, modeAndProfileMap.asMapOfRanges().size());

        assertEquals(modeAndProfileMap.get(0.5), new NonElectrified());
        assertEquals(modeAndProfileMap.get(2.75), new Electrified("1500", null, "Restrict2"));
        assertEquals(modeAndProfileMap.get(3.25), new Electrified("1500", "A", "Restrict2"));
        assertEquals(modeAndProfileMap.get(4.5), new Electrified("1500", "B", "Restrict2"));
        assertEquals(modeAndProfileMap.get(5.5), new Electrified("1500", "C", "Restrict2"));
        assertEquals(modeAndProfileMap.get(6.25), new Electrified("1500", "B", "Restrict2"));
        assertEquals(modeAndProfileMap.get(6.75), new Electrified("1500", "A", null));
    }

    @Test
    void getCatenaryModeAndProfileWithPowerRestrictionsWithoutElectricalProfiles() {
        var path = EnvelopeSimPathBuilder.withElectricalProfiles1500();

        var powerRestrictionMap = TreeRangeMap.<Double, String>create();
        powerRestrictionMap.put(Range.closed(2.5, 6.5), "Restrict2");

        var modeAndProfileMap = path.getElectrificationMap("1", powerRestrictionMap, Map.of("Restrict2", "2"), true);

        assertEquals(6, modeAndProfileMap.asMapOfRanges().size());

        assertEquals(modeAndProfileMap.get(2.0), new Electrified("1500", null, null));
        assertEquals(modeAndProfileMap.get(4.5),
                new Electrified("1500", null, "Restrict2"));
        assertSame(modeAndProfileMap.get(4.5), modeAndProfileMap.get(5.5));
        assertSame(modeAndProfileMap.get(5.5), modeAndProfileMap.get(6.25));
        assertEquals(modeAndProfileMap.get(6.75), new Electrified("1500", null, null));
        assertEquals(modeAndProfileMap.get(9.0), new Electrified("25000", null, null));
    }
}
