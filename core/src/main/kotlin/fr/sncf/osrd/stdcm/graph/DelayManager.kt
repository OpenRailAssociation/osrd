package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface.Availability
import java.util.*

/** This class contains all the methods used to handle delays
 * (how much we can add, how much we need to add, and such)
 */
class DelayManager internal constructor(
    private val minScheduleTimeStart: Double,
    private val maxRunTime: Double,
    private val routeAvailability: RouteAvailabilityInterface,
    private val graph: STDCMGraph
) {
    /** Returns one value per "opening" (interval between two unavailable times).
     * Always returns the shortest delay to add to enter this opening.  */
    fun minimumDelaysPerOpening(
        route: SignalingRoute,
        startTime: Double,
        envelope: Envelope,
        startOffset: Double
    ): NavigableSet<Double> {
        // This is the margin used for the binary search, we need to add
        // this time before and after the train to avoid problems caused by the error margin
        val margin = graph.timeStep
        val res = TreeSet<Double>()
        val endOffset = startOffset + envelope.endPos
        val path = makeTrainPath(route, startOffset, endOffset)
        var time = startTime
        while (time.isFinite()) {
            val availability = getScaledAvailability(
                path,
                0.0,
                path.length,
                envelope,
                time
            )
            when (availability) {
                is RouteAvailabilityInterface.Available -> {
                    if (availability.maximumDelay >= margin)
                        res.add(time - startTime)
                    time += availability.maximumDelay + 1
                }

                is RouteAvailabilityInterface.Unavailable -> {
                    time += availability.duration + margin
                }

                else -> throw RuntimeException("STDCM lookahead isn't supported yet")
            }
        }
        return res
    }

    /** Returns the start time of the next occupancy for the route  */
    fun findNextOccupancy(route: SignalingRoute, time: Double, startOffset: Double, envelope: Envelope): Double {
        val endOffset = startOffset + envelope.endPos
        val path = makeTrainPath(route, startOffset, endOffset)
        val availability = getScaledAvailability(
            path,
            0.0,
            path.length,
            envelope,
            time
        )
        return (availability as RouteAvailabilityInterface.Available).timeOfNextConflict
    }

    /** Returns true if the total run time at the start of the edge is above the specified threshold  */
    fun isRunTimeTooLong(edge: STDCMEdge): Boolean {
        val totalRunTime = edge.timeStart - edge.totalDepartureTimeShift - minScheduleTimeStart
        // We could use the A* heuristic here, but it would break STDCM on any infra where the
        // coordinates don't match the actual distance (which is the case when generated).
        // Ideally we should add a switch in the railjson format
        return totalRunTime > maxRunTime
    }

    /** Returns by how much we can shift this envelope (in time) before causing a conflict.
     *
     * e.g. if the train takes 42s to go through the route, enters the route at t=10s,
     * and we need to leave the route at t=60s, this will return 8s.  */
    fun findMaximumAddedDelay(
        route: SignalingRoute?,
        startTime: Double,
        startOffset: Double,
        envelope: Envelope
    ): Double {
        val endOffset = startOffset + envelope.endPos
        val path = makeTrainPath(route!!, startOffset, endOffset)
        val availability = getScaledAvailability(
            path, 0.0, path.length, envelope, startTime
        )
        assert(availability is RouteAvailabilityInterface.Available)
        return (availability as RouteAvailabilityInterface.Available).maximumDelay
    }

    /** Calls `routeAvailability.getAvailability`, on an envelope scaled to account for the standard allowance.  */
    private fun getScaledAvailability(
        path: TrainPath,
        startOffset: Double,
        endOffset: Double,
        envelope: Envelope,
        startTime: Double
    ): Availability {
        val speedRatio = graph.getStandardAllowanceSpeedRatio(envelope)
        val scaledEnvelope: Envelope
        if (envelope.endPos == 0.0)
            scaledEnvelope = envelope
        else
            scaledEnvelope = LinearAllowance.scaleEnvelope(envelope, speedRatio)
        return routeAvailability.getAvailability(
            path,
            startOffset,
            endOffset,
            scaledEnvelope,
            startTime
        )
    }
}
