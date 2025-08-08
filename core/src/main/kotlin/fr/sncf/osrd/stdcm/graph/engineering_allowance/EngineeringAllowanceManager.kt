package fr.sncf.osrd.stdcm.graph.engineering_allowance

import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.utils.cacheable
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.math.*

/**
 * This class contains all the methods used to handle allowances. This is how we add delays in
 * limited ranges of the path.
 */
class EngineeringAllowanceManager(
    private val constDeceleration: Double,
    private val graph: STDCMGraph?,
) {

    // Account for the approximations made during const deceleration,
    // not to be too optimistic in allowance opportunities
    private val constDecelerationScaling = 0.9

    /**
     * Check whether an engineering allowance can be used in this context to be at the expected
     * start time at the node location. Returns the allowance length if it's possible, or null if it
     * isn't.
     *
     * We're trying to "lose" as much time as possible on the shortest distance, which would be a
     * deceleration followed by an acceleration. We know the point at the end of the acceleration
     * (where we need to avoid the conflict), so we compute the rest backwards. We compute the
     * acceleration with a normal simulation, and make use of the "gamma braking" for the
     * deceleration (constant deceleration value in m.s^-2)
     *
     * In terms of implementation: we define a sequence of past "simulation segments". They're
     * shorter than edges. We compute the acceleration sequence starting from the end of the
     * (currently) simulated path, one segment at a time. After each segment we try to compute the
     * deceleration sequence. We quit at the first conflict, or when the full sequence adds enough
     * time.
     */
    fun checkEngineeringAllowance(prevNode: STDCMNode, expectedStartTime: Double): Distance? {
        assert(constDeceleration > 0.0)

        val requiredAdditionalTime = expectedStartTime - prevNode.timeData.earliestReachableTime

        val opportunities = prevNode.allowanceOpportunities

        val solution =
            opportunities
                .takeWhile { it.maxNextAllowanceValue >= requiredAdditionalTime }
                .firstOrNull { it.addedTime >= requiredAdditionalTime } ?: return null

        // We still try to roughly guess the maximum length over which to add the time
        var distance = 0.meters
        for (segment in prevNode.previousSimulationSegments) {
            if (segment.maxAddedDelay <= requiredAdditionalTime) break
            distance += segment.length
        }
        return Distance.max(solution.distance, distance)
    }

    /**
     * Each returned instance contains a possible engineering allowance, adding time over a certain
     * distance. Next returned values will have a larger time and distance.
     */
    data class EngineeringAllowanceOpportunity(
        val addedTime: Double,
        val distance: Distance,
        // For subsequent calls, enables early breaking
        val maxNextAllowanceValue: Double,
    ) {
        init {
            positive(addedTime)
            assert(distance > 0.meters)
            assert(maxNextAllowanceValue >= addedTime)
        }
    }

    /**
     * Iterates through all the segments, and generates engineering allowance opportunities at each
     * one. Each allowance contains the added time, the distance, and the maximum added time of
     * subsequent calls. Returns a lazy Sequence, early breaking is encouraged.
     */
    fun generateAllowanceOpportunities(
        backwardsSegments: Sequence<SimulationSegment>,
        endSpeed: Double,
    ): Sequence<EngineeringAllowanceOpportunity> = sequence {
        // End speed to use when simulating the next edge
        var currentSpeed = endSpeed
        // Accumulator keeping track of the acceleration sequence length
        var accelerationLength = 0.meters
        // Keeps track of how much time we can add during the re-simulated acceleration segments
        var maxNextAllowanceValue = Double.POSITIVE_INFINITY
        // How much delay we've added over the re-simulated acceleration segments
        var currentAddedDelay = 0.0

        val cachedSegments = backwardsSegments.cacheable()
        for ((i, segment) in cachedSegments.withIndex()) {
            val (newBeginSpeed, newTravelTime) =
                segment.computeAccelSequenceFromEndSpeed(currentSpeed)

            val travelTimeDiff = max(0.0, newTravelTime - segment.travelTime)
            currentAddedDelay += travelTimeDiff
            accelerationLength += segment.length

            val maxAdditionalDelayOnSegment = segment.maxAddedDelay - travelTimeDiff
            maxNextAllowanceValue =
                min(maxNextAllowanceValue, currentAddedDelay + maxAdditionalDelayOnSegment)

            // We now compute the (simplified) deceleration sequence to have the full allowance
            val decelerationSequence =
                computeConstDeceleration(
                    cachedSegments.drop(i + 1),
                    newBeginSpeed,
                    constDeceleration * constDecelerationScaling,
                )
            val decelerationResults = checkDeceleration(decelerationSequence, newBeginSpeed)
            if (decelerationResults.hasConflict) break

            val opportunityTotalAddedTime =
                min(maxNextAllowanceValue, currentAddedDelay + decelerationResults.addedDelay)
            val opportunityTotalLength =
                accelerationLength + decelerationResults.decelerationLength!!
            yield(
                EngineeringAllowanceOpportunity(
                    opportunityTotalAddedTime,
                    opportunityTotalLength,
                    maxNextAllowanceValue,
                )
            )
            if (opportunityTotalAddedTime >= maxNextAllowanceValue) break
            currentSpeed =
                min(newBeginSpeed, endSpeed) // Limit accelerations when the train lacks traction
        }
    }

    private data class DecelerationResults(
        val hasConflict: Boolean,
        val addedDelay: Double,
        val decelerationLength: Distance?,
    ) {
        init {
            positive(addedDelay)
            assert(decelerationLength == null || decelerationLength >= 0.meters)
            assert(hasConflict || decelerationLength != null)
        }
    }

    /**
     * Iterates through the deceleration sequence to look for conflicts. If there's none, returns
     * all relevant data on the deceleration sequence (added time and braking distance).
     */
    private fun checkDeceleration(
        decelerationSequence: Sequence<ConstDecelerationData>,
        decelerationEndSpeed: Double,
    ): DecelerationResults {
        var decelerationLength = 0.meters
        // Keep track of how much delay we can add before causing conflict on the braking sequence
        var maxBrakingDelay = Double.POSITIVE_INFINITY
        var totalBrakingDelay = 0.0
        for (decelerationSegment in decelerationSequence) {
            totalBrakingDelay += decelerationSegment.addedTimeOnSegment
            decelerationLength += decelerationSegment.segment.length
            val maxDelayOnSegment =
                decelerationSegment.segment.maxAddedDelay - decelerationSegment.addedTimeOnSegment
            maxBrakingDelay = min(maxBrakingDelay, maxDelayOnSegment + totalBrakingDelay)

            if (totalBrakingDelay >= maxBrakingDelay) {
                return DecelerationResults(
                    hasConflict = true,
                    addedDelay = 0.0,
                    decelerationLength = null,
                )
            }
        }
        val canStop = decelerationEndSpeed <= 0.0
        if (canStop) totalBrakingDelay = Double.POSITIVE_INFINITY
        return DecelerationResults(
            hasConflict = false,
            addedDelay = totalBrakingDelay,
            decelerationLength,
        )
    }

    private data class ConstDecelerationData(
        val segment: SimulationSegment,
        val newTotalTime: Double,
        val addedTimeOnSegment: Double,
    ) {
        init {
            positive(newTotalTime)
            positive(newTotalTime - segment.travelTime)
            positive(addedTimeOnSegment)
        }
    }

    /**
     * Compute the full deceleration sequence with a constant deceleration value. Consecutive edges
     * are evaluated lazily, for early braking on the first conflicting segment (if any).
     */
    private fun computeConstDeceleration(
        prevSegments: Sequence<SimulationSegment>,
        decelerationEndSpeed: Double,
        constDeceleration: Double,
    ): Sequence<ConstDecelerationData> = sequence {
        var endSpeed = decelerationEndSpeed
        var intersection = false
        for (segment in prevSegments) {
            val pureDecelerationSim =
                runSimplifiedSimulation(-constDeceleration, endSpeed, segment.length.meters)
            var simTravelTime = pureDecelerationSim.newDuration
            if (pureDecelerationSim.newBeginSpeed > segment.beginSpeed) {
                // Intersection with base sim. We estimate the new time with a basic speed plateau +
                // const deceleration, return this segment, and exit the loop.
                if (segment.beginSpeed < endSpeed || segment.beginSpeed <= 0.0)
                    break // Can't run the simplified sim, there's an acceleration
                val newTime =
                    simplifiedSpeedPlateauThenDeceleration(
                        constDeceleration,
                        segment.beginSpeed,
                        endSpeed,
                        segment.length.meters,
                    )
                intersection = true
                simTravelTime = newTime
            }

            var newTravelTime = scaleAllowanceTime(graph, simTravelTime, segment.length)
            newTravelTime = max(newTravelTime, segment.travelTime)
            val addedTimeOnSegment = newTravelTime - segment.travelTime

            yield(ConstDecelerationData(segment, newTravelTime, addedTimeOnSegment))
            if (intersection) break
            endSpeed = pureDecelerationSim.newBeginSpeed
        }
    }
}
