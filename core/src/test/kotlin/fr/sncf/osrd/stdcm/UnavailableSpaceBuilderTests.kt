package fr.sncf.osrd.stdcm

import fr.sncf.osrd.Helpers
import fr.sncf.osrd.api.stdcm.STDCMRequest.RouteOccupancy
import fr.sncf.osrd.stdcm.preprocessing.implementation.computeUnavailableSpace
import fr.sncf.osrd.train.TestTrains
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class UnavailableSpaceBuilderTests {
    @Test
    @Throws(Exception::class)
    fun testNoOccupancy() {
        val infra = Helpers.infraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        val res = computeUnavailableSpace(infra, setOf(), TestTrains.REALISTIC_FAST_TRAIN, 0.0, 0.0)
        Assertions.assertTrue(res.isEmpty)
    }

    @Test
    fun testFirstRouteOccupied() {
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0)
        val infra = infraBuilder.build()
        val res = computeUnavailableSpace(
            infra,
            setOf(RouteOccupancy("a->b", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        Assertions.assertEquals(
            setOf(
                OccupancyBlock(0.0, 100.0, 0.0, 1000.0) // base occupancy
            ),
            res[firstRoute]
        )
        Assertions.assertEquals(
            setOf( // If the train is in this area, the previous route would be "yellow", causing a conflict
                OccupancyBlock(
                    0.0,
                    100.0,
                    0.0,
                    1000.0
                ) // Margin added to the base occupancy to account for the train length,
                // it can be removed if this test fails as it overlaps with the previous one
                //new OccupancyBlock(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
            ),
            res[secondRoute]
        )
    }

    @Test
    fun testSecondRouteOccupied() {
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0)
        val infra = infraBuilder.build()
        val res = computeUnavailableSpace(
            infra,
            setOf(RouteOccupancy("b->c", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        Assertions.assertEquals(
            setOf( // Entering this area would cause the train to see a signal that isn't green
                OccupancyBlock(0.0, 100.0, (1000 - 400).toDouble(), 1000.0)
            ),
            res[firstRoute]
        )
        Assertions.assertEquals(
            setOf(
                OccupancyBlock(0.0, 100.0, 0.0, 1000.0) // base occupancy
            ),
            res[secondRoute]
        )
    }

    @Test
    fun testBranchingRoutes() {
        /*
        a1        b1
           \      ^
            v    /
            center
            ^    \
           /      v
         a2       b2
         */
        val infraBuilder = DummyRouteGraphBuilder()
        val a1 = infraBuilder.addRoute("a1", "center", 1000.0)
        val a2 = infraBuilder.addRoute("a2", "center", 1000.0)
        val b1 = infraBuilder.addRoute("center", "b1", 1000.0)
        val b2 = infraBuilder.addRoute("center", "b2", 1000.0)
        val infra = infraBuilder.build()
        val res = computeUnavailableSpace(
            infra,
            setOf(RouteOccupancy("a1->center", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        Assertions.assertEquals(
            setOf(
                OccupancyBlock(0.0, 100.0, 0.0, 1000.0) // base occupancy
            ),
            res[a1]
        )
        Assertions.assertEquals(
            setOf<Any>(),
            res[a2]
        )
        Assertions.assertEquals(
            setOf( // If the train is in this area, the previous route would be "yellow", causing a conflict
                OccupancyBlock(
                    0.0,
                    100.0,
                    0.0,
                    1000.0
                ) // Margin added to the base occupancy to account for the train length,
                // it can be removed if this test fails as it overlaps with the previous one
                // new OccupancyBlock(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
            ),
            res[b1]
        )
        Assertions.assertEquals(res[b1], res[b2])
    }

    @Test
    fun testThirdRoute() {
        val infraBuilder = DummyRouteGraphBuilder()
        infraBuilder.addRoute("a", "b", 1000.0)
        infraBuilder.addRoute("b", "c", 1000.0)
        val thirdRoute = infraBuilder.addRoute("c", "d", 1000.0)
        val infra = infraBuilder.build()
        val res = computeUnavailableSpace(
            infra,
            setOf(RouteOccupancy("a->b", 0.0, 100.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            0.0,
            0.0
        )
        Assertions.assertEquals(
            setOf( // The second route can't be occupied in that time because it would cause a "yellow" state
                // in the first one (conflict), and this accounts for the extra margin needed in the third
                // route caused by the train length
                OccupancyBlock(0.0, 100.0, 0.0, TestTrains.REALISTIC_FAST_TRAIN.getLength())
            ),
            res[thirdRoute]
        )
    }

    @Test
    fun testGridMargins() {
        val infraBuilder = DummyRouteGraphBuilder()
        val firstRoute = infraBuilder.addRoute("a", "b", 1000.0)
        val secondRoute = infraBuilder.addRoute("b", "c", 1000.0)
        val infra = infraBuilder.build()
        val res = computeUnavailableSpace(
            infra,
            setOf(RouteOccupancy("a->b", 100.0, 200.0)),
            TestTrains.REALISTIC_FAST_TRAIN,
            20.0,
            60.0
        )
        // TimeStart and TimeEnd should be adjusted because of the margins
        // (20s before and 60s after)
        Assertions.assertEquals(
            setOf(
                OccupancyBlock(80.0, 260.0, 0.0, 1000.0)
            ),
            res[firstRoute]
        )
        Assertions.assertEquals(
            setOf(
                OccupancyBlock(80.0, 260.0, 0.0, 1000.0)
            ),
            res[secondRoute]
        )
    }
}
