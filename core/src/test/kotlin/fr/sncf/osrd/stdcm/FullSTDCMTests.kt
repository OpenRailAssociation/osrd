package fr.sncf.osrd.stdcm

import com.google.common.collect.Multimap
import fr.sncf.osrd.Helpers
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser
import fr.sncf.osrd.stdcm.STDCMHelpers.getMaxOccupancyLength
import fr.sncf.osrd.stdcm.STDCMHelpers.makeOccupancyFromPath
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import java.io.IOException
import java.net.URISyntaxException

class FullSTDCMTests {
    /** Simple test on tiny infra with no occupancy.
     * This is the same test as the one testing the STDCM API, but calling the methods directly  */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testTinyInfra() {
        val infra = Helpers.infraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        val firstRoute = infra.findSignalingRoute("rt.buffer_stop_b->tde.foo_b-switch_foo", "BAL3")
        val secondRoute = infra.findSignalingRoute("rt.tde.foo_b-switch_foo->buffer_stop_c", "BAL3")
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setRollingStock(
                RJSRollingStockParser.parse(Helpers.parseRollingStockDir(Helpers.getResourcePath("rolling_stocks/"))[0])
            )
            .setStartLocations(setOf(EdgeLocation(firstRoute, 100.0)))
            .setEndLocations(setOf(EdgeLocation(secondRoute, 10125.0)))
            .run()
        Assertions.assertNotNull(res)
    }

    /** We try to fit a train in a short opening between two trains.
     * We create a train at t=0, get the minimum delay we need (how long its longest occupancy block lasts),
     * add a train at `2 * min delay`, and try to fit a train between the two.  */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testTinyInfraSmallOpening() {
        val fullInfra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        val infra = fullInfra.java
        val firstRoute = infra.findSignalingRoute("rt.buffer_stop_b->tde.foo_b-switch_foo", "BAL3")
        val secondRoute = infra.findSignalingRoute("rt.tde.foo_b-switch_foo->buffer_stop_c", "BAL3")
        val start = setOf(EdgeLocation(firstRoute, 100.0))
        val end = setOf(EdgeLocation(secondRoute, 10125.0))
        val occupancies: Multimap<SignalingRoute, OccupancyBlock> = makeOccupancyFromPath(fullInfra, start, end, 0.0)
        val minDelay = getMaxOccupancyLength(occupancies) // Eventually we may need to add a % margin
        occupancies.putAll(makeOccupancyFromPath(fullInfra, start, end, minDelay * 2))
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(minDelay)
            .setStartLocations(start)
            .setEndLocations(end)
            .setUnavailableTimes(occupancies)
            .run()!!
    }

    /** We try to fit a train in a short opening between two trains, this time on small_infra  */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraSmallOpening() {
        val fullInfra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"))
        val infra = fullInfra.java
        val firstRoute = infra.findSignalingRoute("rt.buffer_stop.3->DB0", "BAL3")
        val secondRoute = infra.findSignalingRoute("rt.DH1_2->buffer_stop.7", "BAL3")
        val start = setOf(EdgeLocation(firstRoute, 1590.0))
        val end = setOf(EdgeLocation(secondRoute, 1137.0))
        val occupancies = makeOccupancyFromPath(fullInfra, start, end, 0.0)
        occupancies.putAll(makeOccupancyFromPath(fullInfra, start, end, 600.0))
        val res = STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(300.0)
            .setStartLocations(start)
            .setEndLocations(end)
            .setUnavailableTimes(occupancies)
            .run()
        Assertions.assertNotNull(res)
    }
}
