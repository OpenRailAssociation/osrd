package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.io.IOException
import java.net.URISyntaxException
import java.util.stream.Stream
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LoadingGaugeConstraintsTest {
    private var loadingGaugeConstraints: LoadingGaugeConstraints? = null
    private var ta0Chunk0Length: Length<TrackChunk> = Length(0.meters)
    private var ta0Chunk0block: BlockId? = null
    private var ta0Chunk1block: BlockId? = null
    private var ta1Chunk0block: BlockId? = null

    @BeforeAll
    @Throws(IOException::class, URISyntaxException::class)
    fun setUp() {
        val rjsInfra =
            Helpers.getExampleInfra("small_infra/infra.json") // TA0 has gauge constraints
        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        loadingGaugeConstraints =
            LoadingGaugeConstraints(
                infra.blockInfra,
                infra.rawInfra,
                TestTrains.FAST_TRAIN_LARGE_GAUGE.loadingGaugeType,
            )
        val ta0 = infra.rawInfra.getTrackSectionFromName("TA0")!!
        val ta0Chunks = infra.rawInfra.getTrackSectionChunks(ta0)
        assert(ta0Chunks.size == 2)
        val ta0Chunk0 =
            if (infra.rawInfra.getTrackChunkOffset(ta0Chunks[0]) <= Offset(0.meters)) ta0Chunks[0]
            else ta0Chunks[1]
        val ta0Chunk1 =
            if (infra.rawInfra.getTrackChunkOffset(ta0Chunks[0]) <= Offset(0.meters)) ta0Chunks[1]
            else ta0Chunks[0]
        ta0Chunk0Length = infra.rawInfra.getTrackChunkLength(ta0Chunk0)
        ta0Chunk0block =
            infra.blockInfra.getBlocksFromTrackChunk(ta0Chunk0, Direction.INCREASING).getAtIndex(0)
        ta0Chunk1block =
            infra.blockInfra.getBlocksFromTrackChunk(ta0Chunk1, Direction.INCREASING).getAtIndex(0)
        val ta1 = infra.rawInfra.getTrackSectionFromName("TA1")!!
        val ta1Chunks = infra.rawInfra.getTrackSectionChunks(ta1)
        assert(ta1Chunks.size > 0)
        val ta1Chunk0 = ta1Chunks[0]
        ta1Chunk0block =
            infra.blockInfra.getBlocksFromTrackChunk(ta1Chunk0, Direction.INCREASING).getAtIndex(0)
    }

    @ParameterizedTest
    @MethodSource("testLoadingGaugeArgs")
    fun testLoadingGaugeBlockedRanges(
        blockId: BlockId,
        expectedBlockedRanges: Collection<Pathfinding.Range<Block>>,
    ) {
        val blockedRanges = loadingGaugeConstraints!!.apply(blockId)
        Assertions.assertThat(blockedRanges).isEqualTo(expectedBlockedRanges)
    }

    private fun testLoadingGaugeArgs(): Stream<Arguments> {
        // Loading gauge constraints are partially applied to track section TA0 (chunk 0 and 1 here)
        //                   chunks: [               0              ][       1         ]
        //                      TA0: [0 -- 100 -- 200 ---- 1500 -- 1820 -- 1900 -- 2000]
        // gauge constraints:   GB1: [------------ ]
        //                       G1:               [------------------------]
        //                    FR3.3:        [---------------]

        return Stream.of(
            Arguments.of(
                ta0Chunk0block!!.index.toInt(),
                setOf(
                    Pathfinding.Range(Length(0.meters), Length(100.meters)),
                    Pathfinding.Range(Length(100.meters), Length(200.meters)),
                    Pathfinding.Range(Length(200.meters), Length(1500.meters)),
                    Pathfinding.Range(Length(1500.meters), ta0Chunk0Length),
                ),
            ), // Different loading gauge constraints applied to all block
            Arguments.of(
                ta0Chunk1block!!.index.toInt(),
                setOf(Pathfinding.Range(Length<TrackChunk>(0.meters), Length(80.meters))),
            ), // Loading gauge constraints partially applied to block
            Arguments.of(
                ta1Chunk0block!!.index.toInt(),
                HashSet<Any>(),
            ), // No loading gauge constraints on TA1
        )
    }
}
