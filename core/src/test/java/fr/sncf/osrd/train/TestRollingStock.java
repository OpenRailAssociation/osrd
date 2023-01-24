package fr.sncf.osrd.train;

import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;

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
            var tractiveEffortCurveMap =
                    rollingStock.mapTractiveEffortCurves(path, RollingStock.Comfort.STANDARD).curves();
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

    @Test
    void testMapTractiveEffortCurveWithProfiles() {
        TreeRangeMap<Double, String> catenaryModes = TreeRangeMap.create();
        catenaryModes.put(Range.closedOpen(0., 10.), "1500");
        catenaryModes.put(Range.closed(10., 20.), "25000");
        catenaryModes.put(Range.closed(30., 50.), "unhandled");

        TreeRangeMap<Double, String> electricalProfiles = TreeRangeMap.create();
        electricalProfiles.put(Range.closedOpen(10., 12.), "25000");
        electricalProfiles.put(Range.closedOpen(12., 14.), "22500");
        electricalProfiles.put(Range.closedOpen(14., 16.), "20000");
        electricalProfiles.put(Range.closedOpen(16., 18.), "22500");
        electricalProfiles.put(Range.closed(18., 20.), "25000");

        var rollingStock = TestTrains.REALISTIC_FAST_TRAIN;

        var path = new EnvelopePath(50, new double[]{0, 50}, new double[]{0}, catenaryModes);
        path.setElectricalProfiles(Map.of(rollingStock.powerClass, electricalProfiles));

        var comfort = RollingStock.Comfort.STANDARD;
        var res = rollingStock.mapTractiveEffortCurves(path, comfort).curves();

        testRangeCoverage(res, path.getLength());
        assertEquals(10,  res.asMapOfRanges().size(), "wrong number of ranges");

        assertEquals(res.get(5.), rollingStock.findTractiveEffortCurve("1500", null, comfort).curve());
        assertEquals(res.get(11.), rollingStock.findTractiveEffortCurve("25000", "25000", comfort).curve());
        assertEquals(res.get(13.), rollingStock.findTractiveEffortCurve("25000", "22500", comfort).curve());
        assertEquals(res.get(15.), rollingStock.findTractiveEffortCurve("25000", "20000", comfort).curve());
        assertEquals(res.get(17.), rollingStock.findTractiveEffortCurve("25000", "22500", comfort).curve());
        assertEquals(res.get(19.), rollingStock.findTractiveEffortCurve("25000", "25000", comfort).curve());
        assertEquals(res.get(25.), rollingStock.findTractiveEffortCurve("thermal", null, comfort).curve());
        assertEquals(res.get(40.), rollingStock.findTractiveEffortCurve("thermal", null, comfort).curve());
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
