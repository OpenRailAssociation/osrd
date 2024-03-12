package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.HashBiMap
import com.google.common.collect.ImmutableSet
import com.google.common.collect.Sets
import com.google.common.primitives.Doubles
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.reservation.DetectionSection
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
import fr.sncf.osrd.sim_infra.api.DetectorId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.EndpointTrackSectionId
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint
import fr.sncf.osrd.sim_infra.api.PhysicalSignal
import fr.sncf.osrd.sim_infra.api.PhysicalSignalId
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.TrackNode
import fr.sncf.osrd.sim_infra.api.TrackNodeConfig
import fr.sncf.osrd.sim_infra.api.TrackNodeConfigId
import fr.sncf.osrd.sim_infra.api.TrackNodeId
import fr.sncf.osrd.sim_infra.api.TrackNodePort
import fr.sncf.osrd.sim_infra.api.TrackNodePortId
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.sim_infra.api.ZonePathId
import fr.sncf.osrd.sim_infra.api.decreasing
import fr.sncf.osrd.sim_infra.api.increasing
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.sim_infra.impl.RawInfraFromRjsBuilderImpl
import fr.sncf.osrd.sim_infra.impl.SpeedSection
import fr.sncf.osrd.sim_infra.impl.TrackChunkDescriptor
import fr.sncf.osrd.sim_infra.impl.TrackNodeConfigDescriptor
import fr.sncf.osrd.utils.Direction.DECREASING
import fr.sncf.osrd.utils.Direction.INCREASING
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.Endpoint
import fr.sncf.osrd.utils.assertEqualSimInfra
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticPool
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArraySetOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.MutableOffsetArrayList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.collections.set
import kotlin.math.abs
import kotlin.time.Duration.Companion.seconds
import org.slf4j.Logger
import org.slf4j.LoggerFactory

