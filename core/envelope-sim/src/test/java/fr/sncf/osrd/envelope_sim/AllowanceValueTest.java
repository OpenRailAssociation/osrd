package fr.sncf.osrd.envelope_sim;

import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import org.junit.jupiter.api.Test;

public class AllowanceValueTest {
    @Test
    public void testFixedValue() {
        var allowance = new AllowanceValue.FixedTime(42);
        assertEquals(42, allowance.getAllowanceTime(Double.NaN, Double.NaN));
    }

    @Test
    public void testTimeDistribution() {
        var allowance = new AllowanceValue.FixedTime(8);
        assertEquals(2, allowance.getSectionAllowanceTime(1, 4, Double.NaN, Double.NaN));
    }

    @Test
    public void testPercentValue() {
        var allowance = new AllowanceValue.Percentage(42);
        assertEquals(42, allowance.getAllowanceTime(100, Double.NaN), 0.01);
    }

    @Test
    public void testTimePerDistanceValue() {
        var allowance = new AllowanceValue.TimePerDistance(1);
        assertEquals(60, allowance.getAllowanceTime(Double.NaN, 100_000), 0.01);
    }
}
