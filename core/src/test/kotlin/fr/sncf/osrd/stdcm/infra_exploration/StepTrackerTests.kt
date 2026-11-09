package fr.sncf.osrd.stdcm.infra_exploration

import fr.sncf.osrd.path.interfaces.BlockRange
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
                    ),
                ),
                ExplorerStep(listOf(BlockLocation(blocks[1], Offset(0.meters)))),
                ExplorerStep(listOf(BlockLocation(blocks[1], Offset(100.meters)))),
                ExplorerStep(listOf(BlockLocation(blocks[2], Offset(100.meters)))),
            )
        val tracker = StepTracker(steps, emptyMap())

        val firstBlockRange =
            BlockRange(
                value = blocks[0],
                objectBegin = Offset(25.meters),
                objectEnd = Offset(100.meters),
                pathBegin = Offset(0.meters),
                pathEnd = Offset(75.meters),
                objectLength = Offset(100.meters),
            )
        val firstSteps = tracker.exploreBlockRange(firstBlockRange, false)
        val expectedFirstSteps =
            listOf(
                LocatedStep(
                    Offset(25.meters),
                    steps[0].locations.single(),
                    steps[0],
                    stepType = null,
                ),
                LocatedStep(
                    Offset(26.meters),
                    BlockLocation(blocks[0], Offset(51.meters)),
                    steps[1],
                    stepType = null,
                ),
            )
        assertEquals(expectedFirstSteps, firstSteps)
        val secondBlockRange =
            BlockRange(
                value = blocks[1],
                objectBegin = Offset(0.meters),
                objectEnd = Offset(100.meters),
                pathBegin = Offset(75.meters),
                pathEnd = Offset(175.meters),
                objectLength = Offset(100.meters),
            )
        val second = tracker.exploreBlockRange(secondBlockRange, false)
        val expectedSecond =
            listOf(
                LocatedStep(
                    Offset(75.meters),
                    steps[2].locations.single(),
                    steps[2],
                    stepType = null,
                ),
                LocatedStep(
                    Offset(175.meters),
                    steps[3].locations.single(),
                    steps[3],
                    stepType = null,
                ),
            )
        assertEquals(expectedSecond, second)
        assertFalse { tracker.hasSeenDestination() }
        val thirdBlockRange =
            BlockRange(
                value = blocks[2],
                objectBegin = Offset(0.meters),
                objectEnd = Offset(100.meters),
                pathBegin = Offset(175.meters),
                pathEnd = Offset(275.meters),
                objectLength = Offset(100.meters),
            )
        val third = tracker.exploreBlockRange(thirdBlockRange, false)
        val expectedThird =
            listOf(
                LocatedStep(
                    Offset(275.meters),
                    steps[4].locations.single(),
                    steps[4],
                    stepType = null,
                ),
            )
        assertEquals(expectedThird, third)
        assertTrue { tracker.hasSeenDestination() }
        assertEquals(
            expectedFirstSteps.plus(expectedSecond).plus(expectedThird),
            tracker.getSeenSteps().toList(),
        )
    }
}
