package fr.sncf.osrd.stdcm;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.api.stdcm.graph.STDCMSimulations;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;

public class EngineeringAllowanceTests {

    /** Test that we can add an engineering allowance to avoid an occupied section */
    @Test
    public void testSlowdown() {
        /*
        a --> b --> c --> d

        space
          ^
        d |######### end
          |######### /
        c |#########/
          |     __/
        b |  __/
          | /##################
        a |/_##################_> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 30);
        var secondRoute = infraBuilder.addRoute("b", "c", 10_000, 30);
        var thirdRoute = infraBuilder.addRoute("c", "d", 100, 30);
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert firstRouteEnvelope != null;
        var secondRouteEnvelope = STDCMSimulations.simulateRoute(secondRoute, firstRouteEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert secondRouteEnvelope != null;
        var timeThirdRouteFree = firstRouteEnvelope.getTotalTime() + secondRouteEnvelope.getTotalTime();
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(firstRouteEnvelope.getTotalTime() + 10, POSITIVE_INFINITY, 0, 1_000),
                thirdRoute, new OccupancyBlock(0, timeThirdRouteFree + 30, 0, 100)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertEquals(10, res.departureTime(), 2 * timeStep);
    }

    /** Test that we can add an engineering allowance over several routes to avoid an occupied section */
    @Test
    public void testSlowdownSeveralRoutes() {
        /*
        a --> b --> c --> d --> e --> f

        space
          ^
        f |##################### end
          |##################### /
        e |#####################/
          |                 __/
        d |              __/
          |           __/
        c |        __/
          |     __/
        b |  __/
          | /##################
        a |/_##################_> time

         */
        final var infraBuilder = new DummyRouteGraphBuilder();
        final var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 20);
        final var secondRoute = infraBuilder.addRoute("b", "c", 1_000, 20);
        infraBuilder.addRoute("c", "d", 1_000, 20);
        infraBuilder.addRoute("d", "e", 1_000, 20);
        var lastRoute = infraBuilder.addRoute("e", "f", 1_000, 20);
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert firstRouteEnvelope != null;
        var secondRouteEnvelope = STDCMSimulations.simulateRoute(secondRoute, firstRouteEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert secondRouteEnvelope != null;
        var timeLastRouteFree = firstRouteEnvelope.getTotalTime() + 120 + secondRouteEnvelope.getTotalTime() * 3;
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(firstRouteEnvelope.getTotalTime(), POSITIVE_INFINITY, 0, 1_000),
                lastRoute, new OccupancyBlock(0, timeLastRouteFree, 0, 1_000)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertEquals(0, res.departureTime(), 2 * timeStep);
    }

    /** Test that allowances don't cause new conflicts */
    @Test
    public void testSlowdownWithConflicts() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        f |##################### end
          |##################### /
        e |#####################/
          |             ______/
        d |       _____/ __/
          |     / ####__/######
        c |    /  #__/#########
          |   / __/
        b |  __/
          | /##################
        a |/_##################_> time

        A naive allowance extending until we reach the constraints on either side
        would cross the occupancy in the "d->d" route (rightmost curve).

        But another solution exists: keeping the allowance in the "d->e" route (leftmost curve)

         */
        final var infraBuilder = new DummyRouteGraphBuilder();
        final var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 20);
        final var secondRoute = infraBuilder.addRoute("b", "c", 1_000, 20);
        final var thirdRoute = infraBuilder.addRoute("c", "d", 1_000, 20);
        infraBuilder.addRoute("d", "e", 1_000, 20);
        var lastRoute = infraBuilder.addRoute("e", "f", 1_000, 20);
        var firstRouteEnvelope = STDCMSimulations.simulateRoute(firstRoute, 0, 0,
                REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert firstRouteEnvelope != null;
        var secondRouteEnvelope = STDCMSimulations.simulateRoute(secondRoute, firstRouteEnvelope.getEndSpeed(),
                0, REALISTIC_FAST_TRAIN, RollingStock.Comfort.STANDARD, 2., new double[]{}, null);
        assert secondRouteEnvelope != null;
        var timeLastRouteFree = firstRouteEnvelope.getTotalTime() + 120 + secondRouteEnvelope.getTotalTime() * 3;
        var timeThirdRouteOccupied = firstRouteEnvelope.getTotalTime() + 5 + secondRouteEnvelope.getTotalTime() * 2;
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(firstRouteEnvelope.getTotalTime(), POSITIVE_INFINITY, 0, 1_000),
                lastRoute, new OccupancyBlock(0, timeLastRouteFree, 0, 1_000),
                thirdRoute, new OccupancyBlock(timeThirdRouteOccupied, POSITIVE_INFINITY, 0, 1_000)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(lastRoute, 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertEquals(0, res.departureTime(), 2 * timeStep);
    }

    /** Test that we can add the max delay by shifting the departure time, then add more delay by slowing down */
    @Test
    public void testMaxDepartureTimeShift() {
        /*
        a --> b --> c --> d

        space
          ^
        d |###############
          |###############
        c |###############x end
          |            __/
        b |         __/
          |      __/
        a |_____/____________________> time
          |-----|
             ^
     max delay at departure time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 1_000, 30);
        var secondRoute = infraBuilder.addRoute("b", "c", 1_000, 30);
        var thirdRoute = infraBuilder.addRoute("c", "d", 1, 30);
        var lastRouteEntryTime = STDCMHelpers.getRoutesRunTime(List.of(firstRoute, secondRoute));
        var timeThirdRouteFree = lastRouteEntryTime + 3600 * 2 + 60;
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                thirdRoute, new OccupancyBlock(0, timeThirdRouteFree, 0, 1)
        );
        double timeStep = 2;
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(thirdRoute, 0)))
                .setUnavailableTimes(occupancyGraph)
                .setTimeStep(timeStep)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertEquals(3600 * 2, res.departureTime(), 2 * timeStep);
        assertTrue(res.departureTime() <= 3600 * 2);
    }

    /** The allowance happens in an area where we have added delay by shifting the departure time */
    @Test
    public void testAllowanceWithDepartureTimeShift() {
        /*
        a --> b --> c --> d --> e

        space
          ^
        e |##########################     ###### end
          |##########################     ######/__________
        d |#################### /              /
          |####################/_____     ____/____________
        c |############# /           [...]   /
          |#############/____________     __x______________
        b |#####  /                ##     #################
          |#####/                  ##     #################
        a start____________________##     #################_> time

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var firstRoute = infraBuilder.addRoute("a", "b", 2_000, 20);
        var secondRoute = infraBuilder.addRoute("b", "c", 2_000, 20);
        var thirdRoute = infraBuilder.addRoute("c", "d", 2_000, 20);
        var forthRoute = infraBuilder.addRoute("d", "e", 2_000, 20);
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                firstRoute, new OccupancyBlock(0, 600, 0, 100),
                firstRoute, new OccupancyBlock(2_000, POSITIVE_INFINITY, 0, 100),
                secondRoute, new OccupancyBlock(0, 1200, 0, 100),
                thirdRoute, new OccupancyBlock(0, 1800, 0, 100),
                forthRoute, new OccupancyBlock(0, 4_000, 0, 100)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(firstRoute, 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(forthRoute, 1)))
                .setUnavailableTimes(occupancyGraph)
                .run();
        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
    }

    /** Test that we return null with no crash when we can't slow down fast enough */
    @Test
    public void testImpossibleEngineeringAllowance() {
        /*
        a ------> b -> c -----> d

        space
          ^
        d |##################### end
          |#####################
        c |#########x###########
          |      __/
        b |   __/
          |  /#######################
        a |_/_#######################> time

        The second route is very short and not long enough to slow down

         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var routes = List.of(
                infraBuilder.addRoute("a", "b", 1_000),
                infraBuilder.addRoute("b", "c", 1),
                infraBuilder.addRoute("c", "d", 1_000)
        );
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                routes.get(0), new OccupancyBlock(300, POSITIVE_INFINITY, 0, 1_000),
                routes.get(2), new OccupancyBlock(0, 3600, 0, 1_000)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(2), 1_000)))
                .setUnavailableTimes(occupancyGraph)
                .setMaxDepartureDelay(POSITIVE_INFINITY)
                .run();

        assertNull(res);
    }

    /** Test that we return the fastest path even if there are some engineering allowances*/
    @Test
    public void testReturnTheFastestPathWithAllowance() {
        /*
        a --> b --> c --> d

        space
          ^
        d |#####################  /  end
          |##################### /   /
        c |#####################/   /
          |    ________________/   /
        b |   /                   /
          |  /################## /
        a |_/_##################/____> time
         */
        var infraBuilder = new DummyRouteGraphBuilder();
        var routes = List.of(
                infraBuilder.addRoute("a", "b"),
                infraBuilder.addRoute("b", "c"),
                infraBuilder.addRoute("c", "d")
        );
        var infra = infraBuilder.build();
        var occupancyGraph = ImmutableMultimap.of(
                routes.get(0), new OccupancyBlock(300, 3600, 0, 1),
                routes.get(2), new OccupancyBlock(0, 3600, 0, 1)
        );
        var res = new STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(0), 0)))
                .setEndLocations(Set.of(new Pathfinding.EdgeLocation<>(routes.get(2), 100)))
                .setUnavailableTimes(occupancyGraph)
                .run();

        assertNotNull(res);
        STDCMHelpers.occupancyTest(res, occupancyGraph);
        assertEquals(3600, res.departureTime());
    }
}
