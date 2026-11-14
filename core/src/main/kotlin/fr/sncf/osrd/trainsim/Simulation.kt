package fr.sncf.osrd.trainsim

import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.standalone_sim.CompleteReportTrain
import fr.sncf.osrd.api.standalone_sim.MarginValue
import fr.sncf.osrd.api.standalone_sim.ReportTrain
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.standalone_sim.SimulationSuccess
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.standalone_sim.buildFinalAllowance
import fr.sncf.osrd.standalone_sim.buildSignalingRanges
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeSafetySpeedRanges
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.entries
import fr.sncf.osrd.utils.lowerEndpointOrMin
import fr.sncf.osrd.utils.putLower
import fr.sncf.osrd.utils.simplifyEnvelopePoints
import fr.sncf.osrd.utils.toRangeValues
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.upperEndpointOrMax
import kotlin.math.absoluteValue
import kotlin.math.max
import kotlin.math.min

fun runStandaloneSimulation(
    infra: FullInfra,
    trainPath: TrainPath,
    rollingStock: RollingStock,
    comfort: Comfort,
    speedLimitTag: String?,
    powerRestrictions: OffsetRangeMap<PhysicsPath, String>,
    useElectricalProfiles: Boolean,
    useSpeedLimits: Boolean,
    timeStep: Double,
    schedule: List<SimulationScheduleItem>,
    initialSpeed: Double,
    margins: RangeValues<MarginValue>,
    tracer: Tracer? = null,
): SimulationSuccess {
    val gradients = trainPath.getGradients()
    assert(gradients.fullyCovers(Distance.fromMeters(trainPath.length)))
    tracer?.gradients(gradients)

    val electrificationMap =
        trainPath.getElectrificationMap(
            rollingStock.basePowerClass,
            powerRestrictions,
            rollingStock.powerRestrictions,
            !useElectricalProfiles,
        )
    val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
    val effortCurveMap = curvesAndConditions.curves
    val context = EnvelopeSimContext(rollingStock, trainPath, timeStep, effortCurveMap)

    val constraints = mutableListOf<Constraint>()
    var mrsp: RangeMap<PreciseDistance, PreciseSpeed> = TreeRangeMap.create()
    mrsp.put(Range.all(), rollingStock.maxSpeed.metersPerSecond)
    if (useSpeedLimits) {
        val props = trainPath.getSpeedLimitProperties(speedLimitTag, null)
        for (prop in props) {
            val lower = prop.lower.toPrecise()
            val upper = prop.upper.toPrecise()
            val speed = prop.value.speed.toPrecise()
            if (speed != 0.micrometersPerSecond) {
                mrsp.putLower(Range.closed(lower, upper), speed)
            }
        }
        mrsp = mrsp.withStockLength(rollingStock.length.meters)

        val signalingRanges = buildSignalingRanges(infra, trainPath)
        val safetySpeedRanges = makeSafetySpeedRanges(infra, trainPath, schedule, signalingRanges)
        for (range in safetySpeedRanges) {
            val lower = range.lower.toPrecise()
            val upper = range.upper.toPrecise()
            val speed = range.value.toPrecise()
            mrsp.putLower(Range.closed(lower, upper), speed)
        }
    }

    for (scheduleItem in schedule) {
        val constraint =
            Stop(
                position = scheduleItem.pathOffset.toPrecise(),
                initialDuration = scheduleItem.stopDetails?.duration?.toPrecise() ?: continue,
            )

        if (tracer != null) {
            val trainState =
                TrainState(
                    time = 0.microseconds,
                    position = constraint.position,
                    speed = 0.micrometersPerSecond,
                )
            val curves = constraint.speedCurves(context, trainState)
            for (curve in curves) {
                tracer.speedCurve(constraint, curve)
            }
        }

        constraints.add(constraint)
    }

    for (entry in mrsp.entries) {
        val range = entry.key
        if (range.upperEndpoint() == 0.micrometers) continue
        if (range.lowerEndpoint() >= range.upperEndpoint()) continue
        val speed = entry.value

        val constraint = SpeedLimitedZone(range.lowerEndpoint(), range.upperEndpoint(), speed)

        if (tracer != null) {
            val trainState =
                TrainState(
                    time = 0.microseconds,
                    position = constraint.start,
                    speed = 0.micrometersPerSecond,
                )
            val curves = constraint.speedCurves(context, trainState)
            for (curve in curves) {
                tracer.speedCurve(constraint, curve)
            }
        }

        constraints.add(constraint)
    }

    for (entry in electrificationMap) {
        val lowerPantograph = (entry.value as? Neutral)?.lowerPantograph ?: continue
        val section =
            NeutralSection(
                start = entry.lower.toPrecise(),
                end = entry.upper.toPrecise(),
                lowerPantograph = lowerPantograph,
            )
        constraints.add(section)
    }

    tracer?.runStart("max-effort")

    var trainState = TrainState.zero.copy(speed = initialSpeed.metersPerSecond)
    val maxEffortStates = mutableListOf(trainState)
    while (trainState.position < trainPath.length.meters) {
        val nextTrainState = step(context, constraints, trainState, tracer)
        for (constraint in constraints) {
            if (constraint is Updatable) {
                constraint.update(trainState, nextTrainState)
            }
        }
        trainState = nextTrainState
        maxEffortStates.add(trainState)
    }

    val provisionalStates =
        runMargins(
            allowanceValues =
                distanceRangeMapOf(
                    margins
                        .toDistanceRangeMap(
                            Offset(Distance(0)),
                            Offset(Distance.fromMeters(trainPath.length)),
                        )
                        .map {
                            val margin = it.value
                            DistanceRangeMap.RangeMapEntry(
                                lower = it.lower,
                                upper = it.upper,
                                value =
                                    when (margin) {
                                        is MarginValue.MinPer100Km ->
                                            AllowanceValue.TimePerDistance(margin.value)
                                        is MarginValue.None -> AllowanceValue.Percentage(0.0)
                                        is MarginValue.Percentage ->
                                            AllowanceValue.Percentage(margin.percentage)
                                    },
                            )
                        },
                ),
            maxEffortStates = maxEffortStates,
            context = context,
            tracer = tracer,
            constraints = constraints,
        )

    val finalStates =
        runMargins(
            allowanceValues =
                distanceRangeMapOf(
                    buildFinalAllowance(
                            margins = margins,
                            scheduledPoints = schedule,
                            getMaxEffortTimeAt = { offset ->
                                val r =
                                    maxEffortStates.binarySearchBy(offset.toPrecise()) { state ->
                                        state.position
                                    }
                                val i = if (r >= 0) r else -r - 1
                                maxEffortStates[i].time.seconds
                            },
                            getProvisionalTimeAt = { offset ->
                                val r =
                                    provisionalStates.binarySearchBy(offset.toPrecise()) { state ->
                                        state.position
                                    }
                                val i = if (r >= 0) r else -r - 1
                                provisionalStates[i].time.seconds
                            },
                            timeStep = context.timeStep,
                            pathEnd = Offset(maxEffortStates.last().position.distance),
                        )
                        .map {
                            DistanceRangeMap.RangeMapEntry(
                                lower = Distance.fromMeters(it.beginPos),
                                upper = Distance.fromMeters(it.endPos),
                                value = it.value,
                            )
                        },
                ),
            maxEffortStates = maxEffortStates,
            context = context,
            tracer = tracer,
            constraints = constraints,
        )

    val baseReport = maxEffortStates.toReportTrain(schedule)
    val provisionalReport = provisionalStates.toReportTrain(schedule)
    val finalReport = finalStates.toReportTrain(schedule)

    val completeReport =
        CompleteReportTrain(
            positions = finalReport.positions,
            times = finalReport.times,
            speeds = finalReport.speeds,
            energyConsumption = finalReport.energyConsumption,
            pathItemTimes = finalReport.pathItemTimes,
            signalCriticalPositions = listOf(), // TODO
            zoneUpdates = listOf(), // TODO
            spacingRequirements = listOf(), // TODO
            routingRequirements = listOf(), // TODO
            driverActions = finalReport.driverActions,
        )

    val electrificationRanges =
        ElectrificationRange.from(curvesAndConditions.conditions, electrificationMap)

    return SimulationSuccess(
        base = baseReport,
        provisional = provisionalReport,
        finalOutput = completeReport,
        mrsp =
            mrsp.subRangeMap(Range.closed(0.micrometers, trainPath.length.meters)).toRangeValues {
                speed ->
                SpeedLimitProperty(
                    speed =
                        Speed.fromMetersPerSecond(
                            speed?.metersPerSecond ?: Double.POSITIVE_INFINITY,
                        ),
                    source = null,
                )
            },
        electricalProfiles = makeElectricalProfiles(electrificationRanges),
    )
}

