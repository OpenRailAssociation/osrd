package fr.sncf.osrd.trainsim

import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.utils.Helpers
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test

class SignalStatesTest {
    private val infra = Helpers.smallInfra
    private val routes = listOf("rt.buffer_stop.3->DB0", "rt.DB0->DA6")
    private val trainPath =
        buildTrainPathFromBlocks(
            infra.rawInfra,
            infra.blockInfra,
            Helpers.getBlocksOnRoutes(infra, routes),
            listOf(),
            routes.map { infra.rawInfra.getRouteFromName(it) },
        )
    private val zones = trainPath.getZoneRanges()
    private val trainLength = 100.0.meters

    private fun aspects(occupied: Set<ZoneId>) =
        signalStates(infra, trainPath, occupied).entries.associate {
            infra.rawInfra.getLogicalSignalName(it.key)!! to it.value.getEnum("aspect")
        }

    private fun aspects(sb0: String, sa72r: String, sa75r: String, sa6: String) =
        mapOf("SB0" to sb0, "SA7_2r" to sa72r, "SA7_5r" to sa75r, "SA6" to sa6)

    private fun trainAt(head: PreciseDistance) = occupiedZones(zones, head, trainLength).toSet()

    @Test
    fun testClearPathAnnouncesTheStopAtTheEnd() {
        assertEquals(aspects("VL", "VL", "VL", "A"), aspects(setOf()))
    }

    @Test
    fun testOccupiedBlockStopsTheSignalProtectingIt() {
        assertEquals(aspects("A", "S", "VL", "A"), aspects(setOf(zones[5].value)))
    }

    @Test
    fun testAnyOccupiedZoneOfABlockStopsItsSignal() {
        for (zone in zones.subList(1, 5)) {
            assertEquals(aspects("S", "VL", "VL", "A"), aspects(setOf(zone.value)))
        }
    }

    @Test
    fun testZoneBeforeTheFirstSignalChangesNothing() {
        assertEquals(aspects(setOf()), aspects(setOf(zones[0].value)))
    }

    @Test
    fun testZoneOutsideOfThePathIsIgnored() {
        val pathZones = zones.map { it.value }.toSet()
        val outside = infra.rawInfra.zones.first { it !in pathZones }
        assertEquals(aspects(setOf()), aspects(setOf(outside)))
    }

    @Test
    fun testTrainInTheLastBlockCascadesBackwards() {
        val head = zones.last().pathEnd.toPrecise() - 1.0.meters
        assertEquals(aspects("VL", "A", "S", "A"), aspects(trainAt(head)))
    }

    @Test
    fun testOwnZonesOnlyAffectSignalsBehindTheHead() {
        val head = zones[1].pathBegin.toPrecise() + 1.0.meters
        assertEquals(aspects("S", "VL", "VL", "A"), aspects(trainAt(head)))
    }

    @Test
    fun testOccupanciesOfSeveralTrainsAddUp() {
        val leader = trainAt(zones.last().pathEnd.toPrecise() - 1.0.meters)
        val follower = trainAt(zones[1].pathBegin.toPrecise() + 1.0.meters)
        assertEquals(aspects("S", "A", "S", "A"), aspects(leader + follower))
    }
}
