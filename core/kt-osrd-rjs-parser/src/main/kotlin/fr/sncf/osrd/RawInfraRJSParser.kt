package fr.sncf.osrd

import com.google.common.primitives.Doubles
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.*
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSElectrification
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSNeutralSection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.BuildRouteError
import fr.sncf.osrd.sim_infra.impl.MissingNodeConfig
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.sim_infra.impl.ReachedNodeDeadEnd
import fr.sncf.osrd.sim_infra.impl.ReachedTrackDeadEnd
import fr.sncf.osrd.sim_infra.impl.SpeedSection
import fr.sncf.osrd.sim_infra.impl.TrackChunkDescriptor
import fr.sncf.osrd.sim_infra.impl.TrackNodeConfigDescriptor
import fr.sncf.osrd.sim_infra.impl.route
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.Direction.DECREASING
import fr.sncf.osrd.utils.Direction.INCREASING
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import java.util.*
import kotlin.collections.set
import kotlin.math.abs
import kotlin.time.Duration.Companion.seconds
import mu.KotlinLogging

val logger = KotlinLogging.logger {}

private fun parseLineString(rjsLineString: RJSLineString?): LineString? {
    if (rjsLineString == null) return null
    val xs = ArrayList<Double>()
    val ys = ArrayList<Double>()
    for (p in rjsLineString.coordinates) {
        assert(p.size == 2) { "Assertion failed: Railjson Coordinate must 2 values: $p" }
        xs.add(p[0])
        ys.add(p[1])
    }
    return LineString.make(Doubles.toArray(xs), Doubles.toArray(ys))
}

/** Computes the slopes RangeMap of a track section. */
private fun getSlopes(rjsTrackSection: RJSTrackSection): DistanceRangeMap<Double> {
    val slopes =
        distanceRangeMapOf(
            listOf(DistanceRangeMap.RangeMapEntry(0.meters, rjsTrackSection.length.meters, 0.0))
        )
    if (rjsTrackSection.slopes != null) {
        for (rjsSlope in rjsTrackSection.slopes) {
            rjsSlope.simplify()
            if (rjsSlope.begin < 0 || rjsSlope.end > rjsTrackSection.length)
                throw OSRDError.newInvalidRangeError(
                    ErrorType.InvalidInfraTrackSlopeWithInvalidRange,
                    rjsTrackSection.id
                )
            if (rjsSlope.gradient != 0.0) {
                slopes.put(rjsSlope.begin.meters, rjsSlope.end.meters, rjsSlope.gradient)
            }
        }
    }
    return slopes
}

/** Computes the curves RangeMap of a track section. */
private fun getCurves(rjsTrackSection: RJSTrackSection): DistanceRangeMap<Double> {
    val curves =
        distanceRangeMapOf(
            listOf(DistanceRangeMap.RangeMapEntry(0.meters, rjsTrackSection.length.meters, 0.0))
        )
    if (rjsTrackSection.curves != null) {
        for (rjsCurve in rjsTrackSection.curves) {
            rjsCurve.simplify()
            if (rjsCurve.begin < 0 || rjsCurve.end > rjsTrackSection.length)
                throw OSRDError.newInvalidRangeError(
                    ErrorType.InvalidInfraTrackSlopeWithInvalidRange,
                    rjsTrackSection.id
                )
            if (rjsCurve.radius != 0.0) {
                curves.put(rjsCurve.begin.meters, rjsCurve.end.meters, rjsCurve.radius)
            }
        }
    }
    return curves
}

/**
 * Extract chunk's increasing DistanceRange<Double> and compute corresponding decreasing range to
 * build a complete DirectionalMap.
 */
