package fr.sncf.osrd.infra.tracks.undirected;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.google.common.collect.ImmutableMap;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class SpeedLimitsTests {
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
        assertEquals(21, merged.getSpeedLimit(Set.of("default")));
        assertEquals(10, merged.getSpeedLimit(Set.of("x")));
        assertEquals(15, merged.getSpeedLimit(Set.of("y")));
        assertEquals(25, merged.getSpeedLimit(Set.of("z")));
        assertEquals(10, merged.getSpeedLimit(Set.of("x", "z")));
    }
}
