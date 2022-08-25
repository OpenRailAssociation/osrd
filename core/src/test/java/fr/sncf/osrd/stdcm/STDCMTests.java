package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.infra.InfraHelpers.makeSingleTrackRJSInfra;
import static fr.sncf.osrd.train.TestTrains.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.stdcm.STDCM;
import fr.sncf.osrd.api.stdcm.STDCMConfig;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Set;

public class STDCMTests {
    /** Look for a path in an empty timetable */
    @Test
    public void emptyTimetable() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var res = STDCM.run(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                List.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                List.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                List.of()
        );
        assertNotNull(res);
    }

    /** Look for a path where the routes are occupied before and after */
    @Test
    public void betweenTrains() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var res = STDCM.run(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                List.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                List.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                List.of(
                        new STDCMEndpoint.RouteOccupancy("a->b", 0, 50),
                        new STDCMEndpoint.RouteOccupancy("a->b", 1000, Double.POSITIVE_INFINITY),
                        new STDCMEndpoint.RouteOccupancy("b->c", 0, 50),
                        new STDCMEndpoint.RouteOccupancy("b->c", 1000, Double.POSITIVE_INFINITY)
                )
        );
        assertNotNull(res);
    }

    /** Test that no path is found when the routes aren't connected */
    @Test
    public void disconnectedRoutes() {
        /*
        a --> b

        x --> y
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("x", "y");
        var infra = infraBuilder.build();
        var res = STDCM.run(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                List.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                List.of(new Pathfinding.EdgeLocation<>(secondRoute, 0)),
                List.of()
        );
        assertNull(res);
    }

    /** Test that no path is found if the first route is free for a very short interval */
    @Test
    public void impossiblePath() {
        /*
        a --> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var res = STDCM.run(
                infra,
                REALISTIC_FAST_TRAIN,
                100,
                0,
                List.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                List.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                List.of(
                        new STDCMEndpoint.RouteOccupancy("a->b", 0, 99),
                        new STDCMEndpoint.RouteOccupancy("a->b", 101, Double.POSITIVE_INFINITY),
                        new STDCMEndpoint.RouteOccupancy("b->c", 0, 50),
                        new STDCMEndpoint.RouteOccupancy("b->c", 1000, Double.POSITIVE_INFINITY)
                )
        );
        assertNull(res);
    }

    /** Test that we can find a path even if the last route is occupied when the train starts */
    @Test
    public void lastRouteOccupiedAtStart() {
        /*
        a ------> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1000);
        var secondRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var res = STDCM.run(
                infra,
                REALISTIC_FAST_TRAIN,
                0,
                0,
                List.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)),
                List.of(new Pathfinding.EdgeLocation<>(secondRoute, 50)),
                List.of(
                        new STDCMEndpoint.RouteOccupancy("b->c", 0, 300)
                )
        );
        assertNotNull(res);
    }

    /** Tests that an occupied route can cause delays */
    @Test
    public void intermediateRouteCausingDelays() {
        /*
        a --> b --> c --> d
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b");
        infraBuilder.addRoute("b", "c");
        var lastRoute = infraBuilder.addRoute("c", "d");
        var infra = infraBuilder.build();
        var config = new STDCMConfig(REALISTIC_FAST_TRAIN, 0, 0, 0.,
                Set.of(firstRoute), Set.of(lastRoute));
        var res = STDCM.run(
                infra,
                List.of(
                        new STDCMEndpoint.RouteOccupancy("b->c", 0, 1000)
                ),
                config
        );
        assertNotNull(res);
        assert res.get(res.size() - 1).reservationEndTime >= 1000;
    }

    /** Test that the path can change depending on the occupancy */
    @Test
    public void testAvoidBlockedRoutes() {
        /*
                 c1
                ^  \
               /    v
        a --> b     d --> e
               \    ^
                v  /
                 c2

        We occupy either side and check that the path goes through the other one
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        infraBuilder.addRoute("a", "b");
        infraBuilder.addRoute("b", "c1");
        infraBuilder.addRoute("b", "c2");
        infraBuilder.addRoute("c1", "d");
        infraBuilder.addRoute("c2", "d");
        infraBuilder.addRoute("d", "e");
        var infra = infraBuilder.build();

        var firstRoute = infra.findSignalingRoute("a->b", "BAL3");
        var lastRoute = infra.findSignalingRoute("d->e", "BAL3");
        var config = new STDCMConfig(REALISTIC_FAST_TRAIN, 0, 0, 0.,
                Set.of(firstRoute), Set.of(lastRoute));

        var res1 = STDCM.run(
                infra,
                List.of(new STDCMEndpoint.RouteOccupancy("b->c1", 0, Double.POSITIVE_INFINITY)),
                config
        );
        var res2 = STDCM.run(
                infra,
                List.of(new STDCMEndpoint.RouteOccupancy("b->c2", 0, Double.POSITIVE_INFINITY)),
                config
        );
        assertNotNull(res1);
        assertNotNull(res2);
        var routes1 = res1.stream().map(block -> block.block.route.getInfraRoute().getID()).toList();
        var routes2 = res2.stream().map(block -> block.block.route.getInfraRoute().getID()).toList();

        assertFalse(routes1.contains("b->c1"));
        assertTrue(routes1.contains("b->c2"));

        assertFalse(routes2.contains("b->c2"));
        assertTrue(routes2.contains("b->c1"));
    }

    /** Test that a longer rolling stock needs a longer opening */
    @Test
    public void differentSizeRollingStock() {
        /*
        a -> b --> c
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1);
        var lastRoute = infraBuilder.addRoute("b", "c");
        var infra = infraBuilder.build();
        var configShortRollingStock = new STDCMConfig(VERY_SHORT_FAST_TRAIN, 0, 0, 0.,
                Set.of(firstRoute), Set.of(lastRoute));
        var configLongRollingStock = new STDCMConfig(VERY_LONG_FAST_TRAIN, 0, 0, 0.,
                Set.of(firstRoute), Set.of(lastRoute));
        var occupancy = List.of(
                new STDCMEndpoint.RouteOccupancy("a->b", 100, Double.POSITIVE_INFINITY)
        );
        var resShortRollingStock = STDCM.run(
                infra,
                occupancy,
                configShortRollingStock
        );
        var resLongRollingStock = STDCM.run(
                infra,
                occupancy,
                configLongRollingStock
        );
        assertNotNull(resShortRollingStock);
        assertNull(resLongRollingStock);
    }
}
