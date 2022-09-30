package fr.sncf.osrd.infra.tracks.undirected;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.ImmutableMap;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import org.junit.jupiter.api.Test;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class SpeedLimitsTests {
    @Test
    public void testInfiniteLimit() {
        var infiniteLimit = new SpeedLimits(
                Double.POSITIVE_INFINITY,
                new HashMap<>(Map.of("a", 42.)));
        var otherLimit = new SpeedLimits(
                10.,
                new HashMap<>(Map.of("a", 30.)));
        var selfMerge = infiniteLimit.merge(infiniteLimit);
        var otherMerge = otherLimit.merge(infiniteLimit);
        assertEquals(Double.POSITIVE_INFINITY, selfMerge.getSpeedLimit(List.of()));
        assertEquals(10., otherMerge.getSpeedLimit(List.of()));
        assertEquals(30., otherMerge.getSpeedLimit(List.of("a")));
        assertEquals(42., infiniteLimit.getSpeedLimit(List.of("a")));
        assertEquals(Double.POSITIVE_INFINITY, infiniteLimit.getSpeedLimit(List.of()));
    }

    @Test
    public void testNull() {
        var var = new SpeedLimits(42, ImmutableMap.of());
        assertEquals(var, var.merge(null));
    }

    @Test
    public void testMerge() {
        var a = new SpeedLimits(42, new HashMap<>(Map.of(
                "x", 10.,
                "y", 20.
        )));
        var b = new SpeedLimits(21, new HashMap<>(Map.of(
                "y", 15.,
                "z", 25.
        )));
        var merged = a.merge(b);
        assertEquals(21, merged.getSpeedLimit(Set.of("default")));
        assertEquals(10, merged.getSpeedLimit(Set.of("x")));
        assertEquals(15, merged.getSpeedLimit(Set.of("y")));
        assertEquals(25, merged.getSpeedLimit(Set.of("z")));
        assertEquals(10, merged.getSpeedLimit(Set.of("x", "z")));
    }
}
