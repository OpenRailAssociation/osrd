package fr.sncf.osrd.pathfinding.constraints

import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.assertj.core.api.Assertions
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SignalingSystemConstraintsTest {

    @Disabled("See #6903")
    @ParameterizedTest
    @MethodSource("testSignalingSystemArgs")
    fun testSignalingSystemBlockedRanges(
        blockId: BlockId,
        rollingStock: RollingStock,
        expectedBlockedRanges: Collection<Pathfinding.Range<Block>>,
    ) {
        /*

        a --> b --> c

         */

        val infra = DummyInfra()
        infra.addBlock("a", "b", signalingSystemName = "BAL")
        infra.addBlock("b", "c", signalingSystemName = "TVM430")
        val fullInfra = infra.fullInfra()
        val signalingSystemConstraints =
            makeSignalingSystemConstraints(
                fullInfra.blockInfra,
                fullInfra.signalingSimulator,
                listOf(rollingStock),
            )
        val blockedRanges = signalingSystemConstraints.apply(blockId)
        Assertions.assertThat(blockedRanges).isEqualTo(expectedBlockedRanges)
    }

    private fun testSignalingSystemArgs(): Stream<Arguments> {
        return Stream.of(
            Arguments.of(0, TestTrains.TRAIN_WITHOUT_TVM, HashSet<Any>()),
            Arguments.of(
                1,
                TestTrains.TRAIN_WITHOUT_TVM,
                setOf(Pathfinding.Range<TrackChunk>(Offset(0.meters), Offset(100.meters))),
            ),
            Arguments.of(0, TestTrains.FAST_ELECTRIC_TRAIN, HashSet<Any>()),
            Arguments.of(1, TestTrains.FAST_ELECTRIC_TRAIN, HashSet<Any>()),
        )
    }
}
