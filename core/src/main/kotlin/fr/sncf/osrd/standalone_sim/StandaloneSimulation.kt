package fr.sncf.osrd.standalone_sim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.api.api_v2.standalone_sim.*
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.*
import fr.sncf.osrd.envelope_sim.electrification.Electrification
import fr.sncf.osrd.envelope_sim.electrification.Electrified
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.external_generated_inputs.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Run a simulation for a single train. */
fun runStandaloneSimulation(
    infra: FullInfra,
    pathProps: PathProperties,
    chunkPath: ChunkPath,
    routes: StaticIdxList<Route>,
    electricalProfileMap: ElectricalProfileMapping?,
    rollingStock: RollingStock,
    comfort: RollingStock.Comfort,
    constraintDistribution: RJSAllowanceDistribution,
    speedLimitTag: String?,
    powerRestrictions: DistanceRangeMap<String>,
    useElectricalProfiles: Boolean,
    timeStep: Double,
    schedule: List<SimulationScheduleItem>,
    initialSpeed: Double,
    margins: RangeValues<MarginValue>,
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
            useElectricalProfiles
        )
    val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
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
            schedule
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
        )
    val provisionalResult =
        makeSimpleReportTrain(
            infra,
            provisionalEnvelope,
            pathProps,
            rollingStock,
            schedule,
        )
    val finalEnvelopeResult =
        runScheduleMetadataExtractor(
            finalEnvelope,
            pathProps,
            chunkPath,
            infra,
            routes,
            rollingStock,
            schedule
        )

    return SimulationSuccess(
        base = maxEffortResult,
        provisional = provisionalResult,
        finalOutput = finalEnvelopeResult,
        mrsp = makeMRSPResponse(speedLimits),
        electricalProfiles = makeElectricalProfiles(electrificationMap),
    )
}

fun makeElectricalProfiles(
    electrifications: ImmutableRangeMap<Double, Electrification>
): RangeValues<ElectricalProfileValue> {
    fun profileFromElectrification(electrification: Electrification): ElectricalProfileValue {
        return when (electrification) {
            is Electrified -> ElectricalProfileValue.Profile(electrification.mode)
            else -> ElectricalProfileValue.NoProfile()
        }
    }

    // This map is mostly used to coalesce identical values
    val profileMap = TreeRangeMap.create<Double, ElectricalProfileValue>()
    for (electrification in electrifications.asMapOfRanges()) {
        profileMap.putCoalescing(
            Range.closed(electrification.key.lowerEndpoint(), electrification.key.upperEndpoint()),
            profileFromElectrification(electrification.value)
        )
    }

    val boundaries =
        profileMap
            .asMapOfRanges()
            .map { Offset<TravelledPath>(it.key.upperEndpoint().meters) }
            .dropLast(1)
    val values = profileMap.asMapOfRanges().map { it.value }

    return RangeValues(boundaries = boundaries, values = values)
}

fun makeMRSPResponse(speedLimits: Envelope): MRSPResponse {
    val positions = mutableListOf<Offset<Path>>()
    val speeds = mutableListOf<Double>()
    for (point in speedLimits.iteratePoints()) {
        positions.add(Offset(point.position.meters))
        speeds.add(point.speed)
    }
    return MRSPResponse(positions, speeds)
}

/**
 * Build the final envelope from the max effort / provisional envelopes. The final envelope modifies
 * the margin ranges to match the scheduled points.
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
        return provisionalEnvelope.interpolateTotalTimeClamp(offset.distance.meters)
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
        var extraTime = point.arrival.seconds - arrivalTime
        if (extraTime < 0.0) {
            // TODO: raise a warning
            extraTime = 0.0
        }
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
        prevFixedPointOffset = point.pathOffset
        prevFixedPointDepartureTime = arrivalTime + extraTime + (point.stopFor?.seconds ?: 0.0)
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
    fun rangeTime(
        from: Offset<TravelledPath>,
        to: Offset<TravelledPath>,
        envelope: Envelope = provisionalEnvelope
    ): Double {
        assert(from < to)
        val start = envelope.interpolateTotalTimeClamp(from.distance.meters)
        val end = envelope.interpolateTotalTimeClamp(to.distance.meters)
        return end - start
    }
    val rangeEnds = margins.boundaries.filter { it > startOffset && it < endOffset }.toMutableList()
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
    boundaries.addAll(rawMargins.boundaries)
    boundaries.add(Offset(Distance.fromMeters(context.path.length)))
    for (i in 0 until rawMargins.values.size) {
        val start = boundaries[i]
        val end = boundaries[i + 1]
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
