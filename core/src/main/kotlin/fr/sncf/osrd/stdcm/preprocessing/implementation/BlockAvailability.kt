package fr.sncf.osrd.stdcm.preprocessing.implementation

import fr.sncf.osrd.api.ConflictDetectionEndpoint
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.conflicts.IncrementalConflictDetector
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import java.util.Collections.max

data class BlockAvailability(
    val fullInfra: FullInfra,
    val incrementalConflictDetector: IncrementalConflictDetector
) : BlockAvailabilityInterface {

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): BlockAvailabilityInterface.Availability {
        val spacingRequirements = infraExplorer.getSpacingRequirements()
        val pathStartTime = startTime - infraExplorer.interpolateTimeClamp(startOffset)
        val shiftedSpacingRequirements =
            shiftSpacingRequirements(spacingRequirements, pathStartTime)
        val conflicts =
            incrementalConflictDetector.checkConflicts(shiftedSpacingRequirements, listOf())
        if (conflicts.isEmpty()) {
            val maximumDelay =
                incrementalConflictDetector.maxDelayWithoutConflicts(
                    shiftedSpacingRequirements,
                    listOf()
                )
            val timeOfNextConflict =
                incrementalConflictDetector.timeOfNextConflict(shiftedSpacingRequirements, listOf())
            return BlockAvailabilityInterface.Available(maximumDelay, timeOfNextConflict)
        } else {
            val minimumDelay = findMinimumDelay(conflicts, shiftedSpacingRequirements)
            val firstConflictOffset =
                getEnvelopeOffsetFromTime(infraExplorer, conflicts.first().startTime)
            return BlockAvailabilityInterface.Unavailable(minimumDelay, firstConflictOffset)
        }
    }

    /** Find the minimum delay needed to avoid any conflict. */
    private fun findMinimumDelay(
        conflicts: List<ConflictDetectionEndpoint.ConflictDetectionResult.Conflict>,
        spacingRequirements: List<SpacingRequirement>
    ): Double {
        var globalMinimumDelay = 0.0
        var recConflicts = conflicts.toMutableList()
        while (recConflicts.isNotEmpty() && globalMinimumDelay.isFinite()) {
            val minimumDelay = max(conflicts.map { it.endTime - it.startTime })
            val recSpacingRequirements = shiftSpacingRequirements(spacingRequirements, minimumDelay)
            recConflicts =
                incrementalConflictDetector
                    .checkConflicts(recSpacingRequirements, listOf())
                    .toMutableList()
            globalMinimumDelay += minimumDelay
        }
        return globalMinimumDelay
    }

    /**
     * Turns a time into an offset on an envelope with a binary search. Can be optimized if needed.
     */
    private fun getEnvelopeOffsetFromTime(
        explorer: InfraExplorerWithEnvelope,
        time: Double
    ): Offset<Path> {
        val envelope = explorer.getFullEnvelope()
        val search = DoubleBinarySearch(envelope.beginPos, envelope.endPos, time, 2.0, false)
        while (!search.complete()) search.feedback(envelope.interpolateTotalTimeClamp(search.input))
        return explorer
            .getIncrementalPath()
            .fromTravelledPath(Offset(Distance.fromMeters(search.result)))
    }

    /** Clone and add time to spacing requirements. */
    private fun shiftSpacingRequirements(
        spacingRequirements: List<SpacingRequirement>,
        time: Double
    ): List<SpacingRequirement> {
        return spacingRequirements.toMutableList().onEach {
            it.beginTime += time
            it.endTime += time
        }
    }
}
