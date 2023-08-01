package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.Helpers.getBlocksOnRoutes;
import static fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.Iterables;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.Collection;
import java.util.List;
import java.util.stream.Stream;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class RemainingDistanceEstimatorTest {

    private FullInfra smallInfra;
    private int block;
    private Path path;

    @BeforeAll
    public void setUp() {
        smallInfra = Helpers.getSmallInfra();
        block = getBlocksOnRoutes(smallInfra, List.of(
                "rt.DA2->DA6_1"
        )).get(0);
        path = makePath(smallInfra.blockInfra(), smallInfra.rawInfra(), block);
    }

    @ParameterizedTest
    @MethodSource("testRemainingDistanceEstimatorArgs")
    public void testRemainingDistanceEstimator(
            Collection<Pathfinding.EdgeLocation<Integer>> edgeLocations,
            double remainingDistance,
            double expectedDistance,
            double blockOffset
    ) {
        var estimator = new RemainingDistanceEstimator(smallInfra.blockInfra(), smallInfra.rawInfra(), edgeLocations,
                remainingDistance);
        assertEquals(expectedDistance, estimator.apply(block, blockOffset));
    }

    @SuppressFBWarnings(value = "UPM_UNCALLED_PRIVATE_METHOD", justification = "called implicitly by MethodSource")
    private Stream<Arguments> testRemainingDistanceEstimatorArgs() {
        var points = path.getGeo().getPoints();
        return Stream.of(
                // Test same point
                Arguments.of(
                        List.of(new Pathfinding.EdgeLocation<>(block, 0)),
                        0,
                        0,
                        0
                ),
                // Test same point with non-null remaining distance
                Arguments.of(
                        List.of(new Pathfinding.EdgeLocation<>(block, 0)),
                        10,
                        10,
                        0
                ),
                // Test with target at the end of the edge
                Arguments.of(
                        List.of(new Pathfinding.EdgeLocation<>(block, path.getLength())),
                        0,
                        points.get(0).distanceAsMeters(Iterables.getLast(points)),
                        0
                ),
                // Test multiple targets
                Arguments.of(
                        List.of(
                                new Pathfinding.EdgeLocation<>(block, 0),
                                new Pathfinding.EdgeLocation<>(block, path.getLength())
                        ),
                        0,
                        0,
                        0
                ),
                // Test with an offset on the block
                Arguments.of(
                        List.of(
                                new Pathfinding.EdgeLocation<>(block, path.getLength())
                        ),
                        0,
                        0,
                        path.getLength()
                )
        );
    }
}
