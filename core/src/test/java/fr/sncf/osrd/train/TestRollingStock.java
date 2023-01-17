package fr.sncf.osrd.train;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import org.junit.jupiter.api.Test;
import java.util.List;


public class TestRollingStock {
    @Test
    void testMapTractiveEffortCurve() {
        var builder = new ImmutableRangeMap.Builder<Double, String>();
        builder.put(Range.closedOpen(0., 10.), "1500");
        builder.put(Range.closed(10., 20.), "25000");

        builder.put(Range.closed(30., 50.), "unhandled");

        var path1 = new EnvelopePath(40, new double[]{0, 40}, new double[]{0}, builder.build());
        var path2 = new EnvelopePath(60, new double[]{0, 60}, new double[]{0}, builder.build());
        var path3 = new EnvelopePath(50, new double[]{0, 50}, new double[]{0}, ImmutableRangeMap.of());

        var rollingStock = TestTrains.REALISTIC_FAST_TRAIN;

        RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> res = null;
        for (var path : List.of(path1, path2, path3)) {
            var tractiveEffortCurveMap = rollingStock.mapTractiveEffortCurves(path, RollingStock.Comfort.STANDARD);
            if (res == null)
                res = tractiveEffortCurveMap;
            testRangeCoverage(tractiveEffortCurveMap, path.getLength());
            var size = tractiveEffortCurveMap.asMapOfRanges().size();
            var expectedSize = path != path3 ? 6 : 1;
            assertEquals(expectedSize, size, "wrong number of ranges");
        }

        assertEquals(res.get(5.), rollingStock.modes.get("1500").defaultCurve());
        assertEquals(res.get(15.), rollingStock.modes.get("25000").defaultCurve());
        assertEquals(res.get(25.), rollingStock.modes.get("thermal").defaultCurve());
        assertEquals(res.get(40.), rollingStock.modes.get("thermal").defaultCurve());
    }

    static void testRangeCoverage(RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> map, double length) {
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
