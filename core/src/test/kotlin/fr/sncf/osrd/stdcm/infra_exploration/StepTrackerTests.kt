package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.sim_infra.api.BlockLocation
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
                ExplorerStep(listOf(BlockLocation(blocks[0], Offset(50.meters)))),
                ExplorerStep(
                    listOf(
                        BlockLocation(blocks[0], Offset(40.meters)),
                        BlockLocation(blocks[0], Offset(51.meters)),
                    )
                ),
                ExplorerStep(listOf(BlockLocation(blocks[1], Offset(0.meters)))),
                ExplorerStep(listOf(BlockLocation(blocks[1], Offset(100.meters)))),
                ExplorerStep(listOf(BlockLocation(blocks[2], Offset(100.meters)))),
            )
        val tracker = StepTracker(steps)

        val firstSteps =
            tracker.exploreBlockRange(blocks[0], Offset(25.meters), Offset(100.meters), false)
        val expectedFirstSteps =
            listOf(
                LocatedStep(Offset(25.meters), steps[0].locations.single(), steps[0]),
                LocatedStep(
                    Offset(26.meters),
                    BlockLocation(blocks[0], Offset(51.meters)),
                    steps[1],
                ),
            )
        assertEquals(expectedFirstSteps, firstSteps)
        val second =
            tracker.exploreBlockRange(blocks[1], Offset(0.meters), Offset(100.meters), false)
        val expectedSecond =
            listOf(
                LocatedStep(Offset(75.meters), steps[2].locations.single(), steps[2]),
                LocatedStep(Offset(175.meters), steps[3].locations.single(), steps[3]),
            )
        assertEquals(expectedSecond, second)
        assertFalse { tracker.hasSeenDestination() }
        val third =
            tracker.exploreBlockRange(blocks[2], Offset(0.meters), Offset(100.meters), false)
        val expectedThird =
            listOf(LocatedStep(Offset(275.meters), steps[4].locations.single(), steps[4]))
        assertEquals(expectedThird, third)
        assertTrue { tracker.hasSeenDestination() }
        assertEquals(
            expectedFirstSteps.plus(expectedSecond).plus(expectedThird),
            tracker.getSeenSteps().toList(),
        )
    }
}
