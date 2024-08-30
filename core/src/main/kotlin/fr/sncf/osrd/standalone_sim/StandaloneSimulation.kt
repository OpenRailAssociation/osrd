package fr.sncf.osrd.standalone_sim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.api.api_v2.standalone_sim.ElectricalProfileValue
import fr.sncf.osrd.api.api_v2.standalone_sim.MarginValue
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationSuccess
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.external_generated_inputs.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage.ElectrifiedUsage
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val standaloneSimLogger: Logger = LoggerFactory.getLogger("StandaloneSimulation")

/** Run a simulation for a single train. */
fun runStandaloneSimulation(
    infra: FullInfra,
    pathProps: PathProperties,
    chunkPath: ChunkPath,
    routes: StaticIdxList<Route>,
    electricalProfileMap: ElectricalProfileMapping?,
    rollingStock: RollingStock,
    comfort: Comfort,
    constraintDistribution: RJSAllowanceDistribution,
    speedLimitTag: String?,
    powerRestrictions: DistanceRangeMap<String>,
    useElectricalProfiles: Boolean,
    timeStep: Double,
    schedule: List<SimulationScheduleItem>,
    initialSpeed: Double,
    margins: RangeValues<MarginValue>,
    pathItemPositions: List<Offset<Path>>
): SimulationSuccess {
    // MRSP & SpeedLimits
    val mrsp = MRSP.computeMRSP(pathProps, rollingStock, true, speedLimitTag)
    val speedLimits = MRSP.computeMRSP(pathProps, rollingStock, false, speedLimitTag)

    // Build paths and contexts
    val envelopeSimPath = EnvelopeTrainPath.from(infra.rawInfra, pathProps, electricalProfileMap)
    val powerRestrictionsLegacyMap = powerRestrictions.toRangeMap()
    val electrificationMap =
        envelopeSimPath.getElectrificationMap(
            rollingStock.basePowerClass,
            powerRestrictionsLegacyMap,
            rollingStock.powerRestrictions,
            !useElectricalProfiles
        )
    val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
    val electrificationRanges =
        ElectrificationRange.from(curvesAndConditions.conditions, electrificationMap)
    var context =
        EnvelopeSimContext(rollingStock, envelopeSimPath, timeStep, curvesAndConditions.curves)

    // Max speed envelope
    val stopPositions = getStopPositions(schedule)
    val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stopPositions.toDoubleArray(), mrsp)

    // Add neutral sections
    context =
        context.updateCurves(
            rollingStock.addNeutralSystemTimes(
                electrificationMap,
                comfort,
                maxSpeedEnvelope,
                context.tractiveEffortCurveMap
            )
        )

    // Max effort envelope : the train goes as fast as possible
    val maxEffortEnvelope = MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope)
    // Provisional envelope: the train matches the standard allowances
    val provisionalEnvelope =
        if (margins.values.isEmpty()) maxEffortEnvelope
        else buildProvisionalEnvelope(maxEffortEnvelope, context, margins, constraintDistribution)
    // Final envelope: the train matches the standard allowances and given scheduled points
    val finalEnvelope =
        buildFinalEnvelope(
            maxEffortEnvelope,
            provisionalEnvelope,
            context,
            margins,
            constraintDistribution,
            schedule,
        )

    // Extract all kinds of metadata from the simulation,
    // and return a result matching the expected response format
    val maxEffortResult =
        makeSimpleReportTrain(
            infra,
            maxEffortEnvelope,
            pathProps,
            rollingStock,
            schedule,
            pathItemPositions,
        )
    val provisionalResult =
        makeSimpleReportTrain(
            infra,
            provisionalEnvelope,
            pathProps,
            rollingStock,
            schedule,
            pathItemPositions,
        )
    val finalEnvelopeResult =
        runScheduleMetadataExtractor(
            finalEnvelope,
            pathProps,
            chunkPath,
            infra,
            routes,
            rollingStock,
            schedule,
            pathItemPositions,
        )

    return SimulationSuccess(
        base = maxEffortResult,
        provisional = provisionalResult,
        finalOutput = finalEnvelopeResult,
        mrsp = makeMRSPResponse(speedLimits),
        electricalProfiles = makeElectricalProfiles(electrificationRanges),
    )
}