private fun getChunkDirectionalDistanceRange(
    distanceRangeMap: DistanceRangeMap<Double>,
    chunkStartOffset: Offset<TrackSection>,
    chunkEndOffset: Offset<TrackSection>
): DirectionalMap<DistanceRangeMap<Double>> {
    val increasingChunkRange =
        distanceRangeMap.subMap(chunkStartOffset.distance, chunkEndOffset.distance)
    increasingChunkRange.shiftPositions(-chunkStartOffset.distance)
    val chunkLength = chunkEndOffset - chunkStartOffset
    return DirectionalMap(
        increasingChunkRange,
        DistanceRangeMapImpl(
            increasingChunkRange
                .reversed()
                .map {
                    DistanceRangeMap.RangeMapEntry(
                        chunkLength - it.upper,
                        chunkLength - it.lower,
                        if (it.value == 0.0) 0.0 else -it.value
                    )
                }
                .toList()
        )
    )
}

/**
 * Computes the gradients RangeMap from the slopes and curves RangeMaps.
 *
 * gradient = slope + 800 / |radius|
 */
private fun getGradients(
    slopes: DistanceRangeMap<Double>,
    curves: DistanceRangeMap<Double>
): DistanceRangeMap<Double> {
    assert(slopes.lowerBound() == Distance(0)) {
        "Assertion failed: slopes' lower bound must be 0 when processing gradient"
    }
    assert(curves.lowerBound() == Distance(0)) {
        "Assertion failed: curves' lower bound must be 0 when processing gradient"
    }
    assert(slopes.upperBound() == curves.upperBound()) {
        "Assertion failed: slopes' and curves' upper bound must be equal when processing gradient"
    }
    val gradients = distanceRangeMapOf<Double>()

    var lower = Distance(0)
    val currentSlopeIt = slopes.iterator()
    var currentSlope = currentSlopeIt.next()
    val currentCurveIt = curves.iterator()
    var currentCurve = currentCurveIt.next()

    while (lower < slopes.upperBound()) {
        val slopeGradient = currentSlope.value
        val curveGradient = if (currentCurve.value == 0.0) 0.0 else 800.0 / abs(currentCurve.value)
        val upper = minOf(currentSlope.upper, currentCurve.upper)
        gradients.put(lower, upper, curveGradient + slopeGradient)
        if ((currentSlope.upper == upper) and currentSlopeIt.hasNext()) {
            currentSlope = currentSlopeIt.next()
        }
        if ((currentCurve.upper == upper) and currentCurveIt.hasNext()) {
            currentCurve = currentCurveIt.next()
        }
        lower = upper
    }

    return gradients
}

/** Builds the ranges of blocked loading gauge types on the track */
private fun getBlockedGauge(
    rjsTrackSection: RJSTrackSection
): DistanceRangeMap<LoadingGaugeConstraint> {
    // This method has a bad complexity compared to more advanced solutions,
    // but we don't expect more than a few ranges per track-section.
    // TODO: use an interval tree
    val res = distanceRangeMapOf<LoadingGaugeConstraint>()
    if (
        (rjsTrackSection.loadingGaugeLimits == null) ||
            (rjsTrackSection.loadingGaugeLimits.isEmpty())
    )
        return res

    // Sorts and removes duplicates
    val transitions = TreeSet<Double>()
    for (range in rjsTrackSection.loadingGaugeLimits) {
        transitions.add(range.begin)
        transitions.add(range.end)
    }

    val transitionsList = ArrayList(transitions) // Needed for index based loop
    for (i in 1 until transitionsList.size) {
        val begin = transitionsList[i - 1]
        val end = transitionsList[i]
        val allowedTypes = HashSet<RJSLoadingGaugeType>()
        for (range in rjsTrackSection.loadingGaugeLimits) {
            if (range.begin <= begin && range.end >= end) {
                val compatibleTypes = compatibleGaugeTypeMap[range.category]
                if (compatibleTypes == null) {
                    logger.warn(
                        "Invalid gauge type ${range.category} for track ${rjsTrackSection.id}"
                    )
                    allowedTypes.addAll(allLoadingGaugeTypeSet)
                } else {
                    allowedTypes.addAll(compatibleTypes)
                }
            }
        }
        res.put(begin.meters, end.meters, buildBlockedGaugeTypesLoadingConstraint(allowedTypes))
    }
    return res
}

