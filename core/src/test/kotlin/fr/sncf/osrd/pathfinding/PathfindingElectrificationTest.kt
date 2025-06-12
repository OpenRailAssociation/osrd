package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.IncompatibleConstraintsPathResponse
import fr.sncf.osrd.api.pathfinding.NoPathFoundException
import fr.sncf.osrd.api.pathfinding.PathfindingBlockSuccess
import fr.sncf.osrd.api.pathfinding.runPathfinding
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
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
        /*        N
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 S
         */
        val infra = DummyInfra()
        infra.addBlock("a", "b")
        infra.addBlock("b", "N")
        infra.addBlock("b", "S")
        infra.addBlock("N", "d")
        infra.addBlock("S", "d")
        infra.addBlock("d", "e")
        val waypointsStart = listOf(TrackLocation("a->b", Offset.zero()))
        val waypointsEnd = listOf(TrackLocation("d->e", Offset(100.meters)))

        assert(TestTrains.FAST_ELECTRIC_TRAIN.modeNames.contains("25000V"))
        for (block in infra.blockPool) block.voltage = "25000V"

        // Run a pathfinding with all blocks electrified
        val normalPathResp =
            runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.FAST_ELECTRIC_TRAIN,
                    listOf(waypointsStart, waypointsEnd)
                )
            )
        assertThat(normalPathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)

        val normalTracks =
            (normalPathResp as PathfindingBlockSuccess).trackSectionRanges.map { it.trackSection }

        // Removes electrification in the section used by the normal train
        val normalPathTrackAfterB = normalTracks.intersect(setOf("b->N", "b->S"))
        infra.blockPool.forEach {
            if (it.name == normalPathTrackAfterB.single()) it.voltage = "bad_elec"
        }

        // Run another pathfinding with an electric train
        val electricPathResp =
            runPathfinding(
                infra.fullInfra(),
                getPathfindingBlockRequest(
                    TestTrains.FAST_ELECTRIC_TRAIN,
                    listOf(waypointsStart, waypointsEnd)
                )
            )
        assertThat(electricPathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)

        // We check that the path is different, we need to avoid the non-electrified track
        val electrifiedTracks =
            (electricPathResp as PathfindingBlockSuccess).trackSectionRanges.map { it.trackSection }
        assertNotEquals(normalTracks, electrifiedTracks)

        // Remove all electrification
        for (block in infra.blockPool) block.voltage = "bad_elec"
        assertThatThrownBy {
                runPathfinding(
                    infra.fullInfra(),
                    getPathfindingBlockRequest(
                        TestTrains.FAST_ELECTRIC_TRAIN,
                        listOf(waypointsStart, waypointsEnd)
                    )
                )
            }
            .isExactlyInstanceOf(NoPathFoundException::class.java)
            .satisfies({ exception: Throwable ->
                val resp =
                    (exception as NoPathFoundException).response
                        as IncompatibleConstraintsPathResponse
                assert(resp.relaxedConstraintsPath.length.distance == 400.meters)
                assert(
                    resp.incompatibleConstraints.incompatibleElectrificationRanges.single().value ==
                        "bad_elec"
                )
            })
    }

    @ParameterizedTest
    @MethodSource("testNeutralSectionArgs")
    fun testNeutralSectionAndElectrificationPathfinding(
        withElectrification: Boolean,
        neutralSectionDirection: Direction?,
        pathSuccess: Boolean
    ) {
        val infra = DummyInfra()
        infra.addBlock("a", "b")
        val blockBC = infra.addBlock("b", "c")
        infra.addBlock("c", "d")

        val waypointsStart = listOf(TrackLocation("a->b", Offset.zero()))
        val waypointsEnd = listOf(TrackLocation("c->d", Offset(100.meters)))

        assert(TestTrains.FAST_ELECTRIC_TRAIN.modeNames.contains("25000V"))
        for (block in infra.blockPool) block.voltage = "25000V"

        if (!withElectrification) {
            // Remove electrification in the middle of the path
            infra.blockPool[blockBC.index.toInt()].voltage = "bad_elec"
        }
        if (neutralSectionDirection != null) {
            // Add a neutral section in the middle of the path
            if (neutralSectionDirection == Direction.INCREASING)
                infra.blockPool[blockBC.index.toInt()].neutralSectionForward =
                    NeutralSection(lowerPantograph = false, isAnnouncement = false)
            else
                infra.blockPool[blockBC.index.toInt()].neutralSectionBackward =
                    NeutralSection(lowerPantograph = false, isAnnouncement = false)
        }

        if (pathSuccess) {
            val electricPathResp =
                runPathfinding(
                    infra.fullInfra(),
                    getPathfindingBlockRequest(
                        TestTrains.FAST_ELECTRIC_TRAIN,
                        listOf(waypointsStart, waypointsEnd)
                    )
                )
            assertThat(electricPathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
            assertThat((electricPathResp as PathfindingBlockSuccess).length.distance == 300.meters)
        } else {
            assertThatThrownBy {
                    runPathfinding(
                        infra.fullInfra(),
                        getPathfindingBlockRequest(
                            TestTrains.FAST_ELECTRIC_TRAIN,
                            listOf(waypointsStart, waypointsEnd)
                        )
                    )
                }
                .isExactlyInstanceOf(NoPathFoundException::class.java)
                .satisfies({ exception: Throwable ->
                    val resp =
                        (exception as NoPathFoundException).response
                            as IncompatibleConstraintsPathResponse
                    assert(resp.relaxedConstraintsPath.length.distance == 300.meters)
                    assert(
                        resp.incompatibleConstraints.incompatibleElectrificationRanges
                            .single()
                            .value == "bad_elec"
                    )
                })
        }
    }

    companion object {
        @JvmStatic
        fun testNeutralSectionArgs(): Stream<Arguments> {
            return Stream.of( // With electrification, neutral section direction, path success
                Arguments.of(true, null, true),
                Arguments.of(true, Direction.INCREASING, true),
                Arguments.of(true, Direction.DECREASING, true),
                Arguments.of(false, null, false),
                Arguments.of(false, Direction.INCREASING, true),
                Arguments.of(false, Direction.DECREASING, false)
            )
        }
    }
}