fun makeElectricalProfiles(
    electrificationRanges: List<ElectrificationRange>
): RangeValues<ElectricalProfileValue> {
    fun profileFromElectrification(electrification: ElectrificationUsage): ElectricalProfileValue {
        return when (electrification) {
            is ElectrifiedUsage ->
                ElectricalProfileValue.Profile(
                    electrification.profile,
                    electrification.profileHandled
                )
            else -> ElectricalProfileValue.NoProfile()
        }
    }

    // This map is mostly used to coalesce identical values
    val profileMap = TreeRangeMap.create<Double, ElectricalProfileValue>()
    for (electrification in electrificationRanges) {
        profileMap.putCoalescing(
            Range.closed(electrification.start, electrification.stop),
            profileFromElectrification(electrification.electrificationUsage)
        )
    }

    val boundaries =
        profileMap
            .asMapOfRanges()
            .map { Offset<TravelledPath>(it.key.upperEndpoint().meters) }
            .dropLast(1)
    val values = profileMap.asMapOfRanges().map { it.value }

    return RangeValues(internalBoundaries = boundaries, values = values)
}

fun makeMRSPResponse(speedLimits: Envelope): RangeValues<SpeedLimitProperty> {
    val internalBoundaries = mutableListOf<Offset<TravelledPath>>()
    val sources = mutableListOf<SpeedLimitProperty>()
    for (part in speedLimits.stream()) {
        internalBoundaries.add(Offset(part.endPos.meters))
        // Check that the part only holds one constant speed-limit (as source is unique per part)
        assert(
            part.getAttr(EnvelopeProfile::class.java) == EnvelopeProfile.CONSTANT_SPEED &&
                part.pointCount() == 2 &&
                part.minSpeed == part.maxSpeed
        ) {
            "Each MRSP envelope-part can contain only one speed-limit range"
        }
        sources.add(
            SpeedLimitProperty(
                part.beginSpeed.metersPerSecond,
                part.getAttr(SpeedLimitSource::class.java)
            )
        )
    }
    internalBoundaries.removeLast()
    return RangeValues(internalBoundaries, sources)
}

/**
 * Build the final envelope from the max effort / provisional envelopes. The final envelope modifies
 * the margin ranges to match the scheduled points. The added time is distributed over the different
 * margin ranges, following a logic described in details on the OSRD website:
 * https://osrd.fr/en/docs/reference/design-docs/timetable/#combining-margins-and-schedule
 */
