package fr.sncf.osrd.pathfinding

import com.google.common.collect.Iterables
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockLocation
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class RemainingDistanceEstimatorTest {
    private var smallInfra: FullInfra? = null
    private var block: BlockId? = null
    private var path: TrainPath? = null

    @BeforeAll
    fun setUp() {
        smallInfra = Helpers.smallInfra
        block = Helpers.getBlocksOnRoutes(smallInfra!!, listOf("rt.DA2->DA5"))[0]
        path =
            buildTrainPathFromBlock(
                smallInfra!!.rawInfra,
                smallInfra!!.blockInfra,
                block!!,
                listOf(),
            )
    }

    @ParameterizedTest
    @MethodSource("testRemainingDistanceEstimatorArgs")
    fun testRemainingDistanceEstimator(
        edgeLocations: Collection<BlockLocation>,
        remainingDistance: Distance,
        expectedDistance: Distance,
        blockOffset: Offset<Block>,
    ) {
        val estimator =
            RemainingDistanceEstimator(
                smallInfra!!.blockInfra,
                smallInfra!!.rawInfra,
                edgeLocations,
                remainingDistance,
            )
        Assertions.assertEquals(
            expectedDistance,
            estimator.apply(BlockLocation(block!!, blockOffset)).meters,
        )
    }

    @SuppressFBWarnings(
        value = ["UPM_UNCALLED_PRIVATE_METHOD"],
        justification = "called implicitly by MethodSource",
    )
    private fun testRemainingDistanceEstimatorArgs(): Stream<Arguments> {
        val points = path!!.getGeo().getPoints()
        val pathLengthBlockOffset: Offset<Block> = path!!.getLength().cast()
        return Stream.of( // Test same point
            Arguments.of(
                listOf(BlockLocation(block!!, Offset(0.meters))),
                0,
                0,
                0,
            ), // Test same point with non-null remaining distance
            Arguments.of(
                listOf(BlockLocation(block!!, Offset(0.meters))),
                10,
                10,
                0,
            ), // Test with target at the end of the edge
            Arguments.of(
                listOf(BlockLocation(block!!, pathLengthBlockOffset)),
                0,
                fromMeters(points[0].distanceAsMeters(Iterables.getLast(points))).millimeters,
                0,
            ), // Test multiple targets
            Arguments.of(
                listOf(
                    BlockLocation(block!!, Offset(0.meters)),
                    BlockLocation(block!!, pathLengthBlockOffset),
                ),
                0,
                0,
                0,
            ), // Test with an offset on the block
            Arguments.of(
                listOf(BlockLocation(block!!, pathLengthBlockOffset)),
                0,
                0,
                pathLengthBlockOffset.distance.millimeters,
            ),
        )
    }
}
