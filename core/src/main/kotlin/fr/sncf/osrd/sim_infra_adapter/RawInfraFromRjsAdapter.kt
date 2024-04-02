package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.HashBiMap
import com.google.common.collect.ImmutableSet
import com.google.common.collect.Sets
import com.google.common.primitives.Doubles
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.tracks.undirected.Detector
import fr.sncf.osrd.infra.api.tracks.undirected.Switch
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection as UndirectedTrackSection
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.infra.implementation.tracks.undirected.LoadingGaugeConstraintImpl
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSNeutralSection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.new_impl.RawInfraFromRjsBuilder
import fr.sncf.osrd.sim_infra.impl.new_impl.TrackChunkDescriptor
import fr.sncf.osrd.sim_infra.impl.new_impl.TrackNodeConfigDescriptor
import fr.sncf.osrd.sim_infra.impl.new_impl.parseSpeedSection
import fr.sncf.osrd.utils.Direction.DECREASING
import fr.sncf.osrd.utils.Direction.INCREASING
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.Endpoint
import fr.sncf.osrd.utils.UnionFind
import fr.sncf.osrd.utils.assertEqualSimInfra
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.MutableOffsetArrayList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
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
        val blockedTypes = Sets.difference(enumValues<RJSLoadingGaugeType>().toSet(), allowedTypes)
        res.put(
            begin.meters,
            end.meters,
            LoadingGaugeConstraintImpl(ImmutableSet.copyOf(blockedTypes))
        )
    }
    return res
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
private fun buildZones(builder: RawInfraFromRjsBuilder) {
    // run a union-find to associate track endpoints:
    // union by node
    val trackNodePool = builder.getTrackNodes()
    val uf = UnionFind(builder.getTrackSections().size.toInt() * 2)
    for (nodeIdx in trackNodePool) {
        val ports = builder.getTrackNodePorts(nodeIdx)
        var firstEndpoint: EndpointTrackSectionId? = null
        for (port in ports) {
            val endpoint = ports[port]
            if (firstEndpoint == null) {
                firstEndpoint = endpoint
            } else {
                uf.union(firstEndpoint.index.toInt(), endpoint.index.toInt())
            }
        }
    }
    // union by track-section without detector
    for (trackSectionIdx in builder.getTrackSections()) {
        val detectors = builder.getTrackSectionDetectors(trackSectionIdx)
        if (detectors.size == 0) {
            val startEndpoint = EndpointTrackSectionId(trackSectionIdx, Endpoint.START)
            val endEndpoint = EndpointTrackSectionId(trackSectionIdx, Endpoint.END)
            uf.union(startEndpoint.index.toInt(), endEndpoint.index.toInt())
        }
    }

    // now that union-find is complete, create detection zones
    val rootToZoneMap = mutableMapOf<Int, ZoneId>()
    for (trackSectionIdx in builder.getTrackSections()) {
        val detectors = builder.getTrackSectionDetectors(trackSectionIdx)

        // prepare "node" detection zones
        for (endpoint in Endpoint.entries) {
            val trackSectionEndpoint = EndpointTrackSectionId(trackSectionIdx, endpoint)
            val node = builder.getNodeAtEndpoint(trackSectionEndpoint) ?: continue

            val zoneRoot = uf.findRoot(trackSectionEndpoint.index.toInt())
            if (!rootToZoneMap.containsKey(zoneRoot)) {
                rootToZoneMap[zoneRoot] = builder.zone(listOf())
            }
            val zoneIdx = rootToZoneMap[zoneRoot]!!

            builder.zoneAddNode(zoneIdx, node)

            if (detectors.size != 0) {
                val dirDetector =
                    if (endpoint == Endpoint.START) detectors[0].decreasing
                    else detectors[detectors.size - 1].increasing
                builder.setNextZone(dirDetector, zoneIdx)
            }
        }

        // for each detector pair inside the track section
        for (detectorIndex in 0 until detectors.size - 1) {
            val leftDetector = detectors[detectorIndex]
            val rightDetector = detectors[detectorIndex + 1]
            val zoneIdx = builder.zone(listOf())
            builder.setNextZone(leftDetector.increasing, zoneIdx)
            builder.setNextZone(rightDetector.decreasing, zoneIdx)
        }
    }
}

