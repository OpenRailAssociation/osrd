package fr.sncf.osrd.path

import fr.sncf.osrd.path.implementations.PathOffsetProjector
import fr.sncf.osrd.path.interfaces.FullRoutePath
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals

class PathOffsetProjectorTests {
    @Test
    fun simpleTestNoBacktrack() {
        val firstBlockOffset = Offset<FullRoutePath>(50.meters)
        val projector =
            PathOffsetProjector(
                firstBlockOffset = firstBlockOffset,
                backtrackLocations = listOf(),
                // coveredPathBeginOffset = Offset.zero(),
                // rollingStockLength = 0.meters,
            )

        assertEquals(Offset(55.meters), projector.blockToRoute(Offset(5.meters)))

        testSymmetry(
            { projector.blockToRoute(it) },
            { projector.routeToBlock(it) },
        )
    }

    @Test
    fun testWithBacktrack() {
        // A and B are in opposite directions, but the route path is displayed in a single line here
        //
        // Covered path offsets: A2 + 5m                   B2 + 12m
        // Covered path offsets:    v                         v
        // Covered Path:       |----|         (skipped)       |--...>
        // Routes: -----------------------> | ---------------------->
        // Routes:       A: 100 meters              B: 100 meters
        // Blocks: ----------> | ---------> | ----------> | -------->
        // Blocks:  A1: 70        A2: 30        B1: 45        B2: 55
        //
        // Route path: A -> B
        // Block path: A2 -> B2, NO B1 (fully skipped) nor A1 (before the start)

        // First block offset is before A and B, not pictured here
        val firstBlockOffset = Offset<FullRoutePath>(70.meters)
        val backtrack =
            PathOffsetProjector.BacktrackLocation(
                exactRouteOffset = Offset(70.meters + 5.meters),
                remainingBlockAfterBacktrack = 25.meters,
                skippedBlocksAroundBacktrack = 45.meters,
                // skippedNextRoute = 45.meters + 12.meters,
            )
        val projector =
            PathOffsetProjector(
                firstBlockOffset = firstBlockOffset,
                backtrackLocations = listOf(backtrack),
                // coveredPathBeginOffset = Offset.zero(),
                // rollingStockLength = 0.meters,
            )

        // Before backtrack
        assertEquals(Offset(73.meters), projector.blockToRoute(Offset(3.meters)))

        // Still on A2 (block before backtrack), but past the actual backtrack point.
        // In this projection, we're still on the pre-backtrack elements.
        assertEquals(Offset(85.meters), projector.blockToRoute(Offset(15.meters)))

        // Right after backtrack
        assertEquals(
            Offset(100.meters + 45.meters + 5.meters), // A, B1, part of B2
            projector.blockToRoute(Offset(30.meters + 5.meters)) // A2, part of B2
        )

        testSymmetry(
            { projector.blockToRoute(it) },
            { projector.routeToBlock(it) },
            -100..300, // Block offsets
            0 ..< 0, // Route offsets: converting to block will truncate (not symmetrical)
        )
    }

    /**
     * Given two types of offset and functions that convert from one type to the other, test that
     * converting back and forth doesn't change the value over a given range.
     */
    fun <T, U> testSymmetry(
        oneWay: (Offset<T>) -> Offset<U>,
        otherWay: (Offset<U>) -> Offset<T>,
        firstTypeRange: IntRange = -100..100,
        secondTypeRange: IntRange = -100..100,
    ) {
        for (i in firstTypeRange) {
            val t = Offset<T>(i.meters)
            val converted = oneWay(t)
            val convertedBack = otherWay(converted)
            assertEquals(t, convertedBack)
        }
        for (i in secondTypeRange) {
            val t = Offset<U>(i.meters)
            val converted = otherWay(t)
            val convertedBack = oneWay(converted)
            assertEquals(t, convertedBack)
        }
    }
}
