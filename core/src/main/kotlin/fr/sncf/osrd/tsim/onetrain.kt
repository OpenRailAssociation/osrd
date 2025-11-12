package fr.sncf.osrd.tsim

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
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate.EnvelopePoint
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.standalone_sim.buildSignalingRanges
import fr.sncf.osrd.standalone_sim.makeElectricalProfiles
import fr.sncf.osrd.standalone_sim.makeSafetySpeedRanges
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.simplifyEnvelopePoints
import fr.sncf.osrd.utils.toRangeMap
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import fr.sncf.osrd.utils.units.seconds

fun onetrain(
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
    val electrificationMap =
        trainPath.getElectrificationMap(
            rollingStock.basePowerClass,
            powerRestrictions.toRangeMap(),
            rollingStock.powerRestrictions,
            !useElectricalProfiles,
        )
    val curvesAndConditions = rollingStock.mapTractiveEffortCurves(electrificationMap, comfort)
    val effortCurveMap = curvesAndConditions.curves
    val ctx = Context(path = trainPath, stock = rollingStock, effortCurveMap = effortCurveMap)

    var stopSeq =
        schedule.asSequence().mapNotNull { item ->
            val stopFor = item.stopFor?.seconds ?: return@mapNotNull null
            if (stopFor == 0.0) {
                return@mapNotNull null
            }
            Pair(item.pathOffset.meters, stopFor)
        }
    schedule.lastOrNull()
        ?.takeUnless { item -> item.stopFor?.seconds != 0.0 }
        ?.let { item -> stopSeq += sequenceOf(Pair(item.pathOffset.meters, 0.0)) }
    val stops = stopSeq.toList()

    var mrsp: RangeMap<Meters, MetersPerSecond> = TreeRangeMap.create()
    mrsp.put(Range.all(), rollingStock.maxSpeed)
    if (useSpeedLimits) {
        val props = trainPath.getSpeedLimitProperties(speedLimitTag, null)
        for (prop in props) {
            val start = prop.lower.meters
            val end = prop.upper.meters
            val speed = prop.value.speed.metersPerSecond
            if (speed != 0.0) {
                mrsp.putLower(Range.closed(start, end), speed)
            }
        }
        mrsp = mrsp.withStockLength(rollingStock.length)

        val signalingRanges = buildSignalingRanges(infra, trainPath)
        val safetySpeedRanges = makeSafetySpeedRanges(infra, trainPath, schedule, signalingRanges)
        for (range in safetySpeedRanges) {
            val start = range.lower.meters
            val end = range.upper.meters
            val speed = range.value.metersPerSecond
            mrsp.putLower(Range.closed(start, end), speed)
        }
    }

    val stopConstraint = TreeRangeMap.create<Meters, MetersPerSecond>()
    val speedConstraints = OverlayingSpeedLimits(mutableListOf(mrsp, stopConstraint))

    val neutralZones = NeutralZonesWithPantographs() // TODO
    val instructions = Instructions(speedConstraints, neutralZones)

    var time = 0.0
    var position = rollingStock.length
    var speed = initialSpeed
    val envelopePoints = mutableListOf(EnvelopePoint(time, speed, position))
    for ((stopPosition, stopDuration) in stops) {
        if (stopPosition < position) {
            println("aoups on a dépasser un autre arrêt du coup?")
            time += stopDuration
            envelopePoints.add(EnvelopePoint(time, speed, position))
            continue
        }

        stopConstraint.put(Range.atLeast(stopPosition), 0.0)
        while (!(stopPosition approxLowerThan position) || speed != 0.0) {
            val s = step(ctx, instructions, timeStep, position, speed)
            assert(s.positionDelta > 1e-6) { "le train c stopper.... ${s.positionDelta}" }
            time += s.timeDelta
            position += s.positionDelta
            speed = s.endSpeed
            envelopePoints.add(EnvelopePoint(time, speed, position))
        }

        if (!(stopPosition approxEqualTo position)) {
            println("le train a depasser la position d'arrêt!!! D:")
        }

        stopConstraint.remove(Range.all())
        time += stopDuration
        envelopePoints.add(EnvelopePoint(time, speed, position))
    }

    val simplifiedPoints = simplifyEnvelopePoints(envelopePoints, 5.0, 0.2)

    val baseReport =
        ReportTrain(
            positions = simplifiedPoints.map { point -> Offset(point.position.meters) },
            times = simplifiedPoints.map { point -> point.time.seconds },
            speeds = simplifiedPoints.map { point -> point.speed },
            energyConsumption = 0.0, // TODO
            pathItemTimes =
                pathItemPositions.map { offset ->
                    val position = offset.meters
                    var res = simplifiedPoints.binarySearchBy(position) { point -> point.position }
                    if (res < 0) {
                        val insertAt = -res - 1
                        // Get the element before where we would insert [position]
                        // to get the arrival time
                        res = (insertAt - 1).coerceIn(0, simplifiedPoints.size - 1)
                    }
                    simplifiedPoints[res].time.seconds
                },
        )

    val completeReport =
        CompleteReportTrain(
            positions = baseReport.positions,
            times = baseReport.times,
            speeds = baseReport.speeds,
            energyConsumption = baseReport.energyConsumption,
            pathItemTimes = baseReport.pathItemTimes,
            signalCriticalPositions = listOf(), // TODO
            zoneUpdates = listOf(), // TODO
            spacingRequirements = listOf(), // TODO
            routingRequirements = listOf(), // TODO
        )

    val electrificationRanges =
        ElectrificationRange.from(curvesAndConditions.conditions, electrificationMap)

    return SimulationSuccess(
        base = baseReport,
        provisional = baseReport, // TODO margins
        finalOutput = completeReport,
        mrsp =
            mrsp.toRangeValues { speed ->
                SpeedLimitProperty(
                    speed = (speed ?: MetersPerSecond.POSITIVE_INFINITY).metersPerSecond,
                    source = null,
                )
            },
        electricalProfiles = makeElectricalProfiles(electrificationRanges),
    )
}