fun buildFinalEnvelope(
    maxEffortEnvelope: Envelope,
    provisionalEnvelope: Envelope,
    context: EnvelopeSimContext,
    margins: RangeValues<MarginValue>,
    allowanceType: RJSAllowanceDistribution,
    scheduledPoints: List<SimulationScheduleItem>
): Envelope {
    fun getEnvelopeTimeAt(offset: Offset<TravelledPath>): Double {
        return provisionalEnvelope.interpolateDepartureFromClamp(offset.distance.meters)
    }
    fun getMaxEffortEnvelopeTimeAt(offset: Offset<TravelledPath>): Double {
        return maxEffortEnvelope.interpolateDepartureFromClamp(offset.distance.meters)
    }
    var prevFixedPointOffset = Offset<TravelledPath>(0.meters)
    var prevFixedPointDepartureTime = 0.0
    val marginRanges = mutableListOf<AllowanceRange>()
    for (point in scheduledPoints) {
        if (point.arrival == null) {
            // No specified arrival time,
            // we account for the stop duration and move on
            prevFixedPointDepartureTime += point.stopFor?.seconds ?: 0.0
            continue
        }
        val sectionTime =
            getEnvelopeTimeAt(point.pathOffset) - getEnvelopeTimeAt(prevFixedPointOffset)
        val arrivalTime = prevFixedPointDepartureTime + sectionTime
        val extraTime = point.arrival.seconds - arrivalTime
        if (extraTime >= 0.0) {
            marginRanges.addAll(
                distributeAllowance(
                    maxEffortEnvelope,
                    provisionalEnvelope,
                    extraTime,
                    margins,
                    prevFixedPointOffset,
                    point.pathOffset
                )
            )
            prevFixedPointDepartureTime = arrivalTime + extraTime + (point.stopFor?.seconds ?: 0.0)
        } else {
            // We need to *remove* time compared to the provisional envelope.
            // Ideally we would distribute the (negative) extra time following the same logic as
            // when it's positive. But this is tricky: as we get closer to max effort envelope (hard
            // limit), we need to redistribute the time in some cases.
            // We currently handle this by ignoring the distribution over different margin ranges,
            // we just set the time for the scheduled point without more details. It will be easier
            // to handle it properly when we'll have migrated to standalone sim v3.
            val maxEffortSectionTime =
                getMaxEffortEnvelopeTimeAt(point.pathOffset) -
                    getMaxEffortEnvelopeTimeAt(prevFixedPointOffset)
            val earliestPossibleArrival = prevFixedPointDepartureTime + maxEffortSectionTime
            var maxEffortExtraTime = point.arrival.seconds - earliestPossibleArrival
            if (maxEffortExtraTime < 0.0) {
                standaloneSimLogger.warn("impossible scheduled point")
                // TODO: raise warning: scheduled point isn't possible
                maxEffortExtraTime = 0.0
            } else {
                standaloneSimLogger.warn("scheduled point doesn't follow standard allowance")
                // TODO: raise warning: scheduled point doesn't follow standard allowance
            }
            marginRanges.add(
                AllowanceRange(
                    prevFixedPointOffset.distance.meters,
                    point.pathOffset.distance.meters,
                    FixedTime(maxEffortExtraTime)
                )
            )
            prevFixedPointDepartureTime =
                earliestPossibleArrival + maxEffortExtraTime + (point.stopFor?.seconds ?: 0.0)
        }
        prevFixedPointOffset = point.pathOffset
    }
    val pathEnd = Offset<TravelledPath>(maxEffortEnvelope.endPos.meters)
    if (prevFixedPointOffset < pathEnd) {
        // Because the last margin call is based on the max effort envelope,
        // we still need to cover all ranges to keep the standard margin,
        // with 0 extra time compared to the provisional envelope
        marginRanges.addAll(
            distributeAllowance(
                maxEffortEnvelope,
                provisionalEnvelope,
                0.0,
                margins,
                prevFixedPointOffset,
                pathEnd
            )
        )
    }
    val margin =
        if (allowanceType == RJSAllowanceDistribution.MARECO)
            MarecoAllowance(0.0, maxEffortEnvelope.endPos, 1.0, marginRanges)
        else LinearAllowance(0.0, maxEffortEnvelope.endPos, 0.0, marginRanges)
    return margin.apply(maxEffortEnvelope, context)
}

/**
 * Distributes the extra time in the given path section. The time is distributed across the standard
 * margin ranges, proportionally to the time spent in each range (with the margin applied). See
 * https://osrd.fr/en/docs/reference/design-docs/timetable/#combining-margins-and-schedule for more
 * details.
 *
 * Returns a list of margin ranges to be added to a final margin computation, covering the given
 * section.
 */
