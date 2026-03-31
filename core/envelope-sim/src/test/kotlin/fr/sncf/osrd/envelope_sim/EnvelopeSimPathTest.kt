package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.path.implementations.EnvelopeSimPath
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.offsetRangeMapOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
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
        val modes =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(0.0.meters, 10.0.meters, NonElectrified()),
                DistanceRangeMap.RangeMapEntry(3.0.meters, 7.0.meters, Electrified("1500V")),
                DistanceRangeMap.RangeMapEntry(7.1.meters, 10.0.meters, Electrified("25000V")),
            )
        val path =
            EnvelopeSimPath(10.0, doubleArrayOf(0.0, 10.0), doubleArrayOf(0.0), modes, HashMap())
        val modeAndProfileMap = path.getElectrificationMap(null, null, null, true)

        Assertions.assertTrue(modeAndProfileMap.fullyCovers(10.0.meters))

        Assertions.assertEquals(modeAndProfileMap.get(0.0.meters), NonElectrified())
        Assertions.assertEquals(modeAndProfileMap.get(4.0.meters), Electrified("1500V"))
        Assertions.assertEquals(modeAndProfileMap.get(7.05.meters), NonElectrified())
        Assertions.assertEquals(modeAndProfileMap.get(7.2.meters), Electrified("25000V"))
    }

    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun getElectrificationModeAndProfile(withEmptyPowerRestrictionMap: Boolean) {
        val path = EnvelopeSimPathBuilder.withElectricalProfiles1500()
        val modeAndProfileMap =
            if (withEmptyPowerRestrictionMap)
                path.getElectrificationMap(
                    "2",
                    offsetRangeMapOf<PhysicsPath, String>(),
                    mapOf("Restrict1" to "1"),
                )
            else path.getElectrificationMap("2", null, mapOf("Restrict1" to "1"))

        Assertions.assertTrue(modeAndProfileMap.fullyCovers(path.length.meters))

        Assertions.assertEquals(9, modeAndProfileMap.asList().size)

        Assertions.assertEquals(modeAndProfileMap.get(2.0.meters), Electrified("1500V", null, null))
        Assertions.assertEquals(modeAndProfileMap.get(3.5.meters), Electrified("1500V", "A", null))
        Assertions.assertEquals(modeAndProfileMap.get(5.5.meters), Electrified("1500V", "C", null))
        Assertions.assertEquals(modeAndProfileMap.get(6.5.meters), Electrified("1500V", "B", null))
    }

    @Test
    fun getElectrificationModeAndProfileWithPowerRestrictions() {
        val path = EnvelopeSimPathBuilder.withElectricalProfiles1500()

        val powerRestrictionMap =
            offsetRangeMapOf(
                OffsetRangeMap.RangeMapEntry(
                    Offset<PhysicsPath>(2.5.meters),
                    Offset(6.5.meters),
                    "Restrict2",
                )
            )

        val modeAndProfileMap =
            path.getElectrificationMap("1", powerRestrictionMap, mapOf("Restrict2" to "2"))

        Assertions.assertTrue(modeAndProfileMap.fullyCovers(path.length.meters))

        Assertions.assertEquals(10, modeAndProfileMap.asList().size)

        Assertions.assertEquals(modeAndProfileMap.get(0.5.meters), NonElectrified())
        Assertions.assertEquals(
            modeAndProfileMap.get(2.75.meters),
            Electrified("1500V", null, "Restrict2"),
        )
        Assertions.assertEquals(
            modeAndProfileMap.get(3.25.meters),
            Electrified("1500V", "A", "Restrict2"),
        )
        Assertions.assertEquals(
            modeAndProfileMap.get(4.5.meters),
            Electrified("1500V", "B", "Restrict2"),
        )
        Assertions.assertEquals(
            modeAndProfileMap.get(5.5.meters),
            Electrified("1500V", "C", "Restrict2"),
        )
        Assertions.assertEquals(
            modeAndProfileMap.get(6.25.meters),
            Electrified("1500V", "B", "Restrict2"),
        )
        Assertions.assertEquals(modeAndProfileMap.get(6.75.meters), Electrified("1500V", "A", null))
    }

    @Test
    fun getElectrificationModeAndProfileWithPowerRestrictionsWithoutElectricalProfiles() {
        val path = EnvelopeSimPathBuilder.withElectricalProfiles1500()

        val powerRestrictionMap =
            offsetRangeMapOf(
                OffsetRangeMap.RangeMapEntry(
                    Offset<PhysicsPath>(2.5.meters),
                    Offset(6.5.meters),
                    "Restrict2",
                )
            )

        val modeAndProfileMap =
            path.getElectrificationMap("1", powerRestrictionMap, mapOf("Restrict2" to "2"), true)

        Assertions.assertEquals(6, modeAndProfileMap.asList().size)

        Assertions.assertEquals(modeAndProfileMap.get(2.0.meters), Electrified("1500V", null, null))
        Assertions.assertEquals(
            modeAndProfileMap.get(4.5.meters),
            Electrified("1500V", null, "Restrict2"),
        )
        Assertions.assertSame(modeAndProfileMap.get(4.5.meters), modeAndProfileMap.get(5.5.meters))
        Assertions.assertSame(modeAndProfileMap.get(5.5.meters), modeAndProfileMap.get(6.25.meters))
        Assertions.assertEquals(
            modeAndProfileMap.get(6.75.meters),
            Electrified("1500V", null, null),
        )
        Assertions.assertEquals(
            modeAndProfileMap.get(9.0.meters),
            Electrified("25000V", null, null),
        )
    }
}
