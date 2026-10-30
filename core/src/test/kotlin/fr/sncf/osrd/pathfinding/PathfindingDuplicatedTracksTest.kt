package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.pathfinding.ProcessedPathfindingResponse
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import kotlin.test.assertEquals
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingDuplicatedTracksTest {
    @ParameterizedTest
    @MethodSource("pathfindingTestScenarios")
    fun duplicatedTracksTest(
        trainPath: TrainPath,
        waypointOffsets: List<Offset<PhysicsPath>>,
        backtrackIndexes: List<Int>,
        hasDuplicateTracks: Boolean,
    ) {
        val pathfindingResult =
            ProcessedPathfindingResponse(trainPath, waypointOffsets, backtrackIndexes)
        assertEquals(pathfindingResult.hasDuplicateTracks(), hasDuplicateTracks)
    }

    private fun pathfindingTestScenarios(): Stream<Arguments> {
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1")
        val block10 = infra.addBlock("1", "0")

        return Stream.of(
            // 1. Success without backtracking without duplicate track sections.
            Arguments.of(
                buildTrainPathFromBlocks(infra, infra, listOf(block01, block10), listOf()),
                listOf<Offset<PhysicsPath>>(Offset.zero(), Offset(100.meters), Offset(200.meters)),
                listOf<Int>(),
                false,
            ),
            // 2. Failure without backtracking with duplicate track sections.
            Arguments.of(
                buildTrainPathFromBlocks(infra, infra, listOf(block01, block10, block01), listOf()),
                listOf<Offset<PhysicsPath>>(Offset.zero(), Offset(100.meters), Offset(200.meters)),
                listOf<Int>(),
                true,
            ),
            // 3. Success with backtracking without duplicate track sections.
            Arguments.of(
                buildTrainPathFromBlocks(infra, infra, listOf(block01, block10, block01), listOf()),
                listOf<Offset<PhysicsPath>>(Offset.zero(), Offset(100.meters), Offset(300.meters)),
                listOf(1),
                false,
            ),
            // 4. Failure with backtracking with duplicate track sections in second sub-path.
            Arguments.of(
                buildTrainPathFromBlocks(
                    infra,
                    infra,
                    listOf(block01, block10, block01, block10),
                    listOf(),
                ),
                listOf<Offset<PhysicsPath>>(Offset.zero(), Offset(100.meters), Offset(400.meters)),
                listOf(1),
                true,
            ),
        )
    }
}