private fun buildBlockedGaugeTypesLoadingConstraint(
    allowedTypes: Set<RJSLoadingGaugeType>
): LoadingGaugeConstraint {
    val blockedTypes = mutableStaticIdxArraySetOf<LoadingGaugeType>()
    for (gaugeType in RJSLoadingGaugeType.entries) {
        if (!allowedTypes.contains(gaugeType)) {
            blockedTypes.add(StaticIdx(gaugeType.ordinal.toUInt()))
        }
    }
    return LoadingGaugeConstraint(blockedTypes)
}

private fun buildCompatibleGaugeTypesMap(): Map<RJSLoadingGaugeType, Set<RJSLoadingGaugeType>> {
    val compatibleGaugeType = hashMapOf<RJSLoadingGaugeType, Set<RJSLoadingGaugeType>>()
    for (gaugeType in enumValues<RJSLoadingGaugeType>()) {
        val compatibleTypes = gaugeType.compatibleGaugeTypes
        if (compatibleTypes != null) compatibleGaugeType[gaugeType] = compatibleTypes
    }
    return compatibleGaugeType
}

val compatibleGaugeTypeMap = buildCompatibleGaugeTypesMap()
val allLoadingGaugeTypeSet = enumValues<RJSLoadingGaugeType>().toSet()

private fun parseRjsRouteWaypoint(
    rjsDetector: RJSRouteWaypoint,
    trackSectionNameToDistanceSortedDetectors:
        MutableMap<String, TreeMap<Offset<TrackSection>, MutableList<String>>>,
) {
    val trackDetectors =
        trackSectionNameToDistanceSortedDetectors.computeIfAbsent(rjsDetector.track) { TreeMap() }
    val signalPosition = Offset<TrackSection>(rjsDetector.position.meters)
    val detectorNames = trackDetectors.computeIfAbsent(signalPosition) { mutableListOf() }
    detectorNames.add(rjsDetector.id)
}

/** Build detection zones on a partially-filled builder (track-sections, nodes and detectors) */
private fun buildZones(builder: RawInfraBuilder) {
    // 1. run a union-find to figure out which zone each start and end of track section belongs to
    val uf = UnionFind(builder.getTrackSections().size.toInt() * 2)

    // 1.a. if a track section has no detector, both ends are part of the same zone
    val trackNodePool = builder.getTrackNodes()
    for (trackSectionIdx in builder.getTrackSections()) {
        val detectors = builder.getTrackSectionDetectors(trackSectionIdx)
        if (detectors.size == 0) {
            val startEndpoint = EndpointTrackSectionId(trackSectionIdx, Endpoint.START)
            val endEndpoint = EndpointTrackSectionId(trackSectionIdx, Endpoint.END)
            uf.union(startEndpoint.index.toInt(), endEndpoint.index.toInt())
        }
    }

    // 1.b. each node connects track section ends together
    for (nodeIdx in trackNodePool) {
        val ports = builder.getTrackNodePorts(nodeIdx)
        for (port in 1u until ports.size) {
            val firstEndpoint = ports[StaticIdx(0u)]
            val curEndpoint = ports[StaticIdx(port)]
            uf.union(firstEndpoint.index.toInt(), curEndpoint.index.toInt())
        }
    }

    // 2. now that union-find is complete, create zones
    val rootToZoneMap = mutableMapOf<Int, ZoneId>()

    // this lookup table keeps track of which nodes were already added to a zone
    val nodeHasZone = BooleanArray(builder.getTrackNodes().size.toInt()) { false }

    // TODO: change this algorithm to add all nodes to zones separately from iterating on track
    // sections
    for (trackSectionIdx in builder.getTrackSections()) {
        val detectors = builder.getTrackSectionDetectors(trackSectionIdx)

        // 2.a. create zones between consecutive detector pairs within the track section
        for (detectorIndex in 0 until detectors.size - 1) {
            val leftDetector = detectors[detectorIndex]
            val rightDetector = detectors[detectorIndex + 1]
            val zoneIdx = builder.zone(listOf())
            builder.setNextZone(leftDetector.increasing, zoneIdx)
            builder.setNextZone(rightDetector.decreasing, zoneIdx)
        }

        // 2.b. add the first and last detectors and nodes to their zones, creating them if needed
        for (endpoint in Endpoint.entries) {
            val trackSectionEndpoint = EndpointTrackSectionId(trackSectionIdx, endpoint)
            val node = builder.getNodeAtEndpoint(trackSectionEndpoint) ?: continue

            // find which zone the track section end belongs to, creating it if necessary
            val zoneRoot = uf.findRoot(trackSectionEndpoint.index.toInt())
            val zoneIdx = rootToZoneMap.computeIfAbsent(zoneRoot) { builder.zone(listOf()) }

            // add the node at the end of the track section to the zone
            if (!nodeHasZone[node.index.toInt()]) {
                builder.zoneAddNode(zoneIdx, node)
                nodeHasZone[node.index.toInt()] = true
            }

            // if the track section has detectors, they are zone bounds
            if (detectors.size != 0) {
                val dirDetector =
                    if (endpoint == Endpoint.START) detectors[0].decreasing
                    else detectors[detectors.size - 1].increasing
                builder.setNextZone(dirDetector, zoneIdx)
            }
        }
    }
}

