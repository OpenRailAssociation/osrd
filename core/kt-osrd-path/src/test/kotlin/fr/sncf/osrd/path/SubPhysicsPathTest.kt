package fr.sncf.osrd.path

import fr.sncf.osrd.path.implementations.SubPhysicsPath
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import org.junit.Test

class SubPhysicsPathTest {
    private data class TestElectrification(val id: String) : Electrification {
        override fun withElectricalProfile(profile: String): Electrification = this

        override fun withPowerRestriction(powerRestriction: String): Electrification = this
    }

    private class FakePhysicsPath(
        override val length: Double,
        private val averageGradeResult: Double,
        private val minGradeResult: Double,
        private val electrificationResult: DistanceRangeMap<Electrification>,
    ) : PhysicsPath {
        var lastAverageGradeCall: Pair<Double, Double>? = null
        var lastMinGradeCall: Pair<Double, Double>? = null
        var lastBasePowerClass: String? = null
        var lastPowerRestrictionMap: DistanceRangeMap<String>? = null
        var lastPowerRestrictionToPowerClass: Map<String, String>? = null
        var lastIgnoreElectricalProfiles: Boolean? = null

        override fun getAverageGrade(begin: Double, end: Double): Double {
            lastAverageGradeCall = Pair(begin, end)
            return averageGradeResult
        }

        override fun getMinGrade(begin: Double, end: Double): Double {
            lastMinGradeCall = Pair(begin, end)
            return minGradeResult
        }

        override fun getElectrificationMap(
            basePowerClass: String?,
            powerRestrictionMap: DistanceRangeMap<String>?,
            powerRestrictionToPowerClass: Map<String, String>?,
            ignoreElectricalProfiles: Boolean,
        ): DistanceRangeMap<Electrification> {
            lastBasePowerClass = basePowerClass
            lastPowerRestrictionMap = powerRestrictionMap
            lastPowerRestrictionToPowerClass = powerRestrictionToPowerClass
            lastIgnoreElectricalProfiles = ignoreElectricalProfiles
            return electrificationResult
        }
    }

    @Test
    fun lengthIsSubRangeSize() {
        val path =
            FakePhysicsPath(
                1_000.0,
                averageGradeResult = 0.0,
                minGradeResult = 0.0,
                electrificationResult = distanceRangeMapOf(),
            )

        val subPath = SubPhysicsPath(begin = 125.0, end = 425.0, path = path)

        assertEquals(300.0, subPath.length)
    }

    @Test
    fun gradeQueriesAreForwardedWithBeginOffset() {
        val path =
            FakePhysicsPath(
                1_000.0,
                averageGradeResult = 1.5,
                minGradeResult = -4.0,
                electrificationResult = distanceRangeMapOf(),
            )
        val subPath = SubPhysicsPath(begin = 100.0, end = 300.0, path = path)

        assertEquals(1.5, subPath.getAverageGrade(begin = 10.0, end = 70.0))
        assertEquals(Pair(110.0, 170.0), path.lastAverageGradeCall)

        assertEquals(-4.0, subPath.getMinGrade(begin = 0.0, end = 50.0))
        assertEquals(Pair(100.0, 150.0), path.lastMinGradeCall)
    }

    @Test
    fun gradeQueriesRejectNegativeBeginAndTooLargeEnd() {
        val path =
            FakePhysicsPath(
                1_000.0,
                averageGradeResult = 0.0,
                minGradeResult = 0.0,
                electrificationResult = distanceRangeMapOf(),
            )
        val subPath = SubPhysicsPath(begin = 200.0, end = 400.0, path = path)

        assertFailsWith<IllegalArgumentException> {
            subPath.getAverageGrade(begin = -1.0, end = 0.0)
        }
        assertFailsWith<IllegalArgumentException> { subPath.getMinGrade(begin = 0.0, end = 401.0) }
    }

    @Test
    fun electrificationMapAndRestrictionsAreShiftedAndBoundsPreserved() {
        val returnedElectrificationMap =
            distanceRangeMapOf<Electrification>(
                DistanceRangeMap.RangeMapEntry(
                    101.0.meters,
                    102.0.meters,
                    TestElectrification("e1"),
                ),
                DistanceRangeMap.RangeMapEntry(
                    103.0.meters,
                    104.0.meters,
                    TestElectrification("e2"),
                ),
                DistanceRangeMap.RangeMapEntry(
                    105.0.meters,
                    106.0.meters,
                    TestElectrification("e3"),
                ),
                DistanceRangeMap.RangeMapEntry(
                    107.0.meters,
                    108.0.meters,
                    TestElectrification("e4"),
                ),
            )

        val path =
            FakePhysicsPath(
                1_000.0,
                averageGradeResult = 0.0,
                minGradeResult = 0.0,
                electrificationResult = returnedElectrificationMap,
            )
        val subPath = SubPhysicsPath(begin = 100.0, end = 300.0, path = path)

        val inputRestrictionMap =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(0.0.meters, 10.0.meters, "r1"),
                DistanceRangeMap.RangeMapEntry(11.0.meters, 20.0.meters, "r2"),
                DistanceRangeMap.RangeMapEntry(21.0.meters, 30.0.meters, "r3"),
                DistanceRangeMap.RangeMapEntry(31.0.meters, 40.0.meters, "r4"),
            )
        val powerClassMap = mapOf("r1" to "A", "r2" to "B")

        val result =
            subPath.getElectrificationMap(
                basePowerClass = "base",
                powerRestrictionMap = inputRestrictionMap,
                powerRestrictionToPowerClass = powerClassMap,
                ignoreElectricalProfiles = true,
            )

        assertEquals("base", path.lastBasePowerClass)
        assertEquals(powerClassMap, path.lastPowerRestrictionToPowerClass)
        assertEquals(true, path.lastIgnoreElectricalProfiles)

        val forwardedRestrictions = path.lastPowerRestrictionMap
        assertNotNull(forwardedRestrictions)
        assertEquals(
            listOf(
                DistanceRangeMap.RangeMapEntry(100.0.meters, 110.0.meters, "r1"),
                DistanceRangeMap.RangeMapEntry(111.0.meters, 120.0.meters, "r2"),
                DistanceRangeMap.RangeMapEntry(121.0.meters, 130.0.meters, "r3"),
                DistanceRangeMap.RangeMapEntry(131.0.meters, 140.0.meters, "r4"),
            ),
            forwardedRestrictions.toList(),
        )

        assertEquals(
            listOf<DistanceRangeMap.RangeMapEntry<Electrification>>(
                DistanceRangeMap.RangeMapEntry(1.0.meters, 2.0.meters, TestElectrification("e1")),
                DistanceRangeMap.RangeMapEntry(3.0.meters, 4.0.meters, TestElectrification("e2")),
                DistanceRangeMap.RangeMapEntry(5.0.meters, 6.0.meters, TestElectrification("e3")),
                DistanceRangeMap.RangeMapEntry(7.0.meters, 8.0.meters, TestElectrification("e4")),
            ),
            result.toList(),
        )
    }
}
