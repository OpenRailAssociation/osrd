package fr.sncf.osrd.standalone_sim

import com.google.common.collect.Range
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.DriverBehaviour
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.standalone_sim.ElectricalProfileValue
import fr.sncf.osrd.api.standalone_sim.MarginValue
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.standalone_sim.SimulationSuccess
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.Percentage
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.TimePerDistance
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.envelope_sim_infra.HasMissingSpeedTag
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.reporting.exceptions.ErrorType.ZeroLengthPath
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage.ElectrifiedUsage
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.entries
import fr.sncf.osrd.utils.toRangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import fr.sncf.osrd.utils.values
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val standaloneSimLogger: Logger = LoggerFactory.getLogger("StandaloneSimulation")

/** Run a simulation for a single train. */
fun runStandaloneSimulation(
    infra: FullInfra,
    trainPath: TrainPath,
    rollingStock: RollingStock,
    comfort: Comfort,
    constraintDistribution: RJSAllowanceDistribution,
    speedLimitTag: String?,
    powerRestrictions: DistanceRangeMap<String>,
    useElectricalProfiles: Boolean,
    useSpeedLimits: Boolean,
    timeStep: Double,
    schedule: List<SimulationScheduleItem>,
    initialSpeed: Double,
    margins: RangeValues<MarginValue>,
    pathItemPositions: List<Offset<TravelledPath>>,
    driverBehaviour: DriverBehaviour = DriverBehaviour(),
): SimulationSuccess {
    if (trainPath.getLength() == 0.meters) throw OSRDError(ZeroLengthPath)
    val signalingRanges = buildSignalingRanges(infra, trainPath)
    // MRSP & SpeedLimits
    val safetySpeedRanges = makeSafetySpeedRanges(infra, trainPath, schedule, signalingRanges)
    var mrsp =
        computeMRSP(
            trainPath,
            rollingStock,
            true,
            speedLimitTag,
            null,
            safetySpeedRanges,
            useSpeedLimits,
        )
    mrsp = driverBehaviour.applyToMRSP(mrsp, signalingRanges)
    // We don't use speed safety ranges in the MRSP displayed in the front
    // (just like we don't add the train length)
    val speedLimits =
        computeMRSP(trainPath, rollingStock, false, speedLimitTag, null, null, useSpeedLimits)

    // Build paths and contexts
    val powerRestrictionsLegacyMap = powerRestrictions.toRangeMap()
    val electrificationMap =
        trainPath.getElectrificationMap(
            rollingStock.basePowerClass,
            powerRestrictionsLegacyMap,
            rollingStock.powerRestrictions,
            !useElectricalProfiles,
        )
    val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
    val electrificationRanges =
        ElectrificationRange.from(curvesAndConditions.conditions, electrificationMap)
    var context =
        EnvelopeSimContext(
            rollingStock,
            trainPath,
            timeStep,
            curvesAndConditions.curves,
            makeETCSContext(rollingStock, infra, trainPath, signalingRanges),
        )

    // Max speed envelope
    val simStops = getSimStops(schedule)
    val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, simStops, mrsp)

    // Add neutral sections
    context =
        context.updateCurves(
            rollingStock.addNeutralSystemTimes(
                electrificationMap,
                comfort,
                context.tractiveEffortCurveMap,
            )
        )

    // Max effort envelope : the train goes as fast as possible
    val maxEffortEnvelope = maxEffortEnvelopeFrom(context, initialSpeed, maxSpeedEnvelope)
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
            maxEffortEnvelope,
            trainPath,
            rollingStock,
            schedule,
            pathItemPositions,
        )
    val provisionalResult =
        makeSimpleReportTrain(
            provisionalEnvelope,
            trainPath,
            rollingStock,
            schedule,
            pathItemPositions,
        )
    val finalEnvelopeResult =
        runScheduleMetadataExtractor(
            finalEnvelope,
            trainPath,
            // TODO path migration
            infra,
            rollingStock,
            schedule,
            pathItemPositions,
            context,
        )

    return SimulationSuccess(
        base = maxEffortResult,
        provisional = provisionalResult,
        finalOutput = finalEnvelopeResult,
        mrsp = makeMRSPResponse(speedLimits),
        electricalProfiles = makeElectricalProfiles(electrificationRanges),
    )
}

