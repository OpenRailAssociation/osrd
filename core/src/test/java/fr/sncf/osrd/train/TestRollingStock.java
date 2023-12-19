package fr.sncf.osrd.train;

import static org.junit.jupiter.api.Assertions.*;
import static fr.sncf.osrd.train.RollingStock.InfraConditions;

import com.google.common.collect.*;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPathBuilder;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

public class TestRollingStock {

    static double maxSpeed(PhysicsRollingStock.TractiveEffortPoint[] curve) {
        return curve[curve.length - 1].speed();
    }

    static Stream<Arguments> mapTractiveEffortCurveArgs() {
        var powerRestrictionMap = ImmutableRangeMap.<Double, String>builder()
                .put(Range.closedOpen(0., 10.), "Restrict1")
                .put(Range.closed(10., 20.), "Restrict2")
                .build();
        var emptyPowerRestrictionMap = ImmutableRangeMap.<Double, String>builder().build();
        return Lists.cartesianProduct(
                List.of(
                        EnvelopeSimPathBuilder.withElectricalProfiles25000(40),
                        EnvelopeSimPathBuilder.withElectricalProfiles25000(60),
                        EnvelopeSimPathBuilder.withModes(50)
                ),
                List.of(RollingStock.Comfort.STANDARD, RollingStock.Comfort.AC, RollingStock.Comfort.HEATING),
                Arrays.asList(powerRestrictionMap, emptyPowerRestrictionMap)
        ).stream().map(args -> Arguments.of(args.get(0), args.get(1), args.get(2)));
    }


    @ParameterizedTest
    @MethodSource("mapTractiveEffortCurveArgs")
    void testMapTractiveEffortCurveCoherent(EnvelopeSimPath path, RollingStock.Comfort comfort,
            RangeMap<Double, String> powerRestrictionMap) {
        var rollingStock = TestTrains.REALISTIC_FAST_TRAIN;

        var elecCondMap = path.getElectrificationMap(rollingStock.basePowerClass, powerRestrictionMap,
                rollingStock.powerRestrictions);
        var tractiveEffortCurveMap = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort);
        testRangeCoverage(tractiveEffortCurveMap.conditions(), path.getLength());
        testRangeCoverage(tractiveEffortCurveMap.curves(), path.getLength());
        var nCurves = tractiveEffortCurveMap.curves().subRangeMap(Range.closed(0., path.getLength())).asMapOfRanges()
                .size();
        var nConditionsSeen = elecCondMap.subRangeMap(Range.closed(0., path.getLength())).asMapOfRanges().size();
        var nConditionsUsed = tractiveEffortCurveMap.conditions().subRangeMap(Range.closed(0., path.getLength()))
                .asMapOfRanges().size();
        assertEquals(nCurves, nConditionsUsed, "wrong number of curves");
        assertTrue(nConditionsSeen <= nConditionsUsed, "wrong number of conditions");
    }

    @Test
    void testMapTractiveEffortCurveWithProfiles() {
        var powerRestrictionMap = ImmutableRangeMap.<Double, String>builder()
                .put(Range.closedOpen(5., 11.), "Restrict2")
                .put(Range.closedOpen(15., 18.), "Restrict1")
                .put(Range.closed(18., 20.), "UnknownRestrict")
                .build();
        var path = EnvelopeSimPathBuilder.withElectricalProfiles25000(50);

        var rollingStock = TestTrains.REALISTIC_FAST_TRAIN;

        var comfort = RollingStock.Comfort.STANDARD;
        var elecCondMap = path.getElectrificationMap(rollingStock.basePowerClass, powerRestrictionMap,
                rollingStock.powerRestrictions);
        var res = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort);

        testRangeCoverage(res.curves(), path.getLength());
        assertEquals(14, res.curves().subRangeMap(Range.closed(0., path.getLength())).asMapOfRanges().size(),
                "wrong number of ranges");

        // Check that the ranges are correct
        assertArrayEquals(new Double[] { 0., 1., 5., 8.0, 8.1, 10., 11., 12., 14., 15., 17., 18., 20., 30. },
                res.curves().subRangeMap(Range.closed(0., path.getLength())).asMapOfRanges().keySet().stream()
                        .map(Range::lowerEndpoint).toArray());

        // Check that the conditions are correct
        assertArrayEquals(new InfraConditions[] {
                new InfraConditions("thermal", null, null), // 0
                new InfraConditions("1500V", null, null),    // 1
                new InfraConditions("1500V", null, null),    // 5 "Restrict1" invalid for 1500V
                new InfraConditions("thermal", null, null), // 8
                new InfraConditions("25000V", null, "Restrict2"),  // 8.1
                new InfraConditions("25000V", "25000V", "Restrict2"), // 10
                new InfraConditions("25000V", "25000V", null), // 11
                new InfraConditions("25000V", "22500V", null), // 12
                new InfraConditions("25000V", "20000V", null), // 14
                new InfraConditions("25000V", "22500V", "Restrict1"), // 15
                new InfraConditions("25000V", "25000V", "Restrict1"), // 17
                new InfraConditions("25000V", "25000V", null), // 18 "UnknownRestrict" invalid for 25000V
                new InfraConditions("thermal", null, null), // 20 No mode given
                new InfraConditions("thermal", null, null)  // 30 Invalid mode
        },
                res.conditions().subRangeMap(Range.closed(0., path.getLength())).asMapOfRanges().values().stream()
                    .toArray());

        // Check that the curves are correct
        assertArrayEquals(new double[] {
                TestTrains.MAX_SPEED * 0.92, // 0
                TestTrains.MAX_SPEED * 0.82, // 1
                TestTrains.MAX_SPEED * 0.82, // 5
                TestTrains.MAX_SPEED * 0.92, // 8
                TestTrains.MAX_SPEED * 0.79, // 8.1
                TestTrains.MAX_SPEED * 0.79, // 10
                TestTrains.MAX_SPEED, // 11
                TestTrains.MAX_SPEED * 0.9, // 12
                TestTrains.MAX_SPEED * 0.8, // 14
                TestTrains.MAX_SPEED * 0.9 * 0.89, // 15
                TestTrains.MAX_SPEED * 0.89, // 17
                TestTrains.MAX_SPEED, // 18
                TestTrains.MAX_SPEED * 0.92, // 20
                TestTrains.MAX_SPEED * 0.92 // 30
        },
                res.curves().subRangeMap(Range.closed(0., path.getLength())).asMapOfRanges().values().stream()
                    .map(TestRollingStock::maxSpeed).mapToDouble(Double::doubleValue).toArray(), 0.001);
    }

    static <T> void testRangeCoverage(RangeMap<Double, T> map, double length) {
        var subMap = map.subRangeMap(Range.closed(0., length));

        var span = subMap.span();
        assertTrue((span.upperEndpoint() - span.lowerEndpoint()) == length, "map does not cover the whole path");

        var entries = subMap.asMapOfRanges().entrySet().iterator();
        var prev = entries.next();
        while (entries.hasNext()) {
            var next = entries.next();
            assertTrue(prev.getKey().upperEndpoint().equals(next.getKey().lowerEndpoint()),
                    "ranges are not contiguous");
            prev = next;
        }
    }
}
