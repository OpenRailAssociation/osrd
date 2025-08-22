package fr.sncf.osrd.conflicts

import fr.sncf.osrd.sim_infra.api.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals

class IncrementalConflictDetectorTests {
    data class SimpleRequirement(val zoneId: Int, val start: Double, val end: Double)

    @Test
    fun simpleAvailableTest() {
        val detector =
            makeDetector(SimpleRequirement(0, 0.0, 1_000.0), SimpleRequirement(0, 2_000.0, 3_000.0))
        val res =
            checkConflict(detector, SimpleRequirement(0, 1_200.0, 1_400.0)) as NoConflictResponse
        assertEquals(600.0, res.maxDelayWithoutConflicts)
        assertEquals(2_000.0, res.timeOfNextConflict)
    }

    @Test
    fun simpleNoAvailableTest() {
        val detector =
            makeDetector(SimpleRequirement(0, 0.0, 900.0), SimpleRequirement(0, 1_100.0, 2_000.0))
        val res = checkConflict(detector, SimpleRequirement(0, 200.0, 450.0)) as ConflictResponse
        assertEquals(200.0, res.firstConflictTime)
        assertEquals(1_800.0, res.minDelayWithoutConflicts)
    }

    fun makeDetector(vararg requirements: SimpleRequirement): IncrementalConflictDetector {
        return IncrementalConflictDetector(
            generateSpacingZoneUses(
                listOf(
                    Requirements(
                        RequirementId("0", RequirementType.TRAIN),
                        requirements.map {
                            SpacingRequirement(ZoneId(it.zoneId.toUInt()), it.start, it.end, true)
                        },
                        listOf(),
                    )
                )
            )
        )
    }

    fun checkConflict(
        detector: IncrementalConflictDetector,
        vararg requirements: SimpleRequirement,
    ): IncrementalConflictResponse {
        return detector.analyseConflicts(
            requirements.map {
                SpacingRequirement(ZoneId(it.zoneId.toUInt()), it.start, it.end, true)
            }
        )
    }
}
