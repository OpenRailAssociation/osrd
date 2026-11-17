package fr.sncf.osrd.trainsim

import fr.sncf.osrd.conflicts.RoutingZoneConfig
import fr.sncf.osrd.sim_infra.api.Detector
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.StaticIdx
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class ReservationTableTest {
    private val zone: ZoneId = StaticIdx(0u)
    private val otherZone: ZoneId = StaticIdx(1u)

    private fun detector(index: UInt): DirDetectorId =
        DirDetectorId(StaticIdx<Detector>(index), Direction.INCREASING)

    private val westToEast =
        RoutingZoneConfig(detector(0u), detector(1u), mapOf("switch" to "A_B1"))

    private val westToBranch =
        RoutingZoneConfig(detector(0u), detector(2u), mapOf("switch" to "A_B2"))

    @Test
    fun testFirstTrainGetsTheZone() {
        val table = ReservationTable()

        assertTrue(table.request(zone, westToEast, train = 0))
        assertEquals(listOf(0), table.holders(zone))
    }

    @Test
    fun testTrainsGoingTheSameWayShareTheZone() {
        val table = ReservationTable()
        table.request(zone, westToEast, train = 0)

        assertTrue(table.request(zone, westToEast, train = 1))
        assertEquals(listOf(0, 1), table.holders(zone))
    }

    @Test
    fun testTrainsGoingDifferentWaysDoNotShareTheZone() {
        val table = ReservationTable()
        table.request(zone, westToEast, train = 0)

        assertFalse(table.request(zone, westToBranch, train = 1))
        assertEquals(listOf(0), table.holders(zone))
    }

    @Test
    fun testAskingAgainForAHeldZoneChangesNothing() {
        val table = ReservationTable()
        table.request(zone, westToEast, train = 0)

        assertTrue(table.request(zone, westToEast, train = 0))
        assertEquals(listOf(0), table.holders(zone))
    }

    @Test
    fun testReleasingLetsTheNextTrainThrough() {
        val table = ReservationTable()
        table.request(zone, westToEast, train = 0)
        assertFalse(table.request(zone, westToBranch, train = 1))

        table.release(zone, train = 0)

        assertTrue(table.request(zone, westToBranch, train = 1))
        assertEquals(listOf(1), table.holders(zone))
    }

    @Test
    fun testReleasingOneTrainLeavesTheOtherHolders() {
        val table = ReservationTable()
        table.request(zone, westToEast, train = 0)
        table.request(zone, westToEast, train = 1)

        table.release(zone, train = 0)

        assertEquals(listOf(1), table.holders(zone))
        // the zone is still held the same way, so a crossing train still can't have it
        assertFalse(table.request(zone, westToBranch, train = 2))
    }

    @Test
    fun testZonesAreIndependent() {
        val table = ReservationTable()
        table.request(zone, westToEast, train = 0)

        assertTrue(table.request(otherZone, westToBranch, train = 1))
        assertEquals(listOf(0), table.holders(zone))
        assertEquals(listOf(1), table.holders(otherZone))
    }

    @Test
    fun testReleasingAZoneNeverHeldIsHarmless() {
        val table = ReservationTable()

        table.release(zone, train = 0)

        assertEquals(listOf(), table.holders(zone))
        assertTrue(table.request(zone, westToEast, train = 0))
    }
}
