package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.FixedTime
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class AllowanceValueTest {
    @Test
    fun testFixedValue() {
        val allowance = FixedTime(42.0)
        Assertions.assertEquals(42.0, allowance.getAllowanceTime(Double.NaN, Double.NaN))
    }

    @Test
    fun testTimeDistribution() {
        val allowance = FixedTime(8.0)
        Assertions.assertEquals(
            2.0,
            allowance.getSectionAllowanceTime(1.0, 4.0, Double.NaN, Double.NaN),
        )
    }

    @Test
    fun testPercentValue() {
        val allowance = AllowanceValue.Percentage(42.0)
        Assertions.assertEquals(42.0, allowance.getAllowanceTime(100.0, Double.NaN), 0.01)
    }

    @Test
    fun testTimePerDistanceValue() {
        val allowance = AllowanceValue.TimePerDistance(1.0)
        Assertions.assertEquals(60.0, allowance.getAllowanceTime(Double.NaN, 100000.0), 0.01)
    }
}
