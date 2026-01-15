package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetRange
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TrackSectionConstraintsTest {

    private var trackSectionConstraints: TrackSectionConstraints? = null

    private var ta0Chunk0Length: Offset<Block> = Offset(0.meters)
    private var ta0Chunk0block: BlockId? = null
    private var ta0Chunk1block: BlockId? = null
    private var ta1Chunk0block: BlockId? = null

    @BeforeAll
    fun setUp() {
        val infra = Helpers.smallInfra
        val trackSectionName =
            hashSetOf(
                "TA1",
                "TA2",
                "TA3",
                "TA4",
                "TA5",
                "TA6",
                "TA7",
                "TG0",
                "TG1",
                "TG2",
                "TG3",
                "TG4",
                "TG5",
                "TH0",
                "TH1",
                "TE1",
                "TE2",
                "TE3",
                "TD0",
                "TD1",
                "TD2",
                "TD3",
            )
        val trackSectionIds =
            trackSectionName.mapNotNull { infra.rawInfra.getTrackSectionFromName(it) }.toSet()
        trackSectionConstraints =
            TrackSectionConstraints(infra.blockInfra, infra.rawInfra, trackSectionIds)
        val ta0 = infra.rawInfra.getTrackSectionFromName("TA0")!!
        val ta0Chunks = infra.rawInfra.getTrackSectionChunks(ta0)
        assert(ta0Chunks.size == 2)
        val ta0Chunk0 =
            if (infra.rawInfra.getTrackChunkOffset(ta0Chunks[0]) <= Offset(0.meters)) ta0Chunks[0]
            else ta0Chunks[1]
        val ta0Chunk1 =
            if (infra.rawInfra.getTrackChunkOffset(ta0Chunks[0]) <= Offset(0.meters)) ta0Chunks[1]
            else ta0Chunks[0]
        ta0Chunk0Length = infra.rawInfra.getTrackChunkLength(ta0Chunk0).cast()
        ta0Chunk0block =
            infra.blockInfra.getBlocksFromTrackChunk(ta0Chunk0, Direction.INCREASING).getAtIndex(0)
        ta0Chunk1block =
            infra.blockInfra.getBlocksFromTrackChunk(ta0Chunk1, Direction.INCREASING).getAtIndex(0)
        val ta1 = infra.rawInfra.getTrackSectionFromName("TA1")!!
        val ta1Chunks = infra.rawInfra.getTrackSectionChunks(ta1)
        val ta1Chunk0 = ta1Chunks[0]
        ta1Chunk0block =
            infra.blockInfra.getBlocksFromTrackChunk(ta1Chunk0, Direction.INCREASING).getAtIndex(0)
    }

    @ParameterizedTest
    @MethodSource("testZonesArgs")
    fun testRestrictedTrackSectionBlockedRanges(
        blockId: BlockId,
        expectedBlockedRanges: Collection<OffsetRange<Block>>,
    ) {
        val blockedRanges = trackSectionConstraints!!.apply(blockId)
        Assertions.assertThat(blockedRanges).isEqualTo(expectedBlockedRanges)
    }

    private fun testZonesArgs(): Stream<Arguments> {
        return Stream.of(
            Arguments.of(
                ta0Chunk0block!!.index.toInt(),
                setOf(OffsetRange(Offset(0.meters), ta0Chunk0Length)),
            ),
            Arguments.of(
                ta0Chunk1block!!.index.toInt(),
                setOf(OffsetRange<Block>(Offset(0.meters), Offset(180.meters))),
            ),
            Arguments.of(ta1Chunk0block!!.index.toInt(), HashSet<Any>()),
        )
    }
}
