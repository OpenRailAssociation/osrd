package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.google.common.collect.HashMultimap;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.new_pipeline.STDCMPathfinding;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class STDCMPathfindingTests {
    @Test
    public void simpleTest() throws Exception {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var waypointStart = new PathfindingWaypoint(
                "ne.micro.foo_b",
                100,
                EdgeDirection.START_TO_STOP
        );
        var waypointEnd = new PathfindingWaypoint(
                "ne.micro.bar_a",
                100,
                EdgeDirection.START_TO_STOP
        );
        var res = STDCMPathfinding.findPath(
                infra,
                HashMultimap.create(),
                REALISTIC_FAST_TRAIN,
                Set.of(waypointStart),
                Set.of(waypointEnd)
        );
        assertNotNull(res);
    }
}