private fun parseRjsTrackSection(
    builder: RawInfraBuilder,
    rjsTrack: RJSTrackSection,
    trackSectionNameToDistanceSortedDetectors:
        Map<String, TreeMap<Offset<TrackSection>, MutableList<String>>>,
) {
    val trackSectionChunks = mutableStaticIdxArrayListOf<TrackChunk>()

    val trackSectionLength = Offset<TrackSection>(rjsTrack.length.meters)
    val trackSectionGeo = parseLineString(rjsTrack.geo)!!
    val trackSectionSlopes = getSlopes(rjsTrack)
    val trackSectionCurves = getCurves(rjsTrack)
    val trackSectionBlockedGauges = getBlockedGauge(rjsTrack)

    val chunkBoundariesOffsets = mutableOffsetArrayListOf<TrackSection>(Offset.zero())
    val chunkBoundariesDetectors = mutableListOf<List<String>?>(null)

    // add all detectors
    val trackSectionDetectors = trackSectionNameToDistanceSortedDetectors[rjsTrack.id]
    if (trackSectionDetectors != null) {
        for (detector in trackSectionDetectors) {
            val detectorOffset = detector.key
            if (detectorOffset > trackSectionLength || detectorOffset < Offset.zero()) {
                throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Detector out of range at offset $detectorOffset on trackSection ${rjsTrack.id}"
                )
            }
            if (detectorOffset.distance == Distance.ZERO) {
                chunkBoundariesDetectors[0] = detector.value
                continue
            }
            chunkBoundariesOffsets.add(detectorOffset)
            chunkBoundariesDetectors.add(detector.value)
        }
    }

    // add a boundary for the end of the track section
    if (chunkBoundariesOffsets[chunkBoundariesOffsets.size - 1] != trackSectionLength) {
        chunkBoundariesOffsets.add(trackSectionLength)
        chunkBoundariesDetectors.add(null)
    }

    for (chunkIndex in 0 until chunkBoundariesOffsets.size - 1) {
        val chunkStartOffset = chunkBoundariesOffsets[chunkIndex]
        val chunkEndOffset = chunkBoundariesOffsets[chunkIndex + 1]
        val chunkSlopes =
            getChunkDirectionalDistanceRange(trackSectionSlopes, chunkStartOffset, chunkEndOffset)
        val chunkCurves =
            getChunkDirectionalDistanceRange(trackSectionCurves, chunkStartOffset, chunkEndOffset)

        val chunkBlockedGauges =
            trackSectionBlockedGauges.subMap(chunkStartOffset.distance, chunkEndOffset.distance)
        chunkBlockedGauges.shiftPositions(-chunkStartOffset.distance)

        val chunkLength = chunkEndOffset - chunkStartOffset

        val chunkIdx =
            builder.trackChunk(
                trackSectionGeo.slice(
                    chunkStartOffset.distance.millimeters.toDouble() /
                        trackSectionLength.distance.millimeters,
                    chunkEndOffset.distance.millimeters.toDouble() /
                        trackSectionLength.distance.millimeters
                ),
                chunkSlopes,
                chunkCurves,
                DirectionalMap(
                    getGradients(chunkSlopes.get(INCREASING), chunkCurves.get(INCREASING)),
                    getGradients(chunkSlopes.get(DECREASING), chunkCurves.get(DECREASING))
                ),
                Offset(chunkLength),
                chunkStartOffset,
                chunkBlockedGauges
            )
        trackSectionChunks.add(chunkIdx)
    }
    val trackSectionId = builder.trackSection(rjsTrack.id, trackSectionChunks)
    for (chunkBoundaryIndex in 0 until chunkBoundariesDetectors.size) {
        val chunkBoundaryDetectorNames = chunkBoundariesDetectors[chunkBoundaryIndex] ?: continue
        builder.detector(chunkBoundaryDetectorNames, trackSectionId, chunkBoundaryIndex)
    }
}

