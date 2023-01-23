package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.stdcm.UnavailableSpaceBuilder.computeUnavailableSpace;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class UnavailableSpaceBuilderTests {
    @Test
    public void testNoOccupancy() throws Exception {
        var infra = Helpers.infraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var res = computeUnavailableSpace(infra, Set.of(), REALISTIC_FAST_TRAIN, 0, 0);
        assertTrue(res.isEmpty());
    }

    @Test
    public void testFirstRouteOccupied() {
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        var secondRoute = infraBuilder.addRoute("b", "c", 1000);
        var infra = infraBuilder.build();
        var res = computeUnavailableSpace(
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a->b", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        new OccupancyBlock(0, 100, 0, 1000) // base occupancy
                ),
                res.get(firstRoute)
        );
        assertEquals(
                Set.of(
                        // If the train is in this area, the previous route would be "yellow", causing a conflict
                        new OccupancyBlock(0, 100, 0, 1000)

                        // Margin added to the base occupancy to account for the train length,
                        // it can be removed if this test fails as it overlaps with the previous one
                        //new OccupancyBlock(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
                ),
                res.get(secondRoute)
        );
    }

    @Test
    public void testSecondRouteOccupied() {
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        var secondRoute = infraBuilder.addRoute("b", "c", 1000);
        var infra = infraBuilder.build();
        var res = computeUnavailableSpace(
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("b->c", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        // Entering this area would cause the train to see a signal that isn't green
                        new OccupancyBlock(0, 100, 1000 - 400, 1000)
                ),
                res.get(firstRoute)
        );
        assertEquals(
                Set.of(
                        new OccupancyBlock(0, 100, 0, 1000) // base occupancy
                ),
                res.get(secondRoute)
        );
    }

    @Test
    public void testBranchingRoutes() {
        /*
        a1        b1
           \      ^
            v    /
            center
            ^    \
           /      v
         a2       b2
         */
        final var infraBuilder = new DummyRouteGraphBuilder();
        final var a1 = infraBuilder.addRoute("a1", "center", 1000);
        final var a2 = infraBuilder.addRoute("a2", "center", 1000);
        final var b1 = infraBuilder.addRoute("center", "b1", 1000);
        final var b2 = infraBuilder.addRoute("center", "b2", 1000);
        final var infra = infraBuilder.build();
        final var res = computeUnavailableSpace(
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a1->center", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        new OccupancyBlock(0, 100, 0, 1000) // base occupancy
                ),
                res.get(a1)
        );
        assertEquals(
                Set.of(),
                res.get(a2)
        );
        assertEquals(
                Set.of(
                        // If the train is in this area, the previous route would be "yellow", causing a conflict
                        new OccupancyBlock(0, 100, 0, 1000)

                        // Margin added to the base occupancy to account for the train length,
                        // it can be removed if this test fails as it overlaps with the previous one
                        // new OccupancyBlock(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
                ),
                res.get(b1)
        );
        assertEquals(res.get(b1), res.get(b2));
    }

    @Test
    public void testThirdRoute() {
        var infraBuilder = new DummyRouteGraphBuilder();
        infraBuilder.addRoute("a", "b", 1000);
        infraBuilder.addRoute("b", "c", 1000);
        var thirdRoute = infraBuilder.addRoute("c", "d", 1000);
        var infra = infraBuilder.build();
        var res = computeUnavailableSpace(
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a->b", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        // The second route can't be occupied in that time because it would cause a "yellow" state
                        // in the first one (conflict), and this accounts for the extra margin needed in the third
                        // route caused by the train length
                        new OccupancyBlock(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
                ),
                res.get(thirdRoute)
        );
    }

    @Test
    public void testGridMargins() {
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        var secondRoute = infraBuilder.addRoute("b", "c", 1000);
        var infra = infraBuilder.build();
        var res = computeUnavailableSpace(
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a->b", 100, 200)),
                REALISTIC_FAST_TRAIN,
                20,
                60
        );
        // TimeStart and TimeEnd should be adjusted because of the margins
        // (20s before and 60s after)
        assertEquals(
                Set.of(
                        new OccupancyBlock(80, 260, 0, 1000)
                ),
                res.get(firstRoute)
        );
        assertEquals(
                Set.of(
                        new OccupancyBlock(80, 260, 0, 1000)
                ),
                res.get(secondRoute)
        );
    }
}
