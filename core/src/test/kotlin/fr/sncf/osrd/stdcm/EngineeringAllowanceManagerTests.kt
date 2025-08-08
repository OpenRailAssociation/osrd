package fr.sncf.osrd.stdcm

import fr.sncf.osrd.stdcm.graph.engineering_allowance.EngineeringAllowanceManager
import fr.sncf.osrd.stdcm.graph.engineering_allowance.SimulationSegment
import fr.sncf.osrd.stdcm.graph.engineering_allowance.SummarizedSimulationResult
import fr.sncf.osrd.stdcm.graph.engineering_allowance.runSimplifiedSimulation
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EngineeringAllowanceManagerTests {
    private val constantSpeed = 10.0
    private val length = 100.meters
    private val deceleration = 0.5
    private val acceleration = 0.2
    private val basicSegment =
        SimulationSegment(
            beginTime = 0.0,
            length = length,
            beginSpeed = constantSpeed,
            travelTime = length.meters / constantSpeed,
            maxAddedDelay = Double.POSITIVE_INFINITY,
            computeAccelSequenceFromEndSpeed = { constAcceleration(it, length) },
        )

    private val basicSegments =
        listOf(
            basicSegment.copy(beginTime = basicSegment.travelTime * 2),
            basicSegment.copy(beginTime = basicSegment.travelTime * 1),
            basicSegment.copy(beginSpeed = 0.0),
        )

    private val engineeringAllowanceManager = EngineeringAllowanceManager(deceleration, null)

    private fun constAcceleration(endSpeed: Double, length: Distance): SummarizedSimulationResult {
        val sim = runSimplifiedSimulation(acceleration, endSpeed, length.meters)
        return SummarizedSimulationResult(sim.newBeginSpeed, sim.newDuration)
    }

    @Test
    fun testNoConflict() {
        val opportunities =
            engineeringAllowanceManager
                .generateAllowanceOpportunities(basicSegments.asSequence(), constantSpeed)
                .toList()
        print(opportunities)
        assertEquals(3, opportunities.size)
        assertEquals(200.meters, opportunities[0].distance)
        assertEquals(200.meters, opportunities[1].distance)
        assertEquals(300.meters, opportunities[2].distance)

        let {
            val (minSpeed, accelTime) =
                runSimplifiedSimulation(acceleration, constantSpeed, length.meters)
            // Checking against the deceleration sequence is difficult without precise intersection
            assertTrue { opportunities[0].addedTime + 1e-3 >= accelTime - basicSegment.travelTime }
        }

        let {
            val (minSpeed, accelTime) =
                runSimplifiedSimulation(acceleration, constantSpeed, 2 * length.meters)
            assertTrue {
                opportunities[1].addedTime + 1e-3 >= accelTime - 2 * basicSegment.travelTime
            }
        }

        assertEquals(Double.POSITIVE_INFINITY, opportunities[2].addedTime)
    }
}
