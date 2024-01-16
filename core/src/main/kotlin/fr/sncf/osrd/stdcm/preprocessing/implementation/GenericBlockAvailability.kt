package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * This class is used to share as much code as possible between BlockAvailability and the legacy /
 * test version
 */
abstract class GenericBlockAvailability : BlockAvailabilityInterface {

    interface ResourceUse {
        val startOffset: Offset<Path>
        val endOffset: Offset<Path>
        val startTime: Double
        val endTime: Double
    }

    /** Returns all resource usage for the given path, or null if more lookahead is needed */
    abstract fun generateResourcesForPath(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
    ): List<ResourceUse>?

    /**
     * Returns all the scheduled resource use that use the same resource as the one given as
     * parameter
     */
    abstract fun getScheduledResources(
        infraExplorer: InfraExplorerWithEnvelope,
        resource: ResourceUse
    ): List<ResourceUse>

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): BlockAvailabilityInterface.Availability {
        val resourceUses =
            generateResourcesForPath(infraExplorer, startOffset, endOffset)
                ?: return BlockAvailabilityInterface.NotEnoughLookahead()
        // startTime refers to the time at startOffset, we need to offset it
        val pathStartTime =
            startTime -
                infraExplorer
                    .getFullEnvelope()
                    .interpolateTotalTimeClamp(startOffset.distance.meters)
        val unavailability = findMinimumDelay(infraExplorer, resourceUses, pathStartTime)
        return unavailability ?: findMaximumDelay(infraExplorer, resourceUses, pathStartTime)
    }

    /**
     * Find the minimum delay needed to avoid any conflict. Returns 0 if the train isn't currently
     * causing any conflict.
     */
    private fun findMinimumDelay(
        infraExplorer: InfraExplorerWithEnvelope,
        resourceUses: List<ResourceUse>,
        pathStartTime: Double
    ): BlockAvailabilityInterface.Unavailable? {
        var minimumDelay = 0.0
        var conflictOffset = Offset<Path>(0.meters)
        for (resourceUse in resourceUses) {
            val resourceStartTime = resourceUse.startTime + pathStartTime
            val resourceEndTime = resourceUse.endTime + pathStartTime
            for (scheduledResourceUse in getScheduledResources(infraExplorer, resourceUse)) {
                if (
                    resourceStartTime > scheduledResourceUse.endTime ||
                        resourceEndTime < scheduledResourceUse.startTime
                )
                    continue
                val resourceMinimumDelay = scheduledResourceUse.endTime - resourceStartTime
                if (resourceMinimumDelay > minimumDelay) {
                    minimumDelay = resourceMinimumDelay
                    conflictOffset =
                        if (resourceStartTime <= scheduledResourceUse.startTime) {
                            // The train enters the block before it's unavailable: conflict at end
                            // location
                            resourceUse.endOffset
                        } else {
                            // The train enters the block when it's already unavailable: conflict at
                            // start location
                            resourceUse.startOffset
                        }
                }
            }
        }
        if (minimumDelay == 0.0) return null
        if (java.lang.Double.isFinite(minimumDelay)) {
            // We need to add delay, a recursive call is needed to detect new conflicts
            // that may appear with the added delay
            val recursiveDelay =
                findMinimumDelay(infraExplorer, resourceUses, pathStartTime + minimumDelay)
            if (
                recursiveDelay != null
            ) // The recursive call returns null if there is no new conflict
             minimumDelay += recursiveDelay.duration
        }
        return BlockAvailabilityInterface.Unavailable(minimumDelay, conflictOffset)
    }

    /**
     * Find the maximum amount of delay that can be added to the train without causing conflict.
     * Cannot be called if the train is currently causing a conflict.
     */
    private fun findMaximumDelay(
        infraExplorer: InfraExplorerWithEnvelope,
        resourceUses: List<ResourceUse>,
        pathStartTime: Double,
    ): BlockAvailabilityInterface.Available {
        var maximumDelay = Double.POSITIVE_INFINITY
        var timeOfNextOccupancy = Double.POSITIVE_INFINITY
        for (resourceUse in resourceUses) {
            val resourceStartTime = resourceUse.startTime + pathStartTime
            val resourceEndTime = resourceUse.endTime + pathStartTime
            for (scheduledResourceUse in getScheduledResources(infraExplorer, resourceUse)) {
                if (resourceStartTime >= scheduledResourceUse.endTime)
                    continue // The block is occupied before we enter it
                assert(resourceStartTime <= scheduledResourceUse.startTime)
                val maxDelayForBlock = scheduledResourceUse.startTime - resourceEndTime
                if (maxDelayForBlock < maximumDelay) {
                    maximumDelay = maxDelayForBlock
                    timeOfNextOccupancy = scheduledResourceUse.startTime
                }
            }
        }
        return BlockAvailabilityInterface.Available(maximumDelay, timeOfNextOccupancy)
    }
}
