package fr.sncf.osrd.infra.tracks.undirected;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.ImmutableMap;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;

public class SpeedLimitsTests {
    @Test
    public void testInfiniteLimit() {
        var infiniteLimit = new SpeedLimits(
                Double.POSITIVE_INFINITY,
                ImmutableMap.of("a", 42.));
        var otherLimit = new SpeedLimits(
                10.,
                ImmutableMap.of("a", 30.));
        var selfMerge = SpeedLimits.merge(infiniteLimit, infiniteLimit);
        var otherMerge = SpeedLimits.merge(otherLimit, infiniteLimit);
        assertEquals(Double.POSITIVE_INFINITY, selfMerge.getSpeedLimit(null));
        assertEquals(10., otherMerge.getSpeedLimit(null));
        assertEquals(30., otherMerge.getSpeedLimit("a"));
        assertEquals(42., infiniteLimit.getSpeedLimit("a"));
        assertEquals(Double.POSITIVE_INFINITY, infiniteLimit.getSpeedLimit(null));
    }

    @Test
    public void testNull() {
        var var = new SpeedLimits(42, ImmutableMap.of());
        assertEquals(var, SpeedLimits.merge(var, null));
        assertEquals(var, SpeedLimits.merge(null, var));
    }

    @Test
    public void testMerge() {
        var categoriesA = ImmutableMap.<String, Double>builder();
        categoriesA.put("x", 10.);
        categoriesA.put("y", 20.);
        var categoriesB = ImmutableMap.<String, Double>builder();
        categoriesB.put("y", 15.);
        categoriesB.put("z", 25.);
        var a = new SpeedLimits(42, categoriesA.build());
        var b = new SpeedLimits(21, categoriesB.build());
        var merged = SpeedLimits.merge(a, b);
        assertEquals(21, merged.getSpeedLimit("default"));
        assertEquals(10, merged.getSpeedLimit("x"));
        assertEquals(15, merged.getSpeedLimit("y"));
        assertEquals(25, merged.getSpeedLimit("z"));
    }
}