/**
 * Run a provisional simulation given a max-effort one and allowance values.
 *
 * For each allowance range, this tries to find a vMax factor that makes the train respect the
 * allowance. Therefore, sometimes no solution can be found, and the ranges may not be respected.
 *
 * [allowanceValues] is expected to fully cover the path.
 */
fun runMargins(
    allowanceValues: DistanceRangeMap<AllowanceValue>,
    maxEffortStates: List<TrainState>,
    context: EnvelopeSimContext,
    tracer: Tracer?,
    constraints: List<Constraint>,
): List<TrainState> {
    val marginStates = mutableListOf(TrainState.zero)

    allowanceValues.forEach { lower, upper, allowanceValue ->
        // Because we expect allowanceValues to fully cover the path, we can start from the last
        // state.
        val iMarginLo = marginStates.size - 1

        /** Index in [maxEffortStates] of the *last* state that is at position [lower] */
        var iMaxEffLo = maxEffortStates.binarySearch(lower.toPrecise())
        while (
            iMaxEffLo + 1 < maxEffortStates.size &&
                maxEffortStates[iMaxEffLo + 1].position == lower.toPrecise()
        ) {
            iMaxEffLo++
        }

        /** Index in [maxEffortStates] of the *first* state that is at position [upper] */
        var iMaxEffHi = maxEffortStates.binarySearch(upper.toPrecise())
        while (iMaxEffHi > 0 && maxEffortStates[iMaxEffHi - 1].position == upper.toPrecise()) {
            iMaxEffHi--
        }

        val iMarginHiPrev = max(iMarginLo - 1, 0)

        var iMaxEffHiPrev = max(iMaxEffLo - 1, 0)
        while (
            iMaxEffHiPrev > 0 && maxEffortStates[iMaxEffHiPrev - 1].position == lower.toPrecise()
        ) {
            iMaxEffHiPrev--
        }

        /** Time it takes for the max-effort simulation to go from [lower] to [upper] */
        // TODO maxEffortStates[iMaxEffHi].position may not be equal to upper
        val maxEffTime = maxEffortStates[iMaxEffHi].time - maxEffortStates[iMaxEffLo].time

        check(marginStates[iMarginLo].position == lower.toPrecise())
        check(maxEffortStates[iMaxEffLo].position == lower.toPrecise())
        check(maxEffortStates[iMaxEffHi].position == upper.toPrecise())

        if (allowanceValue.isNone(maxEffTime.seconds)) {
            // The binary search below doesn't work when there is no margin.

            if (marginStates[iMarginHiPrev] == maxEffortStates[iMaxEffHiPrev]) {
                for (i in iMaxEffLo..iMaxEffHi) {
                    marginStates.add(maxEffortStates[i])
                }
                return@forEach
            }

            tracer?.runStart("provisional-lower=$lower-upper=$upper-vmaxfactor=1")

            context.driver.vMaxFactor = 1.0

            for (constraint in constraints) {
                if (constraint is Updatable) {
                    constraint.reset()
                }
            }

            var trainState = marginStates.last()
            while (trainState.position < upper.toPrecise()) {
                val nextTrainState = step(context, constraints, trainState, tracer)
                for (constraint in constraints) {
                    if (constraint is Updatable) {
                        constraint.update(trainState, nextTrainState)
                    }
                }
                trainState = nextTrainState
                marginStates.add(trainState)
            }

            return@forEach
        }

        val distance = upper - lower
        val allowanceTime =
            allowanceValue.getAllowanceTime(maxEffTime.seconds, distance.meters).seconds
        val marginTime = maxEffTime + allowanceTime

        // Binary search to find the [vMaxFactor] that makes the train take [marginTime] to go from
        // [lower] to [upper].
        val states = mutableListOf<TrainState>()
        var vMaxFactorMin = 0.0
        var vMaxFactorMax = 1.0
        var prevTrialTime = PreciseDuration(microseconds = Long.MAX_VALUE)
        while (true) {
            val vMaxFactor = (vMaxFactorMax + vMaxFactorMin) / 2.0
            context.driver.vMaxFactor = vMaxFactor

            val initialTrainState = marginStates.last()
            var trainState = initialTrainState
            states.clear()

            for (constraint in constraints) {
                if (constraint is Updatable) {
                    constraint.reset()
                }
            }

            tracer?.runStart("provisional-lower=$lower-upper=$upper-vmaxfactor=$vMaxFactor")

            while (trainState.position < upper.toPrecise()) {
                val nextTrainState = step(context, constraints, trainState, tracer)
                for (constraint in constraints) {
                    if (constraint is Updatable) {
                        constraint.update(trainState, nextTrainState)
                    }
                }
                trainState = nextTrainState
                states.add(trainState)
            }

            val trialTime = states.last().time - initialTrainState.time
            val timeDiff = (trialTime - marginTime).seconds.absoluteValue
            val trialTimeDiff = (trialTime - prevTrialTime).seconds.absoluteValue
            if (timeDiff < context.timeStep / 2.0 || trialTimeDiff < context.timeStep / 2.0) {
                // Either we're close to the requested time, or we're not evolving anymore
                break
            } else if (trialTime < marginTime) {
                vMaxFactorMax = vMaxFactor
            } else {
                vMaxFactorMin = vMaxFactor
            }

            prevTrialTime = trialTime
        }

        marginStates.addAll(states)
    }

    context.driver.vMaxFactor = 1.0

    return marginStates
}