fun adaptRawInfra(infra: SignalingInfra, rjsInfra: RJSInfra): SimInfraAdapter {
    val builder = RawInfraFromRjsBuilder()
    // TODO: remove this once stitching is useless
    val oldDetectorMap = HashBiMap.create<Detector, DetectorId>()
    val trackNodeMap = HashBiMap.create<Switch, TrackNodeId>()
    // TODO: remove this once stitching is useless
    val oldTrackSectionMap = HashBiMap.create<TrackEdge, TrackSectionId>()
    val trackNodeGroupsMap = mutableMapOf<Switch, Map<String, TrackNodeConfigId>>()
    val signalMap = HashBiMap.create<String, PhysicalSignalId>()
    val rjsSignalMap = HashBiMap.create<String, RJSSignal>()
    val routeMap = HashBiMap.create<ReservationRoute, RouteId>()
    // TODO: remove this once stitching is useless
    val oldTrackChunkMap = mutableMapOf<UndirectedTrackSection, Map<Distance, TrackChunkId>>()

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
    val detectorNameIndex = mutableMapOf<String, DetectorId>()
    for (rjsTrack in rjsInfra.trackSections) {
        val trackSectionChunks = mutableStaticIdxArrayListOf<TrackChunk>()

        val trackSectionLength = Offset<TrackSection>(rjsTrack.length.meters)
        val trackSectionGeo = parseLineString(rjsTrack.geo)!!
        val trackSectionSlopes = getSlopes(rjsTrack)
        val trackSectionCurves = getCurves(rjsTrack)
        val trackSectionBlockedGauges = getBlockedGauge(rjsTrack)

        var chunkStartOffset = Offset<TrackSection>(0.meters)
        val trackSectionDistanceSortedDetectorIdxs =
            trackSectionNameToDistanceSortedDetectors[rjsTrack.id] ?: TreeMap()
        // finalize chunks on any detector that isn't placed at offset=0
        val chunkEndOffsets =
            trackSectionDistanceSortedDetectorIdxs.keys
                .filter { d -> d.distance != Distance.ZERO }
                .toMutableList()
        if (chunkEndOffsets.isEmpty() || chunkEndOffsets.last() != trackSectionLength)
            chunkEndOffsets.add(trackSectionLength)

        for (chunkEndOffset in chunkEndOffsets) {
            if (chunkEndOffset > trackSectionLength || chunkEndOffset < Offset(Distance.ZERO)) {
                throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Splitting trackSection ${rjsTrack.id} at a detector's offset $chunkEndOffsets out of range"
                )
            }
            val chunkSlopes =
                getChunkDirectionalDistanceRange(
                    trackSectionSlopes,
                    chunkStartOffset,
                    chunkEndOffset
                )
            val chunkCurves =
                getChunkDirectionalDistanceRange(
                    trackSectionCurves,
                    chunkStartOffset,
                    chunkEndOffset
                )

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
            chunkStartOffset = chunkEndOffset
        }
        val trackSectionId = builder.trackSection(rjsTrack.id, trackSectionChunks)
        for (detector in trackSectionDistanceSortedDetectorIdxs) {
            val detectorId = builder.detector(trackSectionId, detector.key, detector.value)
            for (detectorName in detector.value) {
                detectorNameIndex[detectorName] = detectorId
            }
        }
    }

    // Parse electrifications
    for (electrification in rjsInfra.electrifications) {
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

                    chunk.electrificationVoltage.put(
                        chunkLower,
                        chunkUpper,
                        electrification.voltage
                    )
                }
            builder.applyFunctionToTrackSectionChunksBetween(
                electrificationRange.trackSectionID,
                electrificationRange.begin.meters,
                electrificationRange.end.meters,
                applyElectrificationForChunkBetween
            )
        }
    }

    // Parse neutral-sections
    fun parseNeutralRanges(
        isAnnouncement: Boolean,
        neutralSection: RJSNeutralSection,
    ) {
        val trackRanges =
            if (isAnnouncement) neutralSection.announcementTrackRanges
            else neutralSection.trackRanges
        for (trackRange in trackRanges) {
            val applyNeutralSectionForChunkBetween =
                { chunk: TrackChunkDescriptor, chunkLower: Distance, chunkUpper: Distance ->
                    val track = trackRange.trackSectionID
                    val dir = Direction.fromEdgeDir(trackRange.direction).toKtDirection()
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

                    chunkDirNeutralSections.put(
                        dirChunkLower,
                        dirChunkUpper,
                        incomingNeutralSection
                    )

                    // TODO: remove this priority given to announcement.
                    // Only added to match previous load, but no functional need exists
                    if (!isAnnouncement) {
                        chunkDirNeutralSections.putMany(previousDirNeutralSections.asList())
                    }
                }
            builder.applyFunctionToTrackSectionChunksBetween(
                trackRange.trackSectionID,
                trackRange.begin.meters,
                trackRange.end.meters,
                applyNeutralSectionForChunkBetween
            )
        }
    }

    for (neutralSection in rjsInfra.neutralSections) {
        parseNeutralRanges(false, neutralSection)
        parseNeutralRanges(true, neutralSection)
    }

    // Parse speed-sections
    fun mergeIntoSpeedSections(
        initialSpeedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>,
        direction: fr.sncf.osrd.utils.Direction,
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
                    SpeedSection.merge(
                        prevSpeedSection.value,
                        parseSpeedSection(incomingSpeedSection)
                    )
                )
            }
        initialSpeedSections.get(direction).putMany(subMap)
    }

    for (speedSection in rjsInfra.speedSections) {
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

    // parse operational points
    for (operationalPoint in rjsInfra.operationalPoints) {
        val distinctParts = mutableSetOf<RJSOperationalPointPart>()
        for (opPart in operationalPoint.parts) {
            // ignore duplicates
            if (distinctParts.contains(opPart)) continue

            distinctParts.add(opPart)
            builder.operationalPointPart(
                operationalPoint.id,
                opPart.track,
                Offset(opPart.position.meters)
            )
        }
    }

    // parse nodes
    val switchTypeMap =
        ((rjsInfra.switchTypes ?: listOf()) + RJSSwitchType.BUILTIN_NODE_TYPES_LIST).associateBy {
            switchType ->
            switchType.id
        }

    val nodeNameToIdxMap = mutableMapOf<String, TrackNodeId>()
    for (rjsNode in rjsInfra.switches) {
        val ports = StaticPool<TrackNodePort, EndpointTrackSectionId>()
        val portMap = mutableMapOf<String, TrackNodePortId>()
        for ((rjsPortName, rjsPort) in rjsNode.ports) {
            portMap[rjsPortName] =
                ports.add(
                    builder.getTrackSectionEndpointIdx(
                        rjsPort.track,
                        Endpoint.fromEdgeEndpoint(rjsPort.endpoint)
                    )
                )
        }
        val switchType =
            switchTypeMap[rjsNode.switchType]
                ?: throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Node ${rjsNode.id} references unknown switch-type ${rjsNode.switchType}"
                )
        if (
            rjsNode.ports.size != switchType.ports.size || portMap.keys != switchType.ports.toSet()
        ) {
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
        nodeNameToIdxMap[rjsNode.id] =
            builder.node(rjsNode.id, rjsNode.groupChangeDelay.seconds, ports, configs)
    }

    // process detection zones
    buildZones(builder)

    // TODO: remove this stitching between new way of loading infra directly from railjson and
    // previous way of loading infra
    for (edge in infra.trackGraph.edges()) {
        val track = edge as? UndirectedTrackSection
        if (track != null) {
            oldTrackSectionMap[track] = builder.getTrackSectionByName(track.id)

            val chunkMap = mutableMapOf<Distance, TrackChunkId>()
            for (entry in
                builder.getTrackSectionDistanceSortedChunkMap()[oldTrackSectionMap[track]]!!) {
                chunkMap[entry.key] = entry.value
            }
            oldTrackChunkMap[track] = chunkMap

            for (detector in track.detectors) {
                oldDetectorMap[detector] = detectorNameIndex[detector.id]
            }
        }
    }
    for (switchEntry in infra.switches) {
        val oldSwitch = switchEntry.value!!
        trackNodeMap[oldSwitch] = nodeNameToIdxMap[oldSwitch.id]

        val switchGroups = mutableMapOf<String, TrackNodeConfigId>()
        val configs = builder.getTrackNodePool()[nodeNameToIdxMap[oldSwitch.id]!!].configs
        for (configIdx in configs) {
            switchGroups[configs[configIdx].name] = configIdx
        }
        trackNodeGroupsMap[oldSwitch] = switchGroups
    }

    // TODO: this horrible hack is required as we currently parse signals before routes, and need to
    //   build logical signals with routes IDs. It can be removed once signals are parsed after
    //   routes. What this hack does is that it modifies signal conditional parameters after signals
    //   are created
    val delayedConditionalParameters =
        mutableMapOf<
            /* for the route with id */
            String,
            /* for each conditional parameter involving this route */
            MutableList<
                /* once the route ID is known */
                Pair<
                    /* add these parameters */
                    Map<String, String>,
                    /* to this map, which was already passed to the builder */
                    MutableMap<RouteId, Map<String, String>>
                >
            >
        >()

    // parse signals
    for (rjsSignal in rjsInfra.signals) {
        rjsSignalMap[rjsSignal.id] = rjsSignal
        val trackSectionId = builder.getTrackSectionByName(rjsSignal.track)
        val direction =
            when (rjsSignal.direction!!) {
                EdgeDirection.START_TO_STOP -> INCREASING
                EdgeDirection.STOP_TO_START -> DECREASING
            }
        val undirectedTrackOffset = Offset<TrackSection>(rjsSignal.position.meters)
        val signalId =
            builder.physicalSignal(
                rjsSignal.id,
                rjsSignal.sightDistance.meters,
                DirTrackSectionId(trackSectionId, direction),
                undirectedTrackOffset
            ) {
                if (rjsSignal.logicalSignals == null) return@physicalSignal
                for (rjsLogicalSignal in rjsSignal.logicalSignals) {
                    assert(
                        rjsLogicalSignal.signalingSystem != null &&
                            rjsLogicalSignal.signalingSystem.isNotEmpty()
                    )
                    assert(rjsLogicalSignal.nextSignalingSystems != null)
                    assert(rjsLogicalSignal.settings != null)
                    for (sigSystem in rjsLogicalSignal.nextSignalingSystems) assert(
                        sigSystem.isNotEmpty()
                    )
                    val conditionalParameters = mutableMapOf<RouteId, Map<String, String>>()
                    /*
                    TODO: implement conditional parameters directly
                    rjsLogicalSignal.conditionalParameters.associate {
                        Pair(routeNameToID[it.onRoute]!!, it.parameters)
                    }*/
                    val rawParameters =
                        RawSignalParameters(
                            rjsLogicalSignal.defaultParameters,
                            conditionalParameters,
                        )
                    for (conditionalParameter in rjsLogicalSignal.conditionalParameters) {
                        val routeParams =
                            delayedConditionalParameters.computeIfAbsent(
                                conditionalParameter.onRoute
                            ) {
                                mutableListOf()
                            }
                        routeParams.add(
                            Pair(conditionalParameter.parameters, conditionalParameters)
                        )
                    }

                    logicalSignal(
                        rjsLogicalSignal.signalingSystem,
                        rjsLogicalSignal.nextSignalingSystems,
                        rjsLogicalSignal.settings,
                        rawParameters
                    )
                }
            }
        signalMap[rjsSignal.id] = signalId
    }

    fun getOrCreateDet(oldDiDetector: DiDetector): DirDetectorId {
        val oldDetector = oldDiDetector.detector
        val detector = oldDetectorMap[oldDetector!!]!!
        return when (oldDiDetector.direction!!) {
            Direction.FORWARD -> detector.increasing
            Direction.BACKWARD -> detector.decreasing
        }
    }

    // translate routes
    for (route in infra.reservationRouteMap.values) {
        val routeId =
            builder.route(route.id) {
                val oldPath = route.detectorPath!!
                val oldReleasePoints = route.releasePoints!!
                val viewIterator = TrackRangeViewIterator(route!!.trackRanges)

                // as we iterate over the detection sections, we need to compute the length of each
                // detection section path as well as the position of switches contained within.
                // sadly, these two iteration processes were combined by the idiot behind this code:
                // myself
                // parse the zone path and switch positions for this route
                var releaseIndex = 0
                for (startDetIndex in 0 until oldPath.size - 1) {
                    val oldStartDet = oldPath[startDetIndex]
                    val oldEndDet = oldPath[startDetIndex + 1]
                    val entry = getOrCreateDet(oldStartDet)
                    val exit = getOrCreateDet(oldEndDet)
                    val zonePathId =
                        buildZonePath(
                            viewIterator,
                            oldStartDet,
                            oldEndDet,
                            entry,
                            exit,
                            trackNodeMap,
                            trackNodeGroupsMap,
                            oldTrackChunkMap,
                            builder
                        )

                    // check if the zone is a release zone
                    if (
                        releaseIndex < oldReleasePoints.size &&
                            oldEndDet.detector!! == oldReleasePoints[releaseIndex]
                    ) {
                        releaseZone(startDetIndex)
                        releaseIndex++
                    }
                    this@route.zonePath(zonePathId)
                }

                // if the old route did not have a release point at its last detector,
                // add the missing implicit end release point
                if (
                    oldReleasePoints.isEmpty() || oldReleasePoints.last() != oldPath.last().detector
                ) {
                    releaseZone(oldPath.size - 2)
                }
            }
        routeMap[route] = routeId

        // TODO: remove this hack once signals are parsed after routes
        val routeCondParams = delayedConditionalParameters[route.id] ?: continue
        for (routeCondParam in routeCondParams) {
            routeCondParam.second[routeId] = routeCondParam.first
        }
    }

    // TODO: check the length of built routes is the same as on the base infra
    // assert(route.length.meters == routeLength)

    val rawInfra =
        SimInfraAdapter(
            builder.build(),
            oldDetectorMap,
            trackNodeMap,
            trackNodeGroupsMap,
            routeMap,
            signalMap,
            rjsSignalMap
        )
    val controlInfra = adaptRawInfra(infra)
    assertEqualSimInfra(rawInfra, controlInfra)
    return rawInfra
}

