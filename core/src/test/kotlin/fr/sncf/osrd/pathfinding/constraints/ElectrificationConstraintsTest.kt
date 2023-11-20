package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import java.util.stream.Stream

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElectrificationConstraintsTest {
    private var electrificationConstraints: ElectrificationConstraints? = null
    private var chunk0Length: Distance = 0.meters

    @BeforeAll
    fun setUp() {
        val infra = Helpers.smallInfra
        electrificationConstraints = ElectrificationConstraints(
            infra.blockInfra, infra.rawInfra,
            listOf(TestTrains.FAST_ELECTRIC_TRAIN)
        )
        chunk0Length = infra.rawInfra.getTrackChunkLength(TrackChunkId(0U)).distance
    }

    @ParameterizedTest
    @MethodSource("testDeadSectionArgs")
    fun testDeadSectionAndCatenaryBlockedRanges(
        blockId: BlockId,
        expectedBlockedRanges: Collection<Pathfinding.Range>
    ) {
        val blockedRanges = electrificationConstraints!!.apply(blockId)
        AssertionsForClassTypes.assertThat(blockedRanges).isEqualTo(expectedBlockedRanges)
    }

    fun testDeadSectionArgs(): Stream<Arguments> {
        return Stream.of( // No corresponding catenary ranges without dead sections
            Arguments.of(
                0,
                mutableSetOf(Pathfinding.Range(0.meters, chunk0Length))
            ),  // Partially corresponding catenary ranges with dead section
            Arguments.of(
                1,
                mutableSetOf(Pathfinding.Range(0.meters, 30.meters))
            ),  // Fully corresponding catenary ranges without dead sections
            Arguments.of(2, HashSet<Any>())
        )
    }
}