internal fun List<TrainState>.toReportTrain(
    schedule: List<SimulationScheduleItem>,
): ReportTrain {
    val simplifiedPoints = simplifyEnvelopePoints(map { it.toEnvelopePoint() }, 5.0, 0.2)

    return ReportTrain(
        positions = simplifiedPoints.map { point -> Offset(Distance.fromMeters(point.position)) },
        times = simplifiedPoints.map { point -> Duration.fromSeconds(point.time) },
        speeds = simplifiedPoints.map { point -> point.speed },
        energyConsumption = 0.0, // TODO
        pathItemTimes =
            schedule.map { scheduleItem ->
                val position = scheduleItem.pathOffset.meters
                var res = simplifiedPoints.binarySearchBy(position) { point -> point.position }
                if (res < 0) {
                    res = -res - 1
                }
                while (res > 0 && simplifiedPoints[res - 1].position == position) {
                    res--
                }
                Duration.fromSeconds(simplifiedPoints[res].time)
            },
        driverActions = RangeValues(), // TODO
    )
}

fun List<TrainState>.binarySearch(position: PreciseDistance): Int {
    val i = binarySearch { it.position compareTo position }
    return if (i >= 0) {
        i
    } else {
        min(-i - 1, size - 1)
    }
}

/**
 * Update a [RangeMap] representing a Speed Profile, accounting for the length of the rolling stock.
 *
 * The given [RangeMap] contains the ranges on the path with speed limits (indicated by signs or
 * signals). The returned [RangeMap] will report, for given positions of the rolling stock's head,
 * ranges on the path where the rolling stock cannot exceed a certain speed limit, because even if
 * pass the sign, as long as its tail is behind the sign the speed limit is still enforced.
 */
internal fun RangeMap<PreciseDistance, PreciseSpeed>.withStockLength(
    stockLength: PreciseDistance,
): RangeMap<PreciseDistance, PreciseSpeed> {
    val map = TreeRangeMap.create<PreciseDistance, PreciseSpeed>()
    for (entry in asMapOfRanges()) {
        val range = entry.key
        val speedLimit = entry.value

        val extendedRange =
            Range.closed(
                range.lowerEndpointOrMin(),
                range.upperEndpointOrMax() saturatingAdd stockLength,
            )
        map.putLower(extendedRange, speedLimit)
    }
    return map
}
