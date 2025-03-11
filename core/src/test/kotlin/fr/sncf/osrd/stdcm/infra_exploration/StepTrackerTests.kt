package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.utils.DummyInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class StepTrackerTests {

    @Test
    fun basicTest() {
        val infra = DummyInfra()
        val blocks =
            listOf(
                infra.addBlock("a", "b", 100.meters),
                infra.addBlock("b", "c", 100.meters),
                infra.addBlock("c", "d", 100.meters),
                infra.addBlock("d", "e", 100.meters),
            )
        val steps =
            listOf(
                STDCMStep(listOf(PathfindingEdgeLocationId(blocks[0], Offset(50.meters)))),
                STDCMStep(
                    listOf(
                        PathfindingEdgeLocationId(blocks[0], Offset(40.meters)),
                        PathfindingEdgeLocationId(blocks[0], Offset(51.meters)),
                    )
                ),
                STDCMStep(listOf(PathfindingEdgeLocationId(blocks[1], Offset(0.meters)))),
                STDCMStep(listOf(PathfindingEdgeLocationId(blocks[1], Offset(100.meters)))),
                STDCMStep(listOf(PathfindingEdgeLocationId(blocks[2], Offset(100.meters)))),
            )
        val tracker = StepTracker(steps)

        val firstSteps = tracker.exploreBlockRange(blocks[0], Offset(25.meters), Offset(100.meters))
        val expectedFirstSteps =
            listOf(
                LocatedStep(Offset(25.meters), steps[0].locations.single(), steps[0]),
                LocatedStep(
                    Offset(26.meters),
                    PathfindingEdgeLocationId(blocks[0], Offset(51.meters)),
                    steps[1]
                ),
            )
        assertEquals(expectedFirstSteps, firstSteps)
        val second = tracker.exploreBlockRange(blocks[1], Offset(0.meters), Offset(100.meters))
        val expectedSecond =
            listOf(
                LocatedStep(Offset(75.meters), steps[2].locations.single(), steps[2]),
                LocatedStep(Offset(175.meters), steps[3].locations.single(), steps[3]),
            )
        assertEquals(expectedSecond, second)
        assertFalse { tracker.hasReachedDestination() }
        val third = tracker.exploreBlockRange(blocks[2], Offset(0.meters), Offset(100.meters))
        val expectedThird =
            listOf(
                LocatedStep(Offset(275.meters), steps[4].locations.single(), steps[4]),
            )
        assertEquals(expectedThird, third)
        assertTrue { tracker.hasReachedDestination() }
        assertEquals(
            expectedFirstSteps.plus(expectedSecond).plus(expectedThird),
            tracker.getAllReachedSteps()
        )
    }
}
