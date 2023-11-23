package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import java.io.IOException
import java.net.URISyntaxException
import java.util.function.Consumer
import java.util.stream.Stream

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LoadingGaugeConstraintsTest {
    private var loadingGaugeConstraints: LoadingGaugeConstraints? = null
    private var chunk0Length: Length<TrackChunk> = Length(0.meters)
    private var chunk1Length: Length<TrackChunk> = Length(0.meters)

    @BeforeAll
    @Throws(IOException::class, URISyntaxException::class)
    fun setUp() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.trackSections.forEach(Consumer { trackSection: RJSTrackSection ->
            if (trackSection.id == "TA0") {
                trackSection.loadingGaugeLimits =
                    listOf(RJSLoadingGaugeLimit(0.0, trackSection.length, RJSLoadingGaugeType.G1))
            }
        })
        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        loadingGaugeConstraints = LoadingGaugeConstraints(
            infra.blockInfra, infra.rawInfra,
            listOf(TestTrains.FAST_TRAIN_LARGE_GAUGE)
        )
        chunk0Length = infra.rawInfra.getTrackChunkLength(TrackChunkId(0U))
        chunk1Length = infra.rawInfra.getTrackChunkLength(TrackChunkId(1U))
    }

    @ParameterizedTest
    @MethodSource("testLoadingGaugeArgs")
    fun testLoadingGaugeBlockedRanges(blockId: BlockId, expectedBlockedRanges: Collection<Pathfinding.Range<Block>>) {
        val blockedRanges = loadingGaugeConstraints!!.apply(blockId)
        Assertions.assertThat(blockedRanges).isEqualTo(expectedBlockedRanges)
    }

    fun testLoadingGaugeArgs(): Stream<Arguments> {
        return Stream.of( // Loading gauge constraints partially applied to block
            Arguments.of(
                0,
                setOf(Pathfinding.Range(Offset(0.meters), chunk0Length))
            ),  // Loading gauge constraints fully applied to block
            Arguments.of(1, setOf(Pathfinding.Range(Offset(0.meters), chunk1Length))),  // No loading gauge constraints
            Arguments.of(2, HashSet<Any>())
        )
    }
}
