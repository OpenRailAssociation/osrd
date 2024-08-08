package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.pathfinding.runPathfinding
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DummyInfra
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingElectrificationTest : ApiTest() {
    @Test
    fun incompatibleElectrificationsTest() {
        /*       c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2
         */
        val infra = DummyInfra()
        infra.addBlock("a", "b")
        infra.addBlock("b", "c1")
        infra.addBlock("b", "c2")
        infra.addBlock("c1", "d")
        infra.addBlock("c2", "d")
        infra.addBlock("d", "e")
        val waypointStart = PathfindingWaypoint("a->b", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("d->e", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd

        // Run a pathfinding with a non-electric train
        val normalPath =
            runPathfinding(
                infra.fullInfra(),
                waypoints,
                listOf(TestTrains.REALISTIC_FAST_TRAIN),
                null
            )
        Assertions.assertNotNull(normalPath)
        assert(TestTrains.FAST_ELECTRIC_TRAIN.modeNames.contains("25000V"))
        for (block in infra.blockPool) block.voltage = "25000V"

        // Removes electrification in the section used by the normal train
        for (range in normalPath.ranges) {
            if (setOf("b->c1", "b->c2").contains(infra.getRouteName(RouteId(range.edge.index)))) {
                infra.blockPool[range.edge.index.toInt()].voltage = ""
            }
        }

        // Run another pathfinding with an electric train
        val electricPath =
            runPathfinding(
                infra.fullInfra(),
                waypoints,
                listOf(TestTrains.FAST_ELECTRIC_TRAIN),
                null
            )
        Assertions.assertNotNull(electricPath)

        // We check that the path is different, we need to avoid the non-electrified track
        val normalRoutes =
            normalPath.ranges
                .stream()
                .map { range -> infra.getRouteName(RouteId(range.edge.index)) }
                .toList()
        val electrifiedRoutes =
            electricPath.ranges
                .stream()
                .map { range -> infra.getRouteName(RouteId(range.edge.index)) }
                .toList()
        assertNotEquals(normalRoutes, electrifiedRoutes)

        // Remove all electrification
        for (block in infra.blockPool) block.voltage = ""
        val exception =
            Assertions.assertThrows(OSRDError::class.java) {
                runPathfinding(
                    infra.fullInfra(),
                    waypoints,
                    listOf(TestTrains.FAST_ELECTRIC_TRAIN),
                    null
                )
            }
        Assertions.assertEquals(exception.osrdErrorType, ErrorType.PathfindingElectrificationError)
    }

    @ParameterizedTest
    @MethodSource("testNeutralSectionArgs")
    fun testNeutralSectionAndElectrificationPathfinding(
        withElectrification: Boolean,
        withNeutralSection: Boolean,
        neutralSectionDirection: Direction?
    ) {
        val infra = DummyInfra()
        infra.addBlock("a", "b")
        val secondBlock = infra.addBlock("b", "c")
        infra.addBlock("c", "d")
        val waypointStart = PathfindingWaypoint("a->b", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("c->d", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd

        // Run a pathfinding with a non-electric train
        val normalPath =
            runPathfinding(
                infra.fullInfra(),
                waypoints,
                listOf(TestTrains.REALISTIC_FAST_TRAIN),
                null
            )
        Assertions.assertNotNull(normalPath)
        assert(TestTrains.FAST_ELECTRIC_TRAIN.modeNames.contains("25000V"))
        for (block in infra.blockPool) block.voltage = "25000V"
        if (!withElectrification) {
            // Remove electrification in the middle of the path
            infra.blockPool[secondBlock.index.toInt()].voltage = ""
        }
        if (withNeutralSection) {
            // Add a neutral section in the middle of the path
            if (neutralSectionDirection == Direction.INCREASING)
                infra.blockPool[secondBlock.index.toInt()].neutralSectionForward =
                    NeutralSection(lowerPantograph = false, isAnnouncement = false)
            else
                infra.blockPool[secondBlock.index.toInt()].neutralSectionBackward =
                    NeutralSection(lowerPantograph = false, isAnnouncement = false)
        }
        if (
            withElectrification ||
                withNeutralSection && neutralSectionDirection == Direction.INCREASING
        ) {
            // Run another pathfinding with an electric train
            val electricPath =
                runPathfinding(
                    infra.fullInfra(),
                    waypoints,
                    listOf(TestTrains.FAST_ELECTRIC_TRAIN),
                    null
                )
            Assertions.assertNotNull(electricPath)
        } else {
            val exception =
                Assertions.assertThrows(OSRDError::class.java) {
                    runPathfinding(
                        infra.fullInfra(),
                        waypoints,
                        listOf(TestTrains.FAST_ELECTRIC_TRAIN),
                        null
                    )
                }
            Assertions.assertEquals(
                exception.osrdErrorType,
                ErrorType.PathfindingElectrificationError
            )
        }
    }

    companion object {
        @JvmStatic
        fun testNeutralSectionArgs(): Stream<Arguments> {
            return Stream
                .of( // With electrification, with neutral section, neutral section direction
                    Arguments.of(true, true, Direction.INCREASING),
                    Arguments.of(true, true, Direction.DECREASING),
                    Arguments.of(true, false, null),
                    Arguments.of(false, true, Direction.INCREASING),
                    Arguments.of(false, true, Direction.DECREASING),
                    Arguments.of(false, false, null)
                )
        }
    }
}
