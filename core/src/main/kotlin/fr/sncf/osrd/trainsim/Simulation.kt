package fr.sncf.osrd.trainsim

import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.DriverBehaviour
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.standalone_sim.CompleteReportTrain
import fr.sncf.osrd.api.standalone_sim.MarginValue
import fr.sncf.osrd.api.standalone_sim.ReportTrain
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.standalone_sim.SimulationSuccess
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.standalone_sim.buildSignalingRanges
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeSafetySpeedRanges
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.entries
import fr.sncf.osrd.utils.simplifyEnvelopePoints
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import kotlin.math.absoluteValue
import kotlin.math.max
import kotlin.math.min

fun runSimulation(
    infra: FullInfra,
    trainPath: TrainPath,
    rollingStock: RollingStock,
    comfort: Comfort,
    constraintDistribution: RJSAllowanceDistribution,
    speedLimitTag: String?,
    powerRestrictions: OffsetRangeMap<PhysicsPath, String>,
    useElectricalProfiles: Boolean,
    useSpeedLimits: Boolean,
    timeStep: Double,
    schedule: List<SimulationScheduleItem>,
    initialSpeed: Double,
    margins: RangeValues<MarginValue>,
    driverBehaviour: DriverBehaviour = DriverBehaviour(),
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
            val constraint = Stop(
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

    val margins =
        margins.toDistanceRangeMap(
            Offset(Distance(0)),
            Offset(Distance.fromMeters(trainPath.length)),
        )

    val provisionalStates = mutableListOf(TrainState.zero)

    margins.forEach { lower, upper, margin ->
        val lowerI = maxEffortStates.binarySearch(lower.toPrecise())
        val upperI = maxEffortStates.binarySearch(upper.toPrecise())

        val prevUpperI = max(lowerI - 1, 0)
        if (margin.isNone()) {
            // The binary search below doesn't work when there is no margin.

            if (provisionalStates[prevUpperI] == maxEffortStates[prevUpperI]) {
                for (i in lowerI..upperI) {
                    provisionalStates.add(maxEffortStates[i])
                }
                return@forEach
            }

            tracer?.runStart("provisional-lower=$lower-upper=$upper-vmaxfactor=1")

            context.driver.vMaxFactor = 1.0

            var trainState = provisionalStates.last()
            while (trainState.position < upper.toPrecise()) {
                val nextTrainState = step(context, constraints, trainState, tracer)
                for (constraint in constraints) {
                    if (constraint is Updatable) {
                        constraint.update(trainState, nextTrainState)
                    }
                }
                trainState = nextTrainState
                provisionalStates.add(trainState)
            }

            return@forEach
        }

        val lowerTime = maxEffortStates[lowerI].time
        val upperTime = maxEffortStates[upperI].time
        val baseTime = upperTime - lowerTime

        val allowanceRange =
            AllowanceRange(
                beginPos = lower.meters,
                endPos = upper.meters,
                value =
                    when (margin) {
                        is MarginValue.MinPer100Km -> AllowanceValue.TimePerDistance(margin.value)
                        is MarginValue.None -> AllowanceValue.Percentage(0.0)
                        is MarginValue.Percentage -> AllowanceValue.Percentage(margin.percentage)
                    },
            )

        val distance = allowanceRange.endPos - allowanceRange.beginPos
        val allowanceTime =
            allowanceRange.value.getAllowanceTime(baseTime.seconds, distance).seconds
        val provisionalTime = baseTime + allowanceTime

        val states = mutableListOf<TrainState>()
        var vMaxFactorMin = 0.0
        var vMaxFactorMax = 1.0
        while (vMaxFactorMax - vMaxFactorMin > 0.1) {
            val vMaxFactor = (vMaxFactorMax + vMaxFactorMin) / 2.0
            context.driver.vMaxFactor = vMaxFactor
            var trainState = provisionalStates.last()
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

            val arrivalTime = states.last().time
            if ((arrivalTime - provisionalTime).seconds.absoluteValue < context.timeStep) {
                break
            } else if (arrivalTime < provisionalTime) {
                vMaxFactorMax = vMaxFactor
            } else {
                vMaxFactorMin = vMaxFactor
            }
        }

        provisionalStates.addAll(states)
    }

    context.driver.vMaxFactor = 1.0

    val baseReport = maxEffortStates.toReportTrain(schedule)
    val provisionalReport = provisionalStates.toReportTrain(schedule)

    val completeReport =
        CompleteReportTrain(
            positions = provisionalReport.positions,
            times = provisionalReport.times,
            speeds = provisionalReport.speeds,
            energyConsumption = provisionalReport.energyConsumption,
            pathItemTimes = provisionalReport.pathItemTimes,
            signalCriticalPositions = listOf(), // TODO
            zoneUpdates = listOf(), // TODO
            spacingRequirements = listOf(), // TODO
            routingRequirements = listOf(), // TODO
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
                            speed?.metersPerSecond ?: Double.POSITIVE_INFINITY
                        ),
                    source = null,
                )
            },
        electricalProfiles = makeElectricalProfiles(electrificationRanges),
    )
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
                    val insertAt = -res - 1
                    // Get the element before where we would insert [position]
                    // to get the arrival time
                    res = (insertAt - 1).coerceIn(0, simplifiedPoints.size - 1)
                }
                Duration.fromSeconds(simplifiedPoints[res].time)
            },
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
    stockLength: PreciseDistance
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