/** Returns the ranges where each signaling system is encountered. */
fun buildSignalingRanges(infra: FullInfra, trainPath: TrainPath): DistanceRangeMap<String> {
    val blockInfra = infra.blockInfra
    val res = distanceRangeMapOf<String>()
    for (blockRange in trainPath.getBlocks()) {
        val sigSystem = blockInfra.getBlockSignalingSystem(blockRange.value)
        val sigSystemName = infra.signalingSimulator.sigModuleManager.getName(sigSystem)
        res.put(blockRange.pathBegin.distance, blockRange.pathEnd.distance, sigSystemName)
    }
    return res
}

fun makeElectricalProfiles(
    electrificationRanges: List<ElectrificationRange>
): RangeValues<ElectricalProfileValue> {
    fun profileFromElectrification(electrification: ElectrificationUsage): ElectricalProfileValue {
        return when (electrification) {
            is ElectrifiedUsage ->
                ElectricalProfileValue.Profile(
                    electrification.profile,
                    electrification.profileHandled,
                )
            else -> ElectricalProfileValue.NoProfile()
        }
    }

    // This map is mostly used to coalesce identical values
    val profileMap = TreeRangeMap.create<Double, ElectricalProfileValue>()
    for (electrification in electrificationRanges) {
        profileMap.putCoalescing(
            Range.closed(electrification.start, electrification.stop),
            profileFromElectrification(electrification.electrificationUsage),
        )
    }

    val boundaries =
        profileMap.entries.map { Offset<TravelledPath>(it.key.upperEndpoint().meters) }.dropLast(1)
    val values = profileMap.values

    return RangeValues(internalBoundaries = boundaries, values = values.toList())
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
        var attr = part.getAttr(SpeedLimitSource::class.java)
        if (part.getAttr(HasMissingSpeedTag::class.java) != null) {
            // HasMissingSpeedTag is a special flag that enforces `UnknownTag` even if the speed
            // limit comes from a defined source (e.g. rolling stock max speed). This ensures we
            // never lose that important piece of information.
            // TODO: change the API with better semantics to properly handle missing tags
            attr = SpeedLimitSource.UnknownTag()
        }
        sources.add(SpeedLimitProperty(part.beginSpeed.metersPerSecond, attr))
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
    scheduledPoints: List<SimulationScheduleItem>,
): Envelope {
    fun getEnvelopeTimeAt(offset: Offset<TravelledPath>): Double {
        return provisionalEnvelope.interpolateDepartureFromClamp(offset.meters)
    }
    fun getMaxEffortEnvelopeTimeAt(offset: Offset<TravelledPath>): Double {
        return maxEffortEnvelope.interpolateDepartureFromClamp(offset.meters)
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
                    point.pathOffset,
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
                    prevFixedPointOffset.meters,
                    point.pathOffset.meters,
                    FixedTime(maxEffortExtraTime),
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
                pathEnd,
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
    endOffset: Offset<TravelledPath>,
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
        envelope: Envelope = provisionalEnvelope,
    ): Double {
        assert(from < to)
        val start = envelope.interpolateDepartureFromClamp(from.meters)
        val end = envelope.interpolateDepartureFromClamp(to.meters)
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
                rangeStart.meters,
                rangeEnd.meters,
                FixedTime(baseAllowanceValue + extraTime * ratio),
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
    constraintDistribution: RJSAllowanceDistribution,
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
        marginRanges.add(AllowanceRange(start.meters, end.meters, value))
    }
    val margin =
        if (constraintDistribution == RJSAllowanceDistribution.MARECO)
            MarecoAllowance(0.0, maxEffortEnvelope.endPos, 1.0, marginRanges)
        else LinearAllowance(0.0, maxEffortEnvelope.endPos, 0.0, marginRanges)
    return margin.apply(maxEffortEnvelope, context)
}

fun getSimStops(schedule: List<SimulationScheduleItem>): List<SimStop> {
    return schedule.filter { it.stopFor != null }.map { SimStop(it.pathOffset, it.receptionSignal) }
}