val logger: Logger = LoggerFactory.getLogger(RawInfraBuilder::class.java)

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
                .map { s ->
                    DistanceRangeMap.RangeMapEntry(
                        chunkLength - s.upper,
                        chunkLength - s.lower,
                        if (s.value == 0.0) 0.0 else -s.value
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
    rjsWaypoint: RJSRouteWaypoint,
    builder: RawInfraFromRjsBuilderImpl,
    trackSectionNameToDistanceSortedWaypointIdxs:
        MutableMap<String, TreeMap<Offset<TrackSection>, DetectorId>>,
    detectorMap: MutableMap<String, DetectorId>,
) {
    val waypointIdx = builder.detector(rjsWaypoint.id)
    detectorMap[rjsWaypoint.id] = waypointIdx

    if (!trackSectionNameToDistanceSortedWaypointIdxs.containsKey(rjsWaypoint.track)) {
        trackSectionNameToDistanceSortedWaypointIdxs[rjsWaypoint.track] =
            TreeMap<Offset<TrackSection>, DetectorId>()
    }
    trackSectionNameToDistanceSortedWaypointIdxs[rjsWaypoint.track]!![
        Offset(rjsWaypoint.position.meters)] = waypointIdx
}

fun adaptRawInfra(infra: SignalingInfra, rjsInfra: RJSInfra): SimInfraAdapter {
    val builder = RawInfraFromRjsBuilderImpl()
    val zoneMap = HashBiMap.create<DetectionSection, ZoneId>()
    // TODO: check if this can be remove once stitching is useless
    val detectorMap: MutableMap<String, DetectorId> = mutableMapOf()
    // TODO: remove this once stitching is useless
    val oldDetectorMap = HashBiMap.create<Detector, DetectorId>()
    val trackNodeMap = HashBiMap.create<Switch, TrackNodeId>()
    // TODO: remove this once stitching is useless
    val oldTrackSectionMap = HashBiMap.create<TrackEdge, TrackSectionId>()
    val trackNodeGroupsMap = mutableMapOf<Switch, Map<String, TrackNodeConfigId>>()
    val signalsPerTrack = mutableMapOf<String, MutableList<TrackSignal>>()
    val signalMap = HashBiMap.create<String, PhysicalSignalId>()
    val rjsSignalMap = HashBiMap.create<String, RJSSignal>()
    val routeMap = HashBiMap.create<ReservationRoute, RouteId>()
    // TODO: remove this once stitching is useless
    val oldTrackChunkMap = mutableMapOf<UndirectedTrackSection, Map<Distance, TrackChunkId>>()

    // Parse waypoints (detectors, buffer-stops)
    val trackSectionNameToDistanceSortedWaypointIdxs =
        mutableMapOf<String, TreeMap<Offset<TrackSection>, DetectorId>>()

    for (detector in rjsInfra.detectors) {
        parseRjsRouteWaypoint(
            detector,
            builder,
            trackSectionNameToDistanceSortedWaypointIdxs,
            detectorMap
        )
    }
    for (detector in rjsInfra.bufferStops) {
        parseRjsRouteWaypoint(
            detector,
            builder,
            trackSectionNameToDistanceSortedWaypointIdxs,
            detectorMap
        )
    }

    // Parse track-sections
    for (rjsTrack in rjsInfra.trackSections) {
        val trackSectionChunks = mutableStaticIdxArrayListOf<TrackChunk>()

        val trackSectionLength = Offset<TrackSection>(rjsTrack.length.meters)
        val trackSectionGeo = parseLineString(rjsTrack.geo)!!
        val trackSectionSlopes = getSlopes(rjsTrack)
        val trackSectionCurves = getCurves(rjsTrack)
        val trackSectionBlockedGauges = getBlockedGauge(rjsTrack)

        var chunkStartOffset = Offset<TrackSection>(0.meters)
        val trackSectionDistanceSortedWaypointIdxs =
            trackSectionNameToDistanceSortedWaypointIdxs[rjsTrack.id] ?: TreeMap()
        // ignore 0 offset that is a chunk's start
        val chunkEndOffsets =
            trackSectionDistanceSortedWaypointIdxs.keys
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
        builder.trackSection(rjsTrack.id, trackSectionChunks)
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
                    SpeedSection.merge(prevSpeedSection.value, SpeedSection(incomingSpeedSection))
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
        listOf(rjsInfra.switchTypes, RJSSwitchType.BUILTIN_NODE_TYPES_LIST).flatten().associateBy {
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
                    group.value
                        .map { connection ->
                            Pair(portMap[connection.src]!!, portMap[connection.dst]!!)
                        }
                        .toList()
                )
            )
        }
        nodeNameToIdxMap[rjsNode.id] =
            builder.node(rjsNode.id, rjsNode.groupChangeDelay.seconds, ports, configs)
    }

    // TODO: remove this stitching between new way of loading infra directly from railjson and
    // previous way of loading infra
    for (edge in infra.trackGraph.edges()) {
        val track = edge as? UndirectedTrackSection
        if (track != null) {
            oldTrackSectionMap[track] = builder.getTrackSectionNameToIdxMap()[track.id]

            val chunkMap = mutableMapOf<Distance, TrackChunkId>()
            for (entry in
                builder.getTrackSectionDistanceSortedChunkMap()[oldTrackSectionMap[track]]!!) {
                chunkMap[entry.key] = entry.value
            }
            oldTrackChunkMap[track] = chunkMap

            for (detector in track.detectors) {
                oldDetectorMap[detector] = detectorMap[detector.id]
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

    // create zones
    fun getOrCreateDet(oldDiDetector: DiDetector): DirDetectorId {
        val oldDetector = oldDiDetector.detector
        val detector = oldDetectorMap[oldDetector!!]!!
        return when (oldDiDetector.direction!!) {
            Direction.FORWARD -> detector.increasing
            Direction.BACKWARD -> detector.decreasing
        }
    }

    val switchToZone = mutableMapOf<Switch, ZoneId>()
    for (detectionSection in infra.detectionSections) {
        val oldSwitches = detectionSection!!.switches!!
        val oldDiDetectors = detectionSection.detectors!!
        val switches = mutableStaticIdxArraySetOf<TrackNode>()
        for (oldSwitch in oldSwitches) switches.add(trackNodeMap[oldSwitch]!!)
        val detectors = mutableListOf<DirDetectorId>()
        for (oldDiDetector in oldDiDetectors) detectors.add(getOrCreateDet(oldDiDetector!!))
        val zoneId = builder.zone(switches, detectors)
        for (oldSwitch in oldSwitches) switchToZone[oldSwitch] = zoneId
        zoneMap[detectionSection] = zoneId
    }

    // parse signals
    for (rjsSignal in rjsInfra.signals) {
        rjsSignalMap[rjsSignal.id] = rjsSignal
        val trackSignals = signalsPerTrack.getOrPut(rjsSignal.track!!) { mutableListOf() }
        val signalId =
            builder.physicalSignal(rjsSignal.id, rjsSignal.sightDistance.meters) {
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
                    logicalSignal(
                        rjsLogicalSignal.signalingSystem,
                        rjsLogicalSignal.nextSignalingSystems,
                        rjsLogicalSignal.settings
                    )
                }
            }
        signalMap[rjsSignal.id] = signalId
        trackSignals.add(
            TrackSignal(
                rjsSignal.position.meters,
                Direction.fromEdgeDir(rjsSignal.direction),
                signalId
            )
        )
    }

    // sort signals by tracks
    for (trackSignals in signalsPerTrack.values) trackSignals.sortBy { it.position }

    // translate routes
    for (route in infra.reservationRouteMap.values) {
        routeMap[route] =
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
                            signalsPerTrack,
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
    }

    // TODO: check the length of built routes is the same as on the base infra
    // assert(route.length.meters == routeLength)

    val rawInfra =
        SimInfraAdapter(
            builder.build(),
            zoneMap,
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
    signalsPerTrack: Map<String, MutableList<TrackSignal>>,
    builder: RawInfraBuilder
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

    // iterate on the route's track ranges, and fetch the signals which belong there
    data class ZonePathSignal(val position: Offset<ZonePath>, val signal: PhysicalSignalId)

    val zonePathSignals: MutableList<ZonePathSignal> = mutableListOf()
    // the current position along the route, in millimeters
    var zonePathPosition = Offset<ZonePath>(Distance.ZERO)
    for (range in zoneTrackPath) {
        val edge = range.track
        val rangeBegin = range.begin
        val rangeEnd = range.end
        val trackSignals = signalsPerTrack[edge.id]
        if (trackSignals == null) {
            zonePathPosition += (rangeEnd - rangeBegin)
            continue
        }

        for (trackSignal in trackSignals) {
            // if the signal is not visible along the route's path, ignore it
            if (trackSignal.direction != range.direction) continue
            if (trackSignal.position < rangeBegin || trackSignal.position > rangeEnd) continue

            // compute the signal's position relative to the start of the zone path range
            val sigRangeStartDistance =
                if (trackSignal.direction == Direction.FORWARD) trackSignal.position - rangeBegin
                else rangeEnd - trackSignal.position

            val position = zonePathPosition + sigRangeStartDistance
            if (position.distance == Distance.ZERO) continue

            zonePathSignals.add(ZonePathSignal(position, trackSignal.signal))
        }
        zonePathPosition += (rangeEnd - rangeBegin)
    }

    val zoneLength = zonePathPosition

    zonePathSignals.sortBy { it.position }
    val signals = MutableStaticIdxArrayList<PhysicalSignal>()
    val signalPositions = MutableOffsetArrayList<ZonePath>()
    for (zonePathSignal in zonePathSignals) {
        assert(zonePathSignal.position.distance >= Distance.ZERO)
        assert(zonePathSignal.position <= zoneLength)
        signals.add(zonePathSignal.signal)
        signalPositions.add(zonePathSignal.position)
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
        Length(zonePathLength.distance),
        movableElements,
        movableElementsConfigs,
        movableElementsDistances,
        signals,
        signalPositions,
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
