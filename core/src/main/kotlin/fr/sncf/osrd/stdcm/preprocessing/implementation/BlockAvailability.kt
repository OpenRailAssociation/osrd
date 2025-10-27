package fr.sncf.osrd.stdcm.preprocessing.implementation

import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.conflicts.*
import fr.sncf.osrd.envelope_utils.DoubleBinarySearch
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.standalone_sim.CLOSED_SIGNAL_RESERVATION_MARGIN
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.infra_exploration.LocatedStep
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.math.max
import kotlin.math.min

data class BlockAvailability(
    val incrementalConflictDetector: IncrementalConflictDetector,
    val gridMarginBeforeTrain: Double,
    val gridMarginAfterTrain: Double,
    val internalMarginForSteps: Double,
) : BlockAvailabilityInterface {

    override fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<TrainPath>,
        endOffset: Offset<TrainPath>,
        startTime: Double,
    ): BlockAvailabilityInterface.Availability {
        var timeShift = 0.0
        var firstConflictOffset: Offset<TravelledPath>? = null
        while (timeShift.isFinite()) {
            val shiftedStartTime = startTime + timeShift
            val pathStartTime =
                shiftedStartTime - infraExplorer.interpolateDepartureFromClamp(startOffset)
            val endTime = infraExplorer.interpolateDepartureFromClamp(endOffset) + pathStartTime

            val stepAvailability =
                getStepAvailability(infraExplorer, startOffset, endOffset, pathStartTime)
            val conflictAvailability =
                getConflictAvailability(
                    infraExplorer,
                    startOffset,
                    pathStartTime,
                    shiftedStartTime,
                    endTime,
                )
            val availability =
                getMostRestrictiveAvailability(stepAvailability, conflictAvailability)

            when (availability) {
                is BlockAvailabilityInterface.Available -> {
                    if (
                        timeShift > 0.0
                    ) { // Availability is available due to adding a delay: timeShift
                        return BlockAvailabilityInterface.Unavailable(
                            timeShift,
                            firstConflictOffset ?: startOffset,
                        )
                    }
                    // Availability is directly available without adding any delay
                    return availability
                }
                is BlockAvailabilityInterface.Unavailable -> {
                    timeShift += availability.duration

                    // Only update the conflict offset if it hasn't been set
                    firstConflictOffset = firstConflictOffset ?: availability.firstConflictOffset
                }
            }
        }
        // No available solution with a finite delay was found
        return BlockAvailabilityInterface.Unavailable(
            Double.POSITIVE_INFINITY,
            firstConflictOffset ?: startOffset,
        )
    }

    /**
     * Check that the planned step timing data is respected, i.e. time in
     * [arrivalTime - toleranceBefore - internalMargin, arrivalTime + toleranceAfter + internalMargin].
     * Return the corresponding availability.
     * - If some steps are not respected, find the minimumDelayToBecomeAvailable (subtracting the
     *   internal margin) and return Unavailable(minimumDelayToBecomeAvailable, ...). In case this
     *   delay fails other steps, return Unavailable(Infinity, ...).
     * - If all steps are respected, find the maximumDelayToStayAvailable (adding the internal
     *   margin) and return Available(maximumDelayToStayAvailable, ...).
     */
    private fun getStepAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<TrainPath>,
        endOffset: Offset<TrainPath>,
        pathStartTime: Double,
    ): BlockAvailabilityInterface.Availability {
        var minimumDelayToBecomeAvailable = 0.0
        var firstUnavailabilityOffset = Offset<TravelledPath>(Double.POSITIVE_INFINITY.meters)
        var maximumDelayToStayAvailable = Double.POSITIVE_INFINITY
        var timeOfNextUnavailability = Double.POSITIVE_INFINITY

        val reversedSteps = infraExplorer.getStepTracker().getSeenSteps().reversed()

        for (step in reversedSteps) {
            val availabilityProperties =
                getStepAvailabilityProperties(
                    step,
                    infraExplorer,
                    startOffset,
                    endOffset,
                    pathStartTime,
                ) ?: continue
            if (availabilityProperties.minimumDelayToBecomeAvailable == Double.POSITIVE_INFINITY) {
                return BlockAvailabilityInterface.Unavailable(
                    Double.POSITIVE_INFINITY,
                    availabilityProperties.firstUnavailabilityOffset,
                )
            } else if (
                availabilityProperties.minimumDelayToBecomeAvailable > minimumDelayToBecomeAvailable
            ) {
                minimumDelayToBecomeAvailable = availabilityProperties.minimumDelayToBecomeAvailable
                firstUnavailabilityOffset = availabilityProperties.firstUnavailabilityOffset
            } else if (
                availabilityProperties.maximumDelayToStayAvailable < maximumDelayToStayAvailable
            ) {
                maximumDelayToStayAvailable = availabilityProperties.maximumDelayToStayAvailable
                timeOfNextUnavailability = availabilityProperties.timeOfNextUnavailability
            }
        }
        if (minimumDelayToBecomeAvailable > 0.0) { // At least one planned step was not respected
            if (minimumDelayToBecomeAvailable > maximumDelayToStayAvailable) {
                // Adding minimumDelayToBecomeAvailable will make us step out of another planned
                // step
                return BlockAvailabilityInterface.Unavailable(
                    Double.POSITIVE_INFINITY,
                    firstUnavailabilityOffset,
                )
            }
            // Adding minimumDelayToBecomeAvailable solves every planned step problem
            return BlockAvailabilityInterface.Unavailable(
                minimumDelayToBecomeAvailable,
                firstUnavailabilityOffset,
            )
        }
        // Every planned step was respected
        return BlockAvailabilityInterface.Available(
            maximumDelayToStayAvailable,
            timeOfNextUnavailability,
        )
    }

    private fun getStepAvailabilityProperties(
        step: LocatedStep,
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<TrainPath>,
        endOffset: Offset<TrainPath>,
        pathStartTime: Double,
    ): AvailabilityProperties? {
        val plannedTimingData = step.originalStep.plannedTimingData ?: return null
        if (infraExplorer.getLookahead().any { it.value == step.location.edge }) return null

        val stepPathOffset = step.travelledPathOffset
        if (stepPathOffset !in startOffset..endOffset) return null

        val timeAtStep =
            infraExplorer.interpolateDepartureFromClamp(step.travelledPathOffset) + pathStartTime
        val plannedMinTimeAtStep =
            (plannedTimingData.arrivalTime - plannedTimingData.arrivalTimeToleranceBefore).seconds -
                internalMarginForSteps
        val plannedMaxTimeAtStep =
            (plannedTimingData.arrivalTime + plannedTimingData.arrivalTimeToleranceAfter).seconds +
                internalMarginForSteps
        if (plannedMinTimeAtStep > timeAtStep) {
            // Train passes through planned timing data before it is available
            return AvailabilityProperties(
                max(plannedMinTimeAtStep - timeAtStep, 0.0),
                step.travelledPathOffset,
                0.0,
                0.0,
            )
        } else if (timeAtStep > plannedMaxTimeAtStep) {
            // Train passes through planned timing data after it is available:
            // block is forever unavailable
            return AvailabilityProperties(
                Double.POSITIVE_INFINITY,
                step.travelledPathOffset,
                0.0,
                0.0,
            )
        }
        // Planned timing data respected
        return AvailabilityProperties(
            0.0,
            Offset(0.meters),
            plannedMaxTimeAtStep - timeAtStep,
            plannedMaxTimeAtStep,
        )
    }

    /** Check the conflicts on the given path and return the corresponding availability. */
    private fun getConflictAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<TrainPath>,
        pathStartTime: Double,
        startTime: Double,
        endTime: Double,
    ): BlockAvailabilityInterface.Availability {
        val currentBlockRange = infraExplorer.getCurrentBlockRange()
        val needFullRequirements = startOffset < currentBlockRange.pathBegin
        val spacingRequirements =
            if (needFullRequirements) infraExplorer.getFullSpacingRequirements()
            else infraExplorer.getSpacingRequirements()

        // Ensures that we account for the 20s margin where a train must see a green signal before
        // its departure: when the current segment starts at a stop, we want to consider conflicts
        // up to 20s before the "start time".
        val startsAtStop =
            infraExplorer
                .getStepTracker()
                .getSeenSteps()
                .drop(1) // Skip departure step
                .filter { it.originalStep.stop }
                .map { it.travelledPathOffset }
                .contains(startOffset)
        var minRelevantTime = startTime
        if (startsAtStop) {
            minRelevantTime -= CLOSED_SIGNAL_RESERVATION_MARGIN
        }

        // Modify the spacing requirements to adjust for the start time,
        // and filter out the ones that are outside the relevant time range
        val shiftedSpacingRequirements =
            spacingRequirements
                .map {
                    SpacingRequirement(
                        it.zone,
                        max(pathStartTime + it.beginTime, minRelevantTime),
                        min(pathStartTime + it.endTime, endTime),
                        it.isComplete,
                    )
                }
                .filter { it.beginTime < it.endTime }
        val conflictProperties =
            incrementalConflictDetector.analyseConflicts(shiftedSpacingRequirements)
        when (conflictProperties) {
            is NoConflictResponse -> {
                return BlockAvailabilityInterface.Available(
                    conflictProperties.maxDelayWithoutConflicts,
                    conflictProperties.timeOfNextConflict,
                )
            }
            is ConflictResponse -> {
                val firstConflictOffset =
                    getEnvelopeOffsetFromTime(
                        infraExplorer,
                        conflictProperties.firstConflictTime - pathStartTime,
                    )
                return BlockAvailabilityInterface.Unavailable(
                    conflictProperties.minDelayWithoutConflicts,
                    firstConflictOffset,
                )
            }
        }
    }

    /**
     * Given 2 availabilities, return the most restrictive one:
     * - Unavailable > Available
     * - both are unavailable: take the one with the highest duration necessary to become available
     * - both are available: take the one with the lowest duration necessary to become unavailable
     */
    private fun getMostRestrictiveAvailability(
        firstAvailability: BlockAvailabilityInterface.Availability,
        secondAvailability: BlockAvailabilityInterface.Availability,
    ): BlockAvailabilityInterface.Availability {
        when {
            firstAvailability is BlockAvailabilityInterface.Unavailable &&
                secondAvailability is BlockAvailabilityInterface.Unavailable -> {
                if (firstAvailability.duration >= secondAvailability.duration)
                    return firstAvailability
                return secondAvailability
            }
            firstAvailability is BlockAvailabilityInterface.Available &&
                secondAvailability is BlockAvailabilityInterface.Available -> {
                if (firstAvailability.maximumDelay <= secondAvailability.maximumDelay)
                    return firstAvailability
                return secondAvailability
            }
            firstAvailability is BlockAvailabilityInterface.Unavailable &&
                secondAvailability is BlockAvailabilityInterface.Available -> {
                return firstAvailability
            }
            else -> {
                return secondAvailability
            }
        }
    }

    /**
     * Turns a time into an offset on an envelope with a binary search. Can be optimized if needed.
     */
    private fun getEnvelopeOffsetFromTime(
        explorer: InfraExplorerWithEnvelope,
        time: Double,
    ): Offset<TravelledPath> {
        if (time < 0.0) return Offset(0.meters)
        val envelope = explorer.getFullEnvelope()
        if (time > envelope.totalTime) return explorer.getSimulatedLength()
        val search = DoubleBinarySearch(envelope.beginPos, envelope.endPos, time, 2.0, false)

        // The iteration limit avoids infinite loops when accessing times when the train is stopped
        var i = 0
        var value = 0.0
        while (i++ < 20 && !search.complete()) {
            value = search.input
            search.feedback(envelope.interpolateDepartureFromClamp(search.input))
        }
        return Offset(Distance.fromMeters(value))
    }
}

