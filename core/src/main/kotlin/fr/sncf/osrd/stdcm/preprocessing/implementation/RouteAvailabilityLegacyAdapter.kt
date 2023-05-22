package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.Multimap
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.infra_state.api.TrainPath.LocatedElement
import fr.sncf.osrd.stdcm.OccupancyBlock
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface.Availability
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** This class implements the RouteAvailabilityInterface using the legacy route occupancy data.
 * It's meant to be removed once the rest of the "signaling sim - stdcm" pipeline is implemented.  */
class RouteAvailabilityLegacyAdapter
(
    private val unavailableSpace: Multimap<SignalingRoute, OccupancyBlock>
) : RouteAvailabilityInterface {
    override fun getAvailability(
        path: TrainPath,
        startOffset: Double,
        endOffset: Double,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): Availability {
        assert(abs(endOffset - startOffset - envelope.endPos) < 1e-5)
        val unavailability = findMinimumDelay(path, startOffset, endOffset, envelope, startTime)
        return unavailability ?: findMaximumDelay(
                path,
                startOffset,
                endOffset,
                envelope,
                startTime
            )
    }

    /** Find the minimum delay needed to avoid any conflict.
     * Returns 0 if the train isn't currently causing any conflict.  */
    private fun findMinimumDelay(
        path: TrainPath,
        startOffset: Double,
        endOffset: Double,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): RouteAvailabilityInterface.Unavailable? {
        var minimumDelay = 0.0
        var conflictOffset = 0.0
        for (locatedRoute in iteratePathInRange(path, startOffset, endOffset)) {
            for (block in unavailableSpace[locatedRoute.element]) {
                val (start, end) = timeTrainInBlock(
                    block,
                    locatedRoute,
                    startOffset,
                    envelope,
                    startTime
                ) ?: continue
                if (start < block.timeEnd && end > block.timeStart) {
                    val blockMinimumDelay = block.timeEnd - start
                    if (blockMinimumDelay > minimumDelay) {
                        minimumDelay = blockMinimumDelay
                        conflictOffset = if (start <= block.timeStart) {
                            // The train enters the block before it's unavailable: conflict at end location
                            locatedRoute.pathOffset + block.distanceEnd
                        } else {
                            // The train enters the block when it's already unavailable: conflict at start location
                            locatedRoute.pathOffset + block.distanceStart
                        }
                    }
                }
            }
        }
        if (minimumDelay == 0.0)
            return null
        if (minimumDelay.isFinite()) {
            // We need to add delay, a recursive call is needed to detect new conflicts that appear with the added delay
            val recursive = findMinimumDelay(path, startOffset, endOffset, envelope, startTime + minimumDelay)
            if (recursive != null)
                minimumDelay += recursive.duration
        }
        conflictOffset = max(0.0, min(path.length, conflictOffset))
        return RouteAvailabilityInterface.Unavailable(minimumDelay, conflictOffset)
    }

    /** Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict.  */
    private fun findMaximumDelay(
        path: TrainPath,
        startOffset: Double,
        endOffset: Double,
        envelope: EnvelopeTimeInterpolate,
        startTime: Double
    ): RouteAvailabilityInterface.Available {
        var maximumDelay = Double.POSITIVE_INFINITY
        var timeOfNextOccupancy = Double.POSITIVE_INFINITY
        for (locatedRoute in iteratePathInRange(path, startOffset, endOffset)) {
            for (block in unavailableSpace[locatedRoute.element]) {
                val trainInBlock = timeTrainInBlock(
                    block,
                    locatedRoute,
                    startOffset,
                    envelope,
                    startTime
                )
                if (trainInBlock == null || trainInBlock.start >= block.timeEnd)
                    continue  // The block is occupied before we enter it
                assert(trainInBlock.start <= block.timeStart)
                val maxDelayForBlock = block.timeStart - trainInBlock.end
                if (maxDelayForBlock < maximumDelay) {
                    maximumDelay = maxDelayForBlock
                    timeOfNextOccupancy = block.timeStart
                }
            }
        }
        return RouteAvailabilityInterface.Available(maximumDelay, timeOfNextOccupancy)
    }

    @JvmRecord
    private data class TimeInterval(val start: Double, val end: Double)
    companion object {
        /** Returns the list of routes in the given interval on the path  */
        private fun iteratePathInRange(
            path: TrainPath,
            start: Double,
            end: Double
        ): List<LocatedElement<SignalingRoute>> {
            return path.routePath.stream()
                .filter { r: LocatedElement<SignalingRoute?> -> r.pathOffset < end }
                .filter { r: LocatedElement<SignalingRoute?> -> r.pathOffset + r.element!!.infraRoute.length > start }
                .toList()
        }

        /** Returns the time interval during which the train is on the given blocK.  */
        private fun timeTrainInBlock(
            block: OccupancyBlock,
            route: LocatedElement<SignalingRoute>,
            startOffset: Double,
            envelope: EnvelopeTimeInterpolate,
            startTime: Double
        ): TimeInterval? {
            val startRouteOffsetOnEnvelope = route.pathOffset - startOffset
            // Offsets on the envelope
            val blockEnterOffset = startRouteOffsetOnEnvelope + block.distanceStart
            val blockExitOffset = startRouteOffsetOnEnvelope + block.distanceEnd
            if (blockEnterOffset > envelope.endPos || blockExitOffset < 0)
                return null
            val enterTime = startTime + envelope.interpolateTotalTimeClamp(blockEnterOffset)
            val exitTime = startTime + envelope.interpolateTotalTimeClamp(blockExitOffset)
            return TimeInterval(enterTime, exitTime)
        }
    }
}
