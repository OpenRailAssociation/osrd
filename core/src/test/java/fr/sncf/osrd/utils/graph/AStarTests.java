package fr.sncf.osrd.utils.graph;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.Sets;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator;
import org.junit.jupiter.api.Test;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class AStarTests {

    /** We try to find a path from a point on the center-west of the infra to the east most point.
     * The path is almost a geographic line, so a good heuristic should help. We run the pathfinding
     * with and without a heuristic and ensure that we visit more blocks without heuristic.
     */
    @Test
    public void lessBlocksVisitedWithHeuristic() throws Exception {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("small_infra/infra.json"));
        var origin = Set.of(Helpers.convertRouteLocation(infra, "rt.DA2->DA5", 0));
        var destination = Set.of(Helpers.convertRouteLocation(infra, "rt.DH2->buffer_stop.7", 0));
        var remainingDistanceEstimator = new RemainingDistanceEstimator(infra.blockInfra(), infra.rawInfra(),
                destination, 0.);
        var seenWithHeuristic = new HashSet<Integer>();
        var seenWithoutHeuristic = new HashSet<Integer>();
        new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(blockId -> infra.blockInfra().getBlockLength(blockId))
                .setRemainingDistanceEstimator(List.of((block, offset) -> {
                    seenWithHeuristic.add(block);
                    return remainingDistanceEstimator.apply(block, offset);
                }))
                .runPathfinding(List.of(origin, destination));
        new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(blockId -> infra.blockInfra().getBlockLength(blockId))
                .setRemainingDistanceEstimator(List.of((block, offset) -> {
                    seenWithoutHeuristic.add(block);
                    return 0.;
                }))
                .runPathfinding(List.of(origin, destination));
        assertTrue(seenWithHeuristic.size() < seenWithoutHeuristic.size());
    }
}