private data class AvailabilityProperties(
    // If a resource is unavailable, minimum delay that should be added to the train to become
    // available
    val minimumDelayToBecomeAvailable: Double,
    // If a resource is unavailable, offset of that resource
    val firstUnavailabilityOffset: Offset<TravelledPath>,
    // If everything is available, maximum delay that can be added to the train without a resource
    // becoming unavailable
    val maximumDelayToStayAvailable: Double,
    // If everything is available, minimum begin time of the next resource that could become
    // unavailable
    val timeOfNextUnavailability: Double,
)

fun makeBlockAvailability(
    inputSpacingRequirements: Collection<SpacingRequirement>,
    gridMarginBeforeTrain: Double = 0.0,
    gridMarginAfterTrain: Double = 0.0,
    timeStep: Double = 2.0,
): BlockAvailabilityInterface {
    var spacingRequirements = inputSpacingRequirements
    if (gridMarginAfterTrain != 0.0 || gridMarginBeforeTrain != 0.0) {
        // The margin expected *after* the new train is added *before* the other train resource uses
        spacingRequirements =
            spacingRequirements.map {
                SpacingRequirement(
                    it.zone,
                    it.beginTime - gridMarginAfterTrain,
                    it.endTime + gridMarginBeforeTrain,
                    it.isComplete,
                )
            }
    }
    val requirements =
        listOf(
            Requirements(RequirementId("0", RequirementType.TRAIN), spacingRequirements, listOf())
        )

    // Only keep steps with planned timing data
    return BlockAvailability(
        IncrementalConflictDetector(generateSpacingZoneUses(requirements)),
        gridMarginBeforeTrain,
        gridMarginAfterTrain,
        timeStep,
    )
}