fun parseRjsElectrification(builder: RawInfraBuilder, electrification: RJSElectrification) {
    for (electrificationRange in electrification.trackRanges) {
        val applyElectrificationForChunkBetween =
            { chunk: TrackChunkDescriptor, chunkLower: Distance, chunkUpper: Distance ->
                val previousElectrifications =
                    chunk.electrificationVoltage.subMap(chunkLower, chunkUpper)
                for (previousElectrification in previousElectrifications) {
                    if (
                        previousElectrification.value != electrification.voltage &&
                            previousElectrification.value != ""
                    ) {
                        logger.warn(
                            "Electrification conflict on track-range ${electrificationRange.trackSectionID}" +
                                "[${previousElectrification.lower + chunk.offset.distance}, " +
                                "${previousElectrification.upper + chunk.offset.distance}]: " +
                                "${previousElectrification.value} != ${electrification.voltage}"
                        )
                    }
                }

                chunk.electrificationVoltage.put(chunkLower, chunkUpper, electrification.voltage)
            }
        builder.applyFunctionToTrackSectionChunksBetween(
            electrificationRange.trackSectionID,
            electrificationRange.begin.meters,
            electrificationRange.end.meters,
            applyElectrificationForChunkBetween
        )
    }
}

fun parseNeutralRanges(
    builder: RawInfraBuilder,
    isAnnouncement: Boolean,
    neutralSection: RJSNeutralSection,
) {
    val trackRanges =
        if (isAnnouncement) neutralSection.announcementTrackRanges else neutralSection.trackRanges
    for (trackRange in trackRanges) {
        val applyNeutralSectionForChunkBetween =
            { chunk: TrackChunkDescriptor, chunkLower: Distance, chunkUpper: Distance ->
                val track = trackRange.trackSectionID
                val dir = trackRange.direction.toDirection()
                val incomingNeutralSection =
                    NeutralSection(neutralSection.lowerPantograph, isAnnouncement)
                val dirChunkLower =
                    if (dir == INCREASING) chunkLower else chunk.length.distance - chunkUpper
                val dirChunkUpper =
                    if (dir == INCREASING) chunkUpper else chunk.length.distance - chunkLower
                val chunkDirNeutralSections = chunk.neutralSections.get(dir)

                val previousDirNeutralSections =
                    chunkDirNeutralSections.subMap(dirChunkLower, dirChunkUpper)
                for (previousNeutralSection in previousDirNeutralSections) {
                    if (previousNeutralSection.value != incomingNeutralSection) {
                        logger.warn(
                            "Neutral-section conflict on track-range $track.$dir" +
                                "[$chunkLower, $chunkUpper]: " +
                                "${previousNeutralSection.value} != $incomingNeutralSection"
                        )
                        break
                    }
                }

                chunkDirNeutralSections.put(dirChunkLower, dirChunkUpper, incomingNeutralSection)
            }
        builder.applyFunctionToTrackSectionChunksBetween(
            trackRange.trackSectionID,
            trackRange.begin.meters,
            trackRange.end.meters,
            applyNeutralSectionForChunkBetween
        )
    }
}