private fun buildZonePath(
    viewIterator: TrackRangeViewIterator,
    oldStartDet: DiDetector,
    oldEndDet: DiDetector,
    entry: DirDetectorId,
    exit: DirDetectorId,
    trackNodeMap: HashBiMap<Switch, TrackNodeId>,
    trackNodeGroupsMap: MutableMap<Switch, Map<String, TrackNodeConfigId>>,
    trackChunkMap: MutableMap<UndirectedTrackSection, Map<Distance, TrackChunkId>>,
    builder: RawInfraFromRjsBuilder
): ZonePathId {
    // at this point, we have trackRangeIndex pointing to the track range which contains the entry
    // detector
    // we need iterate on track range until we reach the track range which contains the end
    // detector.
    // meanwhile, we also need to:
    // 1) locate switches inside the zone path
    // 2) compute the length of each zone path
    // 3) compute the zone path's track section path in order to find signals

    var zonePathLength = Offset<ZonePath>(0.meters)
    val movableElements = MutableStaticIdxArrayList<TrackNode>()
    val movableElementsConfigs = MutableStaticIdxArrayList<TrackNodeConfig>()
    val movableElementsDistances = MutableOffsetArrayList<ZonePath>()

    val zoneTrackPath = mutableListOf<ZonePathTrackSpan>()
    assert(viewIterator.view.track.edge == oldStartDet.detector.trackSection)
    if (oldStartDet.detector.trackSection == oldEndDet.detector.trackSection) {
        val track = oldStartDet.detector.trackSection
        // if the start and end detectors are on the same track, we don't need to increment anything
        assert(viewIterator.view.track.edge == track)
        val startOffset = oldStartDet.detector.offset.meters
        val endOffset = oldEndDet.detector.offset.meters
        val span =
            if (startOffset < endOffset)
                ZonePathTrackSpan(track, startOffset, endOffset, Direction.FORWARD)
            else ZonePathTrackSpan(track, endOffset, startOffset, Direction.BACKWARD)
        zoneTrackPath.add(span)
        zonePathLength += span.length
    } else {
        // when the start and end detectors are not on the same track
        while (true) {
            val curView = viewIterator.view
            val edge = curView.track!!.edge
            if (edge is SwitchBranch) {
                // We assume SwitchBranch have zero length
                assert(curView.end.meters == curView.begin.meters)
                // We assume paths do not end on a SwitchBranch
                assert(curView.track.edge != oldEndDet.detector.trackSection)
                val movableElement = trackNodeMap[edge.switch]!!
                val branchGroup = edge.switch!!.findBranchGroup(edge)!!
                val movableElementConfig = trackNodeGroupsMap[edge.switch]!![branchGroup]!!
                movableElements.add(movableElement)
                movableElementsConfigs.add(movableElementConfig)
                movableElementsDistances.add(zonePathLength)
                viewIterator.next()
                continue
            }
            val trackSection = edge as UndirectedTrackSection
            val trackSpan = zonePathTrackSpan(trackSection, curView, oldStartDet, oldEndDet)
            zoneTrackPath.add(trackSpan)
            zonePathLength += trackSpan.length

            if (curView.track.edge == oldEndDet.detector.trackSection) {
                break
            }
            viewIterator.next()
        }
    }

    // Build chunk list
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    for (range in zoneTrackPath) {
        if (range.begin == range.end) {
            // 0-length ranges can happen at track transition.
            // They can and should be ignored, adding the chunk starting there would add an extra
            // chunk.
            // We assert that we are at a track transition, and move on
            assert(range.end == range.track.length.meters || range.end == 0.meters)
        } else {
            val chunk = trackChunkMap[range.track]!![range.begin]!!
            chunks.add(DirStaticIdx(chunk, range.direction.toKtDirection()))
        }
    }

    return builder.zonePath(
        entry,
        exit,
        movableElements,
        movableElementsConfigs,
        movableElementsDistances,
        chunks
    )
}

