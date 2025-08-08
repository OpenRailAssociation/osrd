package fr.sncf.osrd.envelope_sim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.path.implementations.EnvelopeSimPath
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.utils.RangeMapUtils
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class EnvelopeSimPathTest {
    @Test
    fun testAverageGrade() {
        val path =
            EnvelopeSimPathBuilder.buildNonElectrified(
                10.0,
                doubleArrayOf(0.0, 3.0, 6.0, 9.0, 10.0),
                doubleArrayOf(0.0, 2.0, -2.0, 0.0),
            )
        Assertions.assertEquals(10.0, path.length)
        Assertions.assertEquals(0.0, path.getAverageGrade(0.0, 3.0))
        Assertions.assertEquals(0.0, path.getAverageGrade(0.0, 10.0))
        Assertions.assertEquals(0.0, path.getAverageGrade(9.0, 10.0))
        Assertions.assertEquals(-1.5, path.getAverageGrade(6.0, 10.0))
        Assertions.assertEquals(1.0, path.getAverageGrade(2.0, 4.0))
    }

    @Test
    fun findHighGradePosition() {
        val path =
            EnvelopeSimPathBuilder.buildNonElectrified(
                10.0,
                doubleArrayOf(0.0, 3.0, 6.0, 9.0, 10.0),
                doubleArrayOf(0.0, 2.0, -2.0, 0.0),
            )
        Assertions.assertEquals(0.0, path.getAverageGrade(0.0, 3.0))
        Assertions.assertEquals(0.0, path.getAverageGrade(0.0, 10.0))
        Assertions.assertEquals(0.0, path.getAverageGrade(9.0, 10.0))
        Assertions.assertEquals(-1.5, path.getAverageGrade(6.0, 10.0))
        Assertions.assertEquals(1.0, path.getAverageGrade(2.0, 4.0))
    }

    @Test
    fun getElectrificationModeAndProfileOnlyModes() {
        val modes = TreeRangeMap.create<Double, Electrification>()
        modes.put(Range.closed(0.0, 10.0), NonElectrified())
        modes.put(Range.closed(3.0, 7.0), Electrified("1500V"))
        modes.put(Range.closed(7.1, 10.0), Electrified("25000V"))
        val path =
            EnvelopeSimPath(
                10.0,
                doubleArrayOf(0.0, 10.0),
                doubleArrayOf(0.0),
                ImmutableRangeMap.copyOf(modes),
                HashMap(),
            )
        val modeAndProfileMap = path.getElectrificationMap(null, null, null, true)

        Assertions.assertTrue(RangeMapUtils.fullyCovers(modeAndProfileMap, 10.0))

        Assertions.assertEquals(modeAndProfileMap[0.0], NonElectrified())
        Assertions.assertEquals(modeAndProfileMap[4.0], Electrified("1500V"))
        Assertions.assertEquals(modeAndProfileMap[7.05], NonElectrified())
        Assertions.assertEquals(modeAndProfileMap[7.2], Electrified("25000V"))
    }

    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun getElectrificationModeAndProfile(withEmptyPowerRestrictionMap: Boolean) {
        val path = EnvelopeSimPathBuilder.withElectricalProfiles1500()
        val modeAndProfileMap: RangeMap<Double, Electrification> =
            if (withEmptyPowerRestrictionMap)
                path.getElectrificationMap("2", ImmutableRangeMap.of(), mapOf("Restrict1" to "1"))
            else path.getElectrificationMap("2", null, mapOf("Restrict1" to "1"))

        Assertions.assertTrue(RangeMapUtils.fullyCovers(modeAndProfileMap, path.length))

        Assertions.assertEquals(9, modeAndProfileMap.asMapOfRanges().size)

        Assertions.assertEquals(modeAndProfileMap[2.0], Electrified("1500V", null, null))
        Assertions.assertEquals(modeAndProfileMap[3.5], Electrified("1500V", "A", null))
        Assertions.assertEquals(modeAndProfileMap[5.5], Electrified("1500V", "C", null))
        Assertions.assertEquals(modeAndProfileMap[6.5], Electrified("1500V", "B", null))
    }

    @Test
    fun getElectrificationModeAndProfileWithPowerRestrictions() {
        val path = EnvelopeSimPathBuilder.withElectricalProfiles1500()

        val powerRestrictionMap = TreeRangeMap.create<Double, String>()
        powerRestrictionMap.put(Range.closed(2.5, 6.5), "Restrict2")

        val modeAndProfileMap =
            path.getElectrificationMap("1", powerRestrictionMap, mapOf("Restrict2" to "2"))

        Assertions.assertTrue(RangeMapUtils.fullyCovers(modeAndProfileMap, path.length))

        Assertions.assertEquals(10, modeAndProfileMap.asMapOfRanges().size)

        Assertions.assertEquals(modeAndProfileMap[0.5], NonElectrified())
        Assertions.assertEquals(modeAndProfileMap[2.75], Electrified("1500V", null, "Restrict2"))
        Assertions.assertEquals(modeAndProfileMap[3.25], Electrified("1500V", "A", "Restrict2"))
        Assertions.assertEquals(modeAndProfileMap[4.5], Electrified("1500V", "B", "Restrict2"))
        Assertions.assertEquals(modeAndProfileMap[5.5], Electrified("1500V", "C", "Restrict2"))
        Assertions.assertEquals(modeAndProfileMap[6.25], Electrified("1500V", "B", "Restrict2"))
        Assertions.assertEquals(modeAndProfileMap[6.75], Electrified("1500V", "A", null))
    }

    @Test
    fun getElectrificationModeAndProfileWithPowerRestrictionsWithoutElectricalProfiles() {
        val path = EnvelopeSimPathBuilder.withElectricalProfiles1500()

        val powerRestrictionMap = TreeRangeMap.create<Double, String>()
        powerRestrictionMap.put(Range.closed(2.5, 6.5), "Restrict2")

        val modeAndProfileMap =
            path.getElectrificationMap("1", powerRestrictionMap, mapOf("Restrict2" to "2"), true)

        Assertions.assertEquals(6, modeAndProfileMap.asMapOfRanges().size)

        Assertions.assertEquals(modeAndProfileMap[2.0], Electrified("1500V", null, null))
        Assertions.assertEquals(modeAndProfileMap[4.5], Electrified("1500V", null, "Restrict2"))
        Assertions.assertSame(modeAndProfileMap[4.5], modeAndProfileMap[5.5])
        Assertions.assertSame(modeAndProfileMap[5.5], modeAndProfileMap[6.25])
        Assertions.assertEquals(modeAndProfileMap[6.75], Electrified("1500V", null, null))
        Assertions.assertEquals(modeAndProfileMap[9.0], Electrified("25000V", null, null))
    }
}
