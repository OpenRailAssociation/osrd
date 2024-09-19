package fr.sncf.osrd.stdcm

import fr.sncf.osrd.stdcm.graph.StopTimeData
import fr.sncf.osrd.stdcm.graph.TimeData
import fr.sncf.osrd.stdcm.graph.VisitedNodes
import fr.sncf.osrd.stdcm.infra_exploration.EdgeIdentifier
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class VisitedNodesTests {

    private data class DummyEdgeIdentifier(val int: Int) : EdgeIdentifier

    private val fingerprint =
        VisitedNodes.Fingerprint(
            identifier = DummyEdgeIdentifier(1),
            waypointIndex = 1,
            startOffset = 0.meters,
        )

    @Test
    fun simpleTest() {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 42.0,
                        timeOfNextConflictAtLocation = 42.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData = listOf(),
                    ),
                maxMarginDuration = 0.0,
            )

        assertFalse { visitedNodes.isVisited(params1) }
        visitedNodes.markAsVisited(params1)
        assertTrue { visitedNodes.isVisited(params1) }
    }

    @Test
    fun overlappingTest() {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 42.0,
                        timeOfNextConflictAtLocation = 42.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData = listOf(),
                    ),
                maxMarginDuration = 0.0,
            )
        visitedNodes.markAsVisited(params1)
        assertTrue {
            visitedNodes.isVisited(
                params1.copy(
                    timeData =
                        params1.timeData.copy(
                            earliestReachableTime = 20.0,
                            maxDepartureDelayingWithoutConflict = 20.0,
                        )
                )
            )
        }
    }

    @Test
    fun coveredByReachable() {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 100.0,
                        timeOfNextConflictAtLocation = 100.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData = listOf(),
                    ),
                maxMarginDuration = 100.0,
            )
        val params2 =
            params1.copy(
                timeData =
                    params1.timeData.copy(
                        earliestReachableTime = 120.0,
                        maxDepartureDelayingWithoutConflict = 1.0,
                        totalRunningTime = 15.0,
                    )
            )
        val params3 =
            params1.copy(
                timeData =
                    params1.timeData.copy(
                        earliestReachableTime = 120.0,
                        maxDepartureDelayingWithoutConflict = 1.0,
                        totalRunningTime = 25.0,
                    )
            )
        // At t=120, it's covered by the first parameters at cost=20
        visitedNodes.markAsVisited(params1)
        assertFalse { visitedNodes.isVisited(params2) }
        assertTrue { visitedNodes.isVisited(params3) }
    }

    @Test
    fun intersectionTest() {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 100.0,
                        timeOfNextConflictAtLocation = 100.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData = listOf(),
                    ),
                maxMarginDuration = 100.0,
            )
        // At t=120, it's covered by the first parameters at cost=20
        val params2 =
            params1.copy(
                timeData =
                    params1.timeData.copy(
                        earliestReachableTime = 120.0,
                        totalRunningTime = 15.0,
                    )
            )
        // The duration here is longer than the previous test: it's visited from t=120 to t=125
        // (above the cost function), then unvisited from t=125. Some parts are unvisited => false
        // is expected
        visitedNodes.markAsVisited(params1)
        assertFalse { visitedNodes.isVisited(params2) }
    }

    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun testMarginTimes(lowerMarginValue: Boolean) {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 0.0,
                        timeOfNextConflictAtLocation = 0.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData = listOf(),
                    ),
                maxMarginDuration = 100.0,
            )
        // The other value arrives later (in a section covered by a possible margin),
        // it's only considered visited if the runtime is smaller
        val params2 =
            params1.copy(
                timeData =
                    params1.timeData.copy(
                        earliestReachableTime = 42.0,
                        totalRunningTime = if (lowerMarginValue) 20.0 else 42.0,
                    ),
                maxMarginDuration = 0.0,
            )
        visitedNodes.markAsVisited(params1)
        assertEquals(!lowerMarginValue, visitedNodes.isVisited(params2))
    }

    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun testStopTimes(lowerStopDuration: Boolean) {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 100.0,
                        timeOfNextConflictAtLocation = 100.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData =
                            listOf(
                                StopTimeData(
                                    currentDuration = 120.0,
                                    minDuration = 120.0,
                                    maxDepartureDelayBeforeStop = 0.0
                                )
                            ),
                    ),
                maxMarginDuration = 100.0,
            )
        // We just change the stop duration, it's supposed to not be visited anymore if the stop
        // duration is lower
        val params2 =
            params1.copy(
                timeData =
                    params1.timeData.copy(
                        stopTimeData =
                            listOf(
                                params1.timeData.stopTimeData
                                    .first()
                                    .copy(
                                        currentDuration = if (lowerStopDuration) 0.0 else 120.0,
                                    )
                            )
                    )
            )
        visitedNodes.markAsVisited(params1)
        assertEquals(!lowerStopDuration, visitedNodes.isVisited(params2))
    }

    @ParameterizedTest
    @ValueSource(booleans = [true, false])
    fun testRemainingTime(increaseRemainingTime: Boolean) {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                timeData =
                    TimeData(
                        earliestReachableTime = 0.0,
                        maxDepartureDelayingWithoutConflict = 100.0,
                        timeOfNextConflictAtLocation = 100.0,
                        totalRunningTime = 0.0,
                        departureTime = 0.0,
                        stopTimeData =
                            listOf(
                                StopTimeData(
                                    currentDuration = 120.0,
                                    minDuration = 120.0,
                                    maxDepartureDelayBeforeStop = 0.0
                                )
                            ),
                    ),
                maxMarginDuration = 100.0,
                remainingTimeEstimation = 300.0,
            )
        // We reduce stop duration, but we also change the remaining time, which has a higher
        // priority
        val params2 =
            params1.copy(
                timeData =
                    params1.timeData.copy(
                        stopTimeData =
                            listOf(
                                params1.timeData.stopTimeData.first().copy(currentDuration = 0.0)
                            )
                    ),
                remainingTimeEstimation = if (increaseRemainingTime) 600.0 else 300.0
            )
        visitedNodes.markAsVisited(params1)
        assertEquals(increaseRemainingTime, visitedNodes.isVisited(params2))
    }
}