/**
 * Compute the length of the part of a zone path segments which spans a given track. Only works for
 * zone paths which span multiple tracks.
 */
private fun zonePathTrackSpan(
    track: UndirectedTrackSection,
    curView: TrackRangeView,
    oldStartDiDet: DiDetector,
    oldEndDiDet: DiDetector
): ZonePathTrackSpan {
    val oldStartDet = oldStartDiDet.detector
    val oldEndDet = oldEndDiDet.detector
    assert(oldStartDet.trackSection != oldEndDet.trackSection)
    val trackLen = track.length.meters
    val direction = curView.track.direction
    return if (track == oldStartDet.trackSection) {
        assert(direction == oldStartDiDet.direction)
        if (direction == Direction.FORWARD)
            ZonePathTrackSpan(track, oldStartDet.offset.meters, trackLen, Direction.FORWARD)
        else ZonePathTrackSpan(track, 0.meters, oldStartDet.offset.meters, Direction.BACKWARD)
    } else if (track == oldEndDet.trackSection) {
        assert(direction == oldEndDiDet.direction)
        if (direction == Direction.FORWARD)
            ZonePathTrackSpan(track, 0.meters, oldEndDet.offset.meters, Direction.FORWARD)
        else ZonePathTrackSpan(track, oldEndDet.offset.meters, trackLen, Direction.BACKWARD)
    } else {
        ZonePathTrackSpan(track, 0.meters, trackLen, direction)
    }
}
