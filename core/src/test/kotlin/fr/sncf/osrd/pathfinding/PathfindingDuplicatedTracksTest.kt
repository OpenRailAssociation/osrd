package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.hasDuplicateTracks
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
        hasDuplicateTracks: Boolean,
    ) {
        assertEquals(hasDuplicateTracks, trainPath.hasDuplicateTracks())
    }

    private fun pathfindingTestScenarios(): Stream<Arguments> {
        val infra = DummyInfra()
        val block01 = infra.addBlock("0", "1")
        val block10 = infra.addBlock("1", "0")

        return Stream.of(
            // 1. Success without backtracking without duplicate track sections.
            Arguments.of(
                buildTrainPathFromBlocks(infra, infra, listOf(block01, block10), listOf()),
                false,
            ),
            // 2. Failure without backtracking with duplicate track sections.
            Arguments.of(
                buildTrainPathFromBlocks(infra, infra, listOf(block01, block10, block01), listOf()),
                true,
            ),
            // 3. Success with backtracking without duplicate track sections.
            Arguments.of(
                buildTrainPathFromBlocks(
                    infra,
                    infra,
                    listOf(block01, block10, block01),
                    listOf(Offset(100.meters)),
                ),
                false,
            ),
            // 4. Failure with backtracking with duplicate track sections in second sub-path.
            Arguments.of(
                buildTrainPathFromBlocks(
                    infra,
                    infra,
                    listOf(block01, block10, block01, block10),
                    listOf(Offset(100.meters)),
                ),
                true,
            ),
        )
    }
}
