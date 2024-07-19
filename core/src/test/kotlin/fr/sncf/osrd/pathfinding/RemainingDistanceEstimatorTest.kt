package fr.sncf.osrd.pathfinding

import com.google.common.collect.Iterables
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator
import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.PathProperties
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
    private var path: PathProperties? = null

    @BeforeAll
    fun setUp() {
        smallInfra = Helpers.smallInfra
        block = Helpers.getBlocksOnRoutes(smallInfra!!, listOf("rt.DA2->DA5"))[0]
        path = makePathProps(smallInfra!!.blockInfra, smallInfra!!.rawInfra, block!!)
    }

    @ParameterizedTest
    @MethodSource("testRemainingDistanceEstimatorArgs")
    fun testRemainingDistanceEstimator(
        edgeLocations: Collection<PathfindingEdgeLocationId<Block>>,
        remainingDistance: Distance,
        expectedDistance: Distance,
        blockOffset: Offset<Block>
    ) {
        val estimator =
            RemainingDistanceEstimator(
                smallInfra!!.blockInfra,
                smallInfra!!.rawInfra,
                edgeLocations,
                remainingDistance
            )
        Assertions.assertEquals(expectedDistance, estimator.apply(block!!, blockOffset))
    }

    @SuppressFBWarnings(
        value = ["UPM_UNCALLED_PRIVATE_METHOD"],
        justification = "called implicitly by MethodSource"
    )
    private fun testRemainingDistanceEstimatorArgs(): Stream<Arguments> {
        val points = path!!.getGeo().points
        return Stream.of( // Test same point
            Arguments.of(
                listOf(EdgeLocation(block, Offset<Block>(0.meters))),
                0,
                0,
                0
            ), // Test same point with non-null remaining distance
            Arguments.of(
                listOf(EdgeLocation(block, Offset<Block>(0.meters))),
                10,
                10,
                0
            ), // Test with target at the end of the edge
            Arguments.of(
                listOf(EdgeLocation(block, Offset<Path>(path!!.getLength()))),
                0,
                fromMeters(points[0].distanceAsMeters(Iterables.getLast(points))).millimeters,
                0
            ), // Test multiple targets
            Arguments.of(
                listOf(
                    EdgeLocation(block, Offset(0.meters)),
                    EdgeLocation(block, Offset<Path>(path!!.getLength()))
                ),
                0,
                0,
                0
            ), // Test with an offset on the block
            Arguments.of(
                listOf(EdgeLocation(block, Offset<Path>(path!!.getLength()))),
                0,
                0,
                path!!.getLength().millimeters
            )
        )
    }
}
