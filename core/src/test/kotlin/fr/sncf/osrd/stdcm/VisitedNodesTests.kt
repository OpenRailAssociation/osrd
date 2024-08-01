package fr.sncf.osrd.stdcm

import fr.sncf.osrd.stdcm.graph.VisitedNodes
import fr.sncf.osrd.stdcm.infra_exploration.EdgeIdentifier
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

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
                startTime = 0.0,
                duration = 42.0,
                maxMarginDuration = 0.0,
                baseNodeCost = 0.0,
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
                startTime = 0.0,
                duration = 42.0,
                maxMarginDuration = 0.0,
                baseNodeCost = 0.0,
            )
        visitedNodes.markAsVisited(params1)
        assertTrue { visitedNodes.isVisited(params1.copy(startTime = 20.0, duration = 20.0)) }
    }

    @Test
    fun coveredByReachable() {
        val visitedNodes = VisitedNodes(0.0)

        val params1 =
            VisitedNodes.Parameters(
                fingerprint = fingerprint,
                startTime = 0.0,
                duration = 100.0,
                maxMarginDuration = 100.0,
                baseNodeCost = 0.0,
            )
        val params2 = params1.copy(startTime = 120.0, duration = 1.0, baseNodeCost = 15.0)
        val params3 = params1.copy(startTime = 120.0, duration = 1.0, baseNodeCost = 25.0)
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
                startTime = 0.0,
                duration = 100.0,
                maxMarginDuration = 100.0,
                baseNodeCost = 0.0,
            )
        // At t=120, it's covered by the first parameters at cost=20
        val params2 = params1.copy(startTime = 120.0, baseNodeCost = 15.0)
        // The duration here is longer than the previous test: it's visited from t=120 to t=125
        // (above the cost function), then unvisited from t=125. Some parts are unvisited => false
        // is expected
        visitedNodes.markAsVisited(params1)
        assertFalse { visitedNodes.isVisited(params2) }
    }
}
