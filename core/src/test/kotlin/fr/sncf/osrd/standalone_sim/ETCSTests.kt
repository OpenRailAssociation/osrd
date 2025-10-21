package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers.tinyInfra
import fr.sncf.osrd.utils.pathFromTracks
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals

class ETCSTests {

    // [buffer stop]
    //     foo_a: 200m
    // [switch]
    //     foo_to_bar: 10_000m
    // [no switch, just a link]
    //     bar_a: 200m
    // [buffer stop]

    @Test
    fun simpleTestDangerPointsForwards() {
        val fullInfra = tinyInfra
        val infra = fullInfra.rawInfra
        val trackIds = listOf("ne.micro.foo_a", "ne.micro.foo_to_bar", "ne.micro.bar_a")
        val routesNames =
            listOf(
                "rt.buffer_stop_a->tde.foo_a-switch_foo",
                "rt.tde.foo_a-switch_foo->buffer_stop_c",
            )
        val start = 0.meters // Path fully covers the tracks
        val end = 10_400.meters
        val trainPath =
            pathFromTracks(
                fullInfra,
                trackIds,
                Direction.INCREASING,
                start,
                end,
                routeNames = routesNames,
            )
        val dangerPoints = buildETCSDangerPoints(infra, trainPath)
        assertEquals(listOf(Offset(200.meters), Offset(10400.meters)), dangerPoints)
    }

    @Test
    fun testDangerPointsForwardsTracksPartiallyCovered() {
        val fullInfra = tinyInfra
        val infra = fullInfra.rawInfra
        val trackIds = listOf("ne.micro.foo_a", "ne.micro.foo_to_bar", "ne.micro.bar_a")
        val routesNames =
            listOf(
                "rt.buffer_stop_a->tde.foo_a-switch_foo",
                "rt.tde.foo_a-switch_foo->buffer_stop_c",
            )
        val start = 100.meters // Shifts all positions by 100.meters
        val end = 10_100.meters // Don't reach all the way until the buffer stop
        val trainPath =
            pathFromTracks(
                fullInfra,
                trackIds,
                Direction.INCREASING,
                start,
                end,
                routeNames = routesNames,
            )
        val dangerPoints = buildETCSDangerPoints(infra, trainPath)
        assertEquals(listOf(Offset(100.meters), Offset(10_300.meters)), dangerPoints)
    }

    @Test
    fun testDangerPointsBackwards() {
        val fullInfra = tinyInfra
        val infra = fullInfra.rawInfra
        val trackIds = listOf("ne.micro.bar_a", "ne.micro.foo_to_bar", "ne.micro.foo_a")
        val routesNames =
            listOf(
                "rt.buffer_stop_c->tde.track-bar",
                "rt.tde.track-bar->tde.switch_foo-track",
                "rt.tde.switch_foo-track->buffer_stop_a",
            )
        val start = 100.meters
        val end = 10_300.meters
        val trainPath =
            pathFromTracks(
                fullInfra,
                trackIds,
                Direction.DECREASING,
                start,
                end,
                routeNames = routesNames,
            )
        val dangerPoints = buildETCSDangerPoints(infra, trainPath)
        assertEquals(listOf(Offset(10_100.meters), Offset(10_300.meters)), dangerPoints)
    }

    @Test
    fun testDangerPointsBackwardsEndBeforeSwitch() {
        val fullInfra = tinyInfra
        val infra = fullInfra.rawInfra
        val trackIds = listOf("ne.micro.bar_a", "ne.micro.foo_to_bar", "ne.micro.foo_a")
        val routesNames =
            listOf("rt.buffer_stop_c->tde.track-bar", "rt.tde.track-bar->tde.switch_foo-track")
        val start = 100.meters
        val end = 5_000.meters
        val trainPath =
            pathFromTracks(
                fullInfra,
                trackIds,
                Direction.DECREASING,
                start,
                end,
                routeNames = routesNames,
            )
        val dangerPoints = buildETCSDangerPoints(infra, trainPath)
        assertEquals(listOf(Offset(10_100.meters)), dangerPoints)
    }
}