// Parse speed-sections
fun mergeIntoSpeedSections(
    initialSpeedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>,
    direction: Direction,
    lower: Distance,
    upper: Distance,
    incomingSpeedSection: RJSSpeedSection
) {
    val speedSections = initialSpeedSections.get(direction)
    val subMap =
        speedSections.subMap(lower, upper).map { prevSpeedSection ->
            DistanceRangeMap.RangeMapEntry(
                prevSpeedSection.lower,
                prevSpeedSection.upper,
                SpeedSection.merge(prevSpeedSection.value, parseSpeedSection(incomingSpeedSection))
            )
        }
    initialSpeedSections.get(direction).putMany(subMap)
}

fun parseSpeedSection(rjsSpeedSection: RJSSpeedSection): SpeedSection {
    var defaultLimit = rjsSpeedSection.speedLimit.metersPerSecond
    val routeLimits =
        if (rjsSpeedSection.onRoutes != null) {
            val res = rjsSpeedSection.onRoutes.associateWith { defaultLimit }
            defaultLimit = Double.POSITIVE_INFINITY.metersPerSecond
            res
        } else mapOf()
    return SpeedSection(
        defaultLimit,
        (rjsSpeedSection.speedLimitByTag ?: mapOf())
            .map { entry -> Pair(entry.key, entry.value.metersPerSecond) }
            .toMap(),
        routeLimits
    )
}

fun parseSpeedSection(builder: RawInfraBuilder, speedSection: RJSSpeedSection) {
    for (speedRange in speedSection.trackRanges) {
        val applySpeedSectionForChunkBetween =
            { chunk: TrackChunkDescriptor, chunkLower: Distance, chunkUpper: Distance ->
                val directionalSpeedSections = chunk.speedSections
                if (speedRange.applicableDirections.appliesToNormal()) {
                    mergeIntoSpeedSections(
                        directionalSpeedSections,
                        INCREASING,
                        chunkLower,
                        chunkUpper,
                        speedSection
                    )
                }
                if (speedRange.applicableDirections.appliesToReverse()) {
                    mergeIntoSpeedSections(
                        directionalSpeedSections,
                        DECREASING,
                        chunk.length.distance - chunkUpper,
                        chunk.length.distance - chunkLower,
                        speedSection
                    )
                }
            }
        builder.applyFunctionToTrackSectionChunksBetween(
            speedRange.trackSectionID,
            speedRange.begin.meters,
            speedRange.end.meters,
            applySpeedSectionForChunkBetween
        )
    }
}

fun parseTrackNode(
    builder: RawInfraBuilder,
    switchTypeMap: Map<String, RJSSwitchType>,
    rjsNode: RJSSwitch
) {
    val ports = StaticPool<TrackNodePort, EndpointTrackSectionId>()
    val portMap = mutableMapOf<String, TrackNodePortId>()
    for ((rjsPortName, rjsPort) in rjsNode.ports) {
        portMap[rjsPortName] =
            ports.add(
                builder.getTrackSectionEndpointIdx(rjsPort.track, rjsPort.endpoint.toEndpoint())
            )
    }
    val switchType =
        switchTypeMap[rjsNode.switchType]
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Node ${rjsNode.id} references unknown switch-type ${rjsNode.switchType}"
            )
    if (rjsNode.ports.size != switchType.ports.size || portMap.keys != switchType.ports.toSet()) {
        throw OSRDError.newWrongSwitchPortsError(
            rjsNode.id,
            switchType.id,
            switchType.ports,
            portMap.keys
        )
    }
    val configs = StaticPool<TrackNodeConfig, TrackNodeConfigDescriptor>()
    for (group in switchType.groups) {
        configs.add(
            TrackNodeConfigDescriptor(
                group.key,
                group.value.map { Pair(portMap[it.src]!!, portMap[it.dst]!!) }.toList()
            )
        )
    }
    builder.node(rjsNode.id, rjsNode.groupChangeDelay.seconds, ports, configs)
}