fun distributeAllowance(
    maxEffortEnvelope: Envelope,
    provisionalEnvelope: Envelope,
    extraTime: Double,
    margins: RangeValues<MarginValue>,
    startOffset: Offset<TravelledPath>,
    endOffset: Offset<TravelledPath>
): List<AllowanceRange> {
    assert(startOffset <= endOffset)
    if (startOffset == endOffset) {
        // TODO: raise warning (overlapping scheduled points)
        standaloneSimLogger.error("different scheduled points at the same location ($startOffset)")
        return listOf()
    }
    fun rangeTime(
        from: Offset<TravelledPath>,
        to: Offset<TravelledPath>,
        envelope: Envelope = provisionalEnvelope
    ): Double {
        assert(from < to)
        val start = envelope.interpolateDepartureFromClamp(from.distance.meters)
        val end = envelope.interpolateDepartureFromClamp(to.distance.meters)
        return end - start
    }
    val rangeEnds =
        margins.internalBoundaries.filter { it > startOffset && it < endOffset }.toMutableList()
    rangeEnds.add(endOffset)
    val res = mutableListOf<AllowanceRange>()
    val baseTotalTime = rangeTime(startOffset, endOffset)
    var rangeStart = startOffset
    for (rangeEnd in rangeEnds) {
        val baseRangeTime = rangeTime(rangeStart, rangeEnd)
        val ratio = baseRangeTime / baseTotalTime
        val baseAllowanceValue =
            rangeTime(rangeStart, rangeEnd) - rangeTime(rangeStart, rangeEnd, maxEffortEnvelope)
        res.add(
            AllowanceRange(
                rangeStart.distance.meters,
                rangeEnd.distance.meters,
                FixedTime(baseAllowanceValue + extraTime * ratio)
            )
        )
        rangeStart = rangeEnd
    }
    return res
}

/**
 * Build the provisional envelope based on the max effort envelope, adding the standard margin
 * ranges.
 */
fun buildProvisionalEnvelope(
    maxEffortEnvelope: Envelope,
    context: EnvelopeSimContext,
    rawMargins: RangeValues<MarginValue>,
    constraintDistribution: RJSAllowanceDistribution
): Envelope {
    val marginRanges = mutableListOf<AllowanceRange>()
    // Add path extremities to boundaries
    val boundaries = mutableListOf<Offset<TravelledPath>>()
    boundaries.add(Offset(Distance.ZERO))
    boundaries.addAll(rawMargins.internalBoundaries)
    boundaries.add(Offset(Distance.fromMeters(context.path.length)))
    for (i in 0 until rawMargins.values.size) {
        val start = boundaries[i]
        val end = boundaries[i + 1]
        if (start == end) {
            standaloneSimLogger.warn("Zero-length margin range at offset $start (skipping)")
            // TODO: raise warning
            continue
        }
        val value =
            when (val rawValue = rawMargins.values[i]) {
                is MarginValue.MinPer100Km -> TimePerDistance(rawValue.value)
                is MarginValue.Percentage -> Percentage(rawValue.percentage)
                is MarginValue.None -> Percentage(0.0)
            }
        marginRanges.add(AllowanceRange(start.distance.meters, end.distance.meters, value))
    }
    val margin =
        if (constraintDistribution == RJSAllowanceDistribution.MARECO)
            MarecoAllowance(0.0, maxEffortEnvelope.endPos, 1.0, marginRanges)
        else LinearAllowance(0.0, maxEffortEnvelope.endPos, 0.0, marginRanges)
    return margin.apply(maxEffortEnvelope, context)
}

fun getStopPositions(schedule: List<SimulationScheduleItem>): List<Double> {
    return schedule.filter { it.stopFor != null }.map { it.pathOffset.distance.meters }
}

/**
 * Converts a DistanceRangeMap<T> into a legacy RangeMap<Double, T>. Distances are converted to
 * floats (m).
 */
private fun <T> DistanceRangeMap<T>.toRangeMap(): RangeMap<Double, T> {
    val res = ImmutableRangeMap.builder<Double, T>()
    for (entry in this) {
        if (entry.value != null)
            res.put(Range.closed(entry.lower.meters, entry.upper.meters), entry.value!!)
    }
    return res.build()
}
