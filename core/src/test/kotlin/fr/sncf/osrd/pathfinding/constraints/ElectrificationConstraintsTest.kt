package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElectrificationConstraintsTest {
    private var electrificationConstraints: ElectrificationConstraints? = null
    private var chunk0Length: Offset<TrackChunk> = Offset(0.meters)

    @BeforeAll
    fun setUp() {
        val infra = Helpers.smallInfra
        electrificationConstraints =
            ElectrificationConstraints(
                infra.blockInfra,
                infra.rawInfra,
                TestTrains.FAST_ELECTRIC_TRAIN.modeNames,
            )
        chunk0Length = infra.rawInfra.getTrackChunkLength(TrackChunkId(0U))
    }

    @ParameterizedTest
    @MethodSource("testDeadSectionArgs")
    fun testDeadSectionAndElectrificationBlockedRanges(
        blockId: BlockId,
        expectedBlockedRanges: Collection<Pathfinding.Range<Block>>,
    ) {
        val blockedRanges = electrificationConstraints!!.apply(blockId)
        AssertionsForClassTypes.assertThat(blockedRanges).isEqualTo(expectedBlockedRanges)
    }

    fun testDeadSectionArgs(): Stream<Arguments> {
        return Stream.of( // No corresponding electrification ranges without dead sections
            Arguments.of(
                0,
                mutableSetOf(Pathfinding.Range(Offset(0.meters), chunk0Length)),
            ), // Partially corresponding electrification ranges with dead
            // section
            Arguments.of(
                1,
                mutableSetOf(Pathfinding.Range(Offset<Block>(0.meters), Offset(140.meters))),
            ), // Fully corresponding electrification ranges without dead
            // sections
            Arguments.of(2, HashSet<Any>()),
        )
    }
}