fun parseRoute(builder: RawInfraBuilder, rjsRoute: RJSRoute) {
    val routeName = rjsRoute.id

    // parse the entry / exit detectors
    val routeEntryDetector =
        builder.getDetectorByName(rjsRoute.entryPoint.id.id)
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Route $routeName references unknown entry point ${rjsRoute.entryPoint.id.id}"
            )
    val routeEntryDirection = rjsRoute.entryPointDirection.toDirection()
    val routeEntry: DirDetectorId = DirStaticIdx(routeEntryDetector, routeEntryDirection)
    val routeExit: DetectorId =
        builder.getDetectorByName(rjsRoute.exitPoint.id.id)
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Route $routeName references unknown exit point ${rjsRoute.exitPoint.id.id}"
            )

    // parse release detectors
    val releaseDetectors = MutableStaticIdxArraySet<Detector>()
    for (rjsDetName in rjsRoute.releaseDetectors) {
        releaseDetectors.add(
            builder.getDetectorByName(rjsDetName)
                ?: throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Route $routeName references unknown release detector $rjsDetName"
                )
        )
    }

    // parse route node configs
    val routeNodes = mutableMapOf<TrackNodeId, TrackNodeConfigId>()
    for (rjsRouteNode in rjsRoute.switchesDirections) {
        val node =
            builder.getTrackNodeByName(rjsRouteNode.key)
                ?: throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Route $routeName references unknown track node ${rjsRouteNode.key}"
                )
        val config =
            builder.getTrackNodeConfigByName(node, rjsRouteNode.value)
                ?: throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Route $routeName references unknown config ${rjsRouteNode.value} for track node ${rjsRouteNode.key}"
                )
        routeNodes[node] = config
    }

    try {
        builder.route(routeName, routeEntry, routeExit, routeNodes, releaseDetectors)
    } catch (error: BuildRouteError) {
        throw when (error) {
            is ReachedTrackDeadEnd ->
                OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Impossible to build route: could not reach exit point"
                )
            is ReachedNodeDeadEnd ->
                OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Impossible to build route: could not cross node"
                )
            is MissingNodeConfig ->
                OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Impossible to build route: reached a node not listed on given route"
                )
        }
    }
}

fun parseSignal(builder: RawInfraBuilder, rjsSignal: RJSSignal) {
    val trackSectionId =
        builder.getTrackSectionByName(rjsSignal.track)
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Signal ${rjsSignal.id} references unknown track section ${rjsSignal.track}"
            )
    val direction = rjsSignal.direction!!.toDirection()
    val undirectedTrackOffset = Offset<TrackSection>(rjsSignal.position.meters)
    builder.physicalSignal(
        rjsSignal.id,
        rjsSignal.sightDistance.meters,
        DirTrackSectionId(trackSectionId, direction),
        undirectedTrackOffset
    ) {
        if (rjsSignal.logicalSignals == null) {
            return@physicalSignal
        }

        for (rjsLogicalSignal in rjsSignal.logicalSignals) {
            assert(
                rjsLogicalSignal.signalingSystem != null &&
                    rjsLogicalSignal.signalingSystem.isNotEmpty()
            )
            assert(rjsLogicalSignal.nextSignalingSystems != null)
            assert(rjsLogicalSignal.settings != null)
            for (sigSystem in rjsLogicalSignal.nextSignalingSystems) {
                assert(sigSystem.isNotEmpty())
            }

            val signalParameters =
                RawSignalParameters(
                    rjsLogicalSignal.defaultParameters,
                    rjsLogicalSignal.conditionalParameters.associate {
                        Pair(builder.getRouteByName(it.onRoute)!!, it.parameters)
                    },
                )
            logicalSignal(
                rjsLogicalSignal.signalingSystem,
                rjsLogicalSignal.nextSignalingSystems,
                rjsLogicalSignal.settings,
                signalParameters
            )
        }
    }
}

