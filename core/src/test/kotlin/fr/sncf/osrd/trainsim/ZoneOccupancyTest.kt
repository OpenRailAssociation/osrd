package fr.sncf.osrd.trainsim

import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.utils.Helpers
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class ZoneOccupancyTest {
    private val infra = Helpers.tinyInfra
    private val routes =
        listOf(
            "rt.buffer_stop_c->tde.track-bar",
            "rt.tde.track-bar->tde.switch_foo-track",
            "rt.tde.switch_foo-track->buffer_stop_a",
        )
    private val blocks = Helpers.getBlocksOnRoutes(infra, routes)
    private val trainPath =
        buildTrainPathFromBlocks(
            infra.rawInfra,
            infra.blockInfra,
            blocks,
            listOf(),
            routes.map { infra.rawInfra.getRouteFromName(it) },
        )
    private val zones = trainPath.getZoneRanges()
    private val trainLength = 100.0.meters

    // The first detector inside the path, between the first two zones
    private val firstDetector = zones[1].pathBegin.toPrecise()

    private fun at(head: PreciseDistance) = occupiedZones(zones, head, trainLength)

    @Test
    fun testPathHasSeveralZones() {
        assertTrue(zones.size >= 2)
        assertTrue(firstDetector > trainLength)
    }

    @Test
    fun testHeadInsideTheFirstZone() {
        assertEquals(listOf(zones[0].value), at(firstDetector - 1.0.meters))
    }

    @Test
    fun testTrainStraddlingADetectorOccupiesBothZones() {
        assertEquals(
            listOf(zones[0].value, zones[1].value),
            at(firstDetector + trainLength / 2L),
        )
    }

    @Test
    fun testHeadOnADetectorDoesNotOccupyTheNextZone() {
        assertEquals(listOf(zones[0].value), at(firstDetector))
    }

    @Test
    fun testTailOnADetectorDoesNotOccupyThePreviousZone() {
        assertEquals(listOf(zones[1].value), at(firstDetector + trainLength))
    }

    @Test
    fun testTailBeforeThePathStartIsClamped() {
        assertEquals(listOf(zones[0].value), at(trainLength / 2L))
    }

    @Test
    fun testTrainAtPathStartOccupiesNothing() {
        assertEquals(listOf(), at(0.micrometers))
    }
}