fun makeBlockAvailability(
    parsedRequirements: ParsedRequirements,
    gridMarginBeforeTrain: Double = 0.0,
    gridMarginAfterTrain: Double = 0.0,
    timeStep: Double = 2.0,
): BlockAvailabilityInterface {
    var requirements = parsedRequirements
    if (gridMarginAfterTrain != 0.0 || gridMarginBeforeTrain != 0.0) {
        // The margin expected *after* the new train is added *before* the other train resource uses
        val rangeSets = mutableMapOf<ZoneId, RangeSet<Double>>()
        for ((zoneId, map) in parsedRequirements) {
            val set = rangeSets.computeIfAbsent(zoneId) { TreeRangeSet.create() }
            for (range in map.values) {
                set.add(
                    Range.closedOpen(
                        range.lowerEndpoint() - gridMarginAfterTrain,
                        range.upperEndpoint() + gridMarginBeforeTrain,
                    )
                )
            }
        }
        requirements =
            rangeSets
                .map {
                    it.key to TreeMap(it.value.asRanges().associate { it.upperEndpoint() to it })
                }
                .toMap()
    }

    // Only keep steps with planned timing data
    return BlockAvailability(
        IncrementalConflictDetector(requirements),
        gridMarginBeforeTrain,
        gridMarginAfterTrain,
        timeStep,
    )
}