fun EdgeDirection.toDirection(): Direction {
    return when (this) {
        EdgeDirection.START_TO_STOP -> INCREASING
        EdgeDirection.STOP_TO_START -> DECREASING
    }
}

fun EdgeEndpoint.toEndpoint(): Endpoint {
    return if (this == EdgeEndpoint.BEGIN) Endpoint.START else Endpoint.END
}

fun parseRJSInfra(rjsInfra: RJSInfra): RawInfra {
    val builder = RawInfraBuilder()

    // Parse detectors and buffer-stops
    val trackSectionNameToDistanceSortedDetectors =
        mutableMapOf<String, TreeMap<Offset<TrackSection>, MutableList<String>>>()

    for (detector in rjsInfra.detectors) {
        parseRjsRouteWaypoint(
            detector,
            trackSectionNameToDistanceSortedDetectors,
        )
    }
    for (detector in rjsInfra.bufferStops) {
        parseRjsRouteWaypoint(
            detector,
            trackSectionNameToDistanceSortedDetectors,
        )
    }

    // Parse track-sections
    for (rjsTrack in rjsInfra.trackSections) {
        parseRjsTrackSection(builder, rjsTrack, trackSectionNameToDistanceSortedDetectors)
    }

    // Parse electrifications
    for (electrification in rjsInfra.electrifications) {
        parseRjsElectrification(builder, electrification)
    }

    for (neutralSection in rjsInfra.neutralSections) {
        parseNeutralRanges(builder, false, neutralSection)

        // FIXME: the current implementation of neutral section announcements breaks
        //  some use cases, see https://github.com/OpenRailAssociation/osrd/issues/7359
        // parseNeutralRanges(builder, true, neutralSection)
    }

    for (speedSection in rjsInfra.speedSections) {
        parseSpeedSection(builder, speedSection)
    }

    // parse operational points
    for (operationalPoint in rjsInfra.operationalPoints) {
        val distinctParts = mutableSetOf<RJSOperationalPointPart>()
        for (opPart in operationalPoint.parts) {
            // ignore duplicates
            if (distinctParts.contains(opPart)) continue
            distinctParts.add(opPart)

            val operationalPointId = operationalPoint.id
            val trackSectionName = opPart.track
            val trackSectionOffset = Offset<TrackSection>(opPart.position.meters)
            val props = mutableMapOf<String, String>()
            if (operationalPoint.extensions?.identifier != null) {
                val identifier = operationalPoint.extensions!!.identifier!!
                props["identifier"] = identifier.name
                props["uic"] = identifier.uic.toString()
            }
            if (operationalPoint.extensions?.sncf != null) {
                val sncf = operationalPoint.extensions!!.sncf!!
                props["ci"] = sncf.ci.toString()
                props["ch"] = sncf.ch
                props["chShortLabel"] = sncf.chShortLabel
                props["chLongLabel"] = sncf.chLongLabel
                props["trigram"] = sncf.trigram
            }
            if (opPart.extensions?.sncf != null) props["kp"] = opPart.extensions!!.sncf!!.kp
            val partId =
                builder.operationalPointPart(
                    operationalPointId,
                    trackSectionName,
                    trackSectionOffset,
                    props
                )
            if (partId == null) {
                // TODO: link warning to specific request (through response or tracing)
                logger.warn(
                    "Invalid Part on track $trackSectionName for Operational Point $operationalPointId"
                )
            }
        }
    }

    // parse nodes
    val switchTypes = (rjsInfra.switchTypes ?: listOf()) + RJSSwitchType.BUILTIN_NODE_TYPES_LIST
    val switchTypeMap = switchTypes.associateBy { it.id }
    for (rjsNode in rjsInfra.switches) {
        parseTrackNode(builder, switchTypeMap, rjsNode)
    }

    // process detection zones
    buildZones(builder)

    // parse routes
    for (rjsRoute in rjsInfra.routes) {
        parseRoute(builder, rjsRoute)
    }

    // parse signals
    for (rjsSignal in rjsInfra.signals) {
        parseSignal(builder, rjsSignal)
    }

    return builder.build()
}
