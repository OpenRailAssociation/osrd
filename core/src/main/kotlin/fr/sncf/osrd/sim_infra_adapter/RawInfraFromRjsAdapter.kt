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
import fr.sncf.osrd.infra.api.tracks.undirected.*
import fr.sncf.osrd.infra.api.tracks.undirected.Detector
import fr.sncf.osrd.infra.api.tracks.undirected.TrackNode.Joint
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackEdgeImpl
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.infra.implementation.tracks.undirected.LoadingGaugeConstraintImpl
import fr.sncf.osrd.infra.implementation.tracks.undirected.UndirectedInfraBuilder
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.RJSInfra
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSNeutralSection
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.api.TrackNode
import fr.sncf.osrd.sim_infra.impl.*
import fr.sncf.osrd.sim_infra.impl.NeutralSection as SimNeutralSection
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import java.util.*
import kotlin.collections.set
import kotlin.math.abs
import kotlin.time.Duration.Companion.ZERO
import kotlin.time.Duration.Companion.seconds

private fun parseLineString(rjs: RJSLineString?): LineString? {
    if (rjs == null) return null
    val xs = java.util.ArrayList<Double>()
    val ys = java.util.ArrayList<Double>()
    for (p in rjs.coordinates) {
        assert(p.size == 2)
        xs.add(p[0])
        ys.add(p[1])
    }
    return LineString.make(Doubles.toArray(xs), Doubles.toArray(ys))
}

fun getGeo(rjsTrack: RJSTrackSection): LineString? {
    return parseLineString(rjsTrack.geo)
}

/** Computes the slopes RangeMap of a track section for both directions. */
private fun getSlopes(rjsTrack: RJSTrackSection): DirectionalMap<DistanceRangeMap<Double>> {
    val slopes = DirectionalMap(distanceRangeMapOf<Double>(), distanceRangeMapOf<Double>())
    slopes.get(fr.sncf.osrd.utils.Direction.INCREASING).put(0.meters, rjsTrack.length.meters, 0.0)

    if (rjsTrack.slopes != null) {
        for (rjsSlope in rjsTrack.slopes) {
            rjsSlope.simplify()
            if (rjsSlope.begin < 0 || rjsSlope.end > rjsTrack.length)
                throw UndirectedInfraBuilder.newInvalidRangeError(
                    ErrorType.InvalidInfraTrackSlopeWithInvalidRange,
                    rjsTrack.id
                )
            if (rjsSlope.gradient != 0.0) {
                slopes
                    .get(fr.sncf.osrd.utils.Direction.INCREASING)
                    .put(rjsSlope.begin.meters, rjsSlope.end.meters, rjsSlope.gradient)
            }
        }
    }

    // complete decreasing
    slopes
        .get(fr.sncf.osrd.utils.Direction.DECREASING)
        .putMany(
            slopes
                .get(fr.sncf.osrd.utils.Direction.INCREASING)
                .reversed()
                .map { s ->
                    DistanceRangeMap.RangeMapEntry(
                        rjsTrack.length.meters - s.upper,
                        rjsTrack.length.meters - s.lower,
                        if (s.value == 0.0) 0.0 else -s.value
                    )
                }
                .toList()
        )
    return slopes
}

/** Computes the curves RangeMap of a track section for both directions. */
private fun getCurves(rjsTrack: RJSTrackSection): DirectionalMap<DistanceRangeMap<Double>> {
    val curves = DirectionalMap(distanceRangeMapOf<Double>(), distanceRangeMapOf<Double>())
    curves.get(fr.sncf.osrd.utils.Direction.INCREASING).put(0.meters, rjsTrack.length.meters, 0.0)

    if (rjsTrack.curves != null) {
        for (rjsCurve in rjsTrack.curves) {
            rjsCurve.simplify()
            if (rjsCurve.begin < 0 || rjsCurve.end > rjsTrack.length)
                throw UndirectedInfraBuilder.newInvalidRangeError(
                    ErrorType.InvalidInfraTrackSlopeWithInvalidRange,
                    rjsTrack.id
                )
            if (rjsCurve.radius != 0.0) {
                curves
                    .get(fr.sncf.osrd.utils.Direction.INCREASING)
                    .put(rjsCurve.begin.meters, rjsCurve.end.meters, rjsCurve.radius)
            }
        }
    }

    // complete decreasing
    curves
        .get(fr.sncf.osrd.utils.Direction.DECREASING)
        .putMany(
            curves
                .get(fr.sncf.osrd.utils.Direction.INCREASING)
                .reversed()
                .map { s ->
                    DistanceRangeMap.RangeMapEntry(
                        rjsTrack.length.meters - s.upper,
                        rjsTrack.length.meters - s.lower,
                        if (s.value == 0.0) 0.0 else -s.value
                    )
                }
                .toList()
        )

    return curves
}

/**
 * Computes the gradients RangeMap from the slopes and curves RangeMaps. gradient = slope + 800 /
 * |radius|
 */
private fun getGradients(
    slopes: DistanceRangeMap<Double>,
    curves: DistanceRangeMap<Double>
): DistanceRangeMap<Double> {
    assert(slopes.lowerBound() == Distance(0))
    assert(curves.lowerBound() == Distance(0))
    assert(slopes.upperBound() == curves.upperBound())
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
        lower = upper
        if ((currentSlope.upper <= currentCurve.upper) and currentSlopeIt.hasNext()) {
            currentSlope = currentSlopeIt.next()
        }
        if ((currentCurve.upper <= currentSlope.upper) and currentCurveIt.hasNext()) {
            currentCurve = currentCurveIt.next()
        }
    }

    return gradients
}

/** Builds the ranges of blocked loading gauge types on the track */
private fun getBlockedGauge(rjsTrack: RJSTrackSection): DistanceRangeMap<LoadingGaugeConstraint> {
    // This method has a bad complexity compared to more advanced solutions,
    // but we don't expect more than a few ranges per section.
    // TODO: use an interval tree
    val res = distanceRangeMapOf<LoadingGaugeConstraint>()
    if ((rjsTrack.loadingGaugeLimits == null) || (rjsTrack.loadingGaugeLimits.isEmpty())) return res

    // Sorts and removes duplicates
    val transitions = TreeSet<Double>()
    for (range in rjsTrack.loadingGaugeLimits) {
        transitions.add(range.begin)
        transitions.add(range.end)
    }

    val transitionsList = ArrayList(transitions) // Needed for index based loop
    for (i in 1 until transitionsList.size) {
        val begin = transitionsList[i - 1]
        val end = transitionsList[i]
        val allowedTypes = HashSet<RJSLoadingGaugeType>()
        for (range in rjsTrack.loadingGaugeLimits) if (range.begin <= begin && range.end >= end)
            allowedTypes.addAll(compatibleGaugeType[range.category]!!)
        val blockedTypes = Sets.difference(enumValues<RJSLoadingGaugeType>().toSet(), allowedTypes)
        res.put(
            begin.meters,
            end.meters,
            LoadingGaugeConstraintImpl(ImmutableSet.copyOf(blockedTypes))
        )
    }
    return res
}

/** Returns all the rolling stock gauge types compatible with the given track type */
fun getCompatibleGaugeTypes(trackType: RJSLoadingGaugeType): Set<RJSLoadingGaugeType> {
    return when (trackType) {
        RJSLoadingGaugeType.G1 -> setOf(RJSLoadingGaugeType.G1)
        RJSLoadingGaugeType.GA ->
            Sets.union(
                setOf(RJSLoadingGaugeType.GA),
                getCompatibleGaugeTypes(RJSLoadingGaugeType.G1)
            )
        RJSLoadingGaugeType.GB ->
            Sets.union(
                setOf(RJSLoadingGaugeType.GB, RJSLoadingGaugeType.FR3_3_GB_G2),
                getCompatibleGaugeTypes(RJSLoadingGaugeType.GA)
            )
        RJSLoadingGaugeType.GB1 ->
            Sets.union(
                setOf(RJSLoadingGaugeType.GB1),
                getCompatibleGaugeTypes(RJSLoadingGaugeType.GB)
            )
        RJSLoadingGaugeType.GC ->
            Sets.union(
                setOf(RJSLoadingGaugeType.GC),
                getCompatibleGaugeTypes(RJSLoadingGaugeType.GB1)
            )
        RJSLoadingGaugeType.G2 ->
            Sets.union(
                setOf(RJSLoadingGaugeType.G2, RJSLoadingGaugeType.FR3_3_GB_G2),
                getCompatibleGaugeTypes(RJSLoadingGaugeType.G1)
            )
        RJSLoadingGaugeType.FR3_3 ->
            setOf(RJSLoadingGaugeType.FR3_3, RJSLoadingGaugeType.FR3_3_GB_G2)
        RJSLoadingGaugeType.GLOTT -> setOf(RJSLoadingGaugeType.GLOTT)
        else -> {
            //            diagnosticRecorder.register(Warning("Invalid gauge type for track:
            // $trackType")) TODO PEB
            enumValues<RJSLoadingGaugeType>().toSet()
        }
    }
}

fun getCompatibleGaugeTypes(): Map<RJSLoadingGaugeType, Set<RJSLoadingGaugeType>> {
    val compatibleGaugeType = hashMapOf<RJSLoadingGaugeType, Set<RJSLoadingGaugeType>>()
    for (gaugeType in enumValues<RJSLoadingGaugeType>()) {
        compatibleGaugeType[gaugeType] = getCompatibleGaugeTypes(gaugeType)
    }
    return compatibleGaugeType
}

@JvmField val compatibleGaugeType = getCompatibleGaugeTypes()

fun getNeutralSections(
    rjsNeutralSections:
        DirectionalMap<DistanceRangeMap<fr.sncf.osrd.sim_infra.impl.NeutralSection>>?,
    trackLength: Distance
): DirectionalMap<DistanceRangeMap<fr.sncf.osrd.sim_infra.impl.NeutralSection>> {
    if (rjsNeutralSections == null)
        return DirectionalMap(distanceRangeMapOf(), distanceRangeMapOf())

    val neutralSections =
        DirectionalMap(
            rjsNeutralSections.get(fr.sncf.osrd.utils.Direction.INCREASING),
            distanceRangeMapOf()
        )
    for (n in rjsNeutralSections.get(fr.sncf.osrd.utils.Direction.DECREASING).reversed()) {
        neutralSections
            .get(fr.sncf.osrd.utils.Direction.DECREASING)
            .put(trackLength - n.upper, trackLength - n.lower, n.value)
    }
    return neutralSections
}

private fun makeSpeedSection(
    rjsTrack: RJSTrackSection,
    rjsInfra: RJSInfra
): DirectionalMap<DistanceRangeMap<SpeedSection>> {
    return DirectionalMap(distanceRangeMapOf<SpeedSection>(), distanceRangeMapOf<SpeedSection>())
}

fun adaptRawInfra(infra: SignalingInfra, rjsInfra: RJSInfra): SimInfraAdapter {
    val builder = RawInfraFromRjsBuilderImpl()
    val zoneMap = HashBiMap.create<DetectionSection, ZoneId>()
    val detectorMap: MutableMap<String, DetectorId> = mutableMapOf()
    val oldDetectorMap = HashBiMap.create<Detector, DetectorId>() // TODO PEB couture
    val trackNodeMap = HashBiMap.create<Switch, TrackNodeId>()
    val trackSectionMap = HashBiMap.create<TrackEdge, TrackSectionId>() // TODO PEB couture
    val rjsTrackSectionMap =
        HashBiMap.create<
            String, TrackSectionId
        >() // TODO PEB: new (use complete obj?) and not required
    val trackNodeGroupsMap = mutableMapOf<Switch, Map<String, TrackNodeConfigId>>()
    val signalsPerTrack: MutableMap<String, MutableList<TrackSignal>> =
        mutableMapOf() // TODO PEB: not required
    val signalMap = HashBiMap.create<String, PhysicalSignalId>()
    val rjsSignalMap = HashBiMap.create<String, RJSSignal>()
    val routeMap = HashBiMap.create<ReservationRoute, RouteId>()
    val trackChunkMap =
        mutableMapOf<TrackSectionId, TreeMap<Distance, TrackChunkId>>() // TODO PEB: not required
    val oldTrackChunkMap =
        mutableMapOf<TrackSection, Map<Distance, TrackChunkId>>() // TODO PEB couture

    // parse neutral sections
    fun parseNeutralRanges(
        isAnnouncement: Boolean,
        neutralSection: RJSNeutralSection,
        trackSectionToNeutralMap:
            MutableMap<
                String, DirectionalMap<DistanceRangeMap<fr.sncf.osrd.sim_infra.impl.NeutralSection>>
            >
    ) {
        val trackRanges =
            if (isAnnouncement) neutralSection.announcementTrackRanges
            else neutralSection.trackRanges
        for (trackRange in trackRanges) {
            val track = trackRange.trackSectionID
            val trackRangeMaps =
                trackSectionToNeutralMap.getOrDefault(
                    track,
                    DirectionalMap(distanceRangeMapOf(), distanceRangeMapOf())
                )
            val dir = Direction.fromEdgeDir(trackRange.direction).toKtDirection()
            trackRangeMaps
                .get(dir)
                .put(
                    trackRange.begin.meters,
                    trackRange.end.meters,
                    fr.sncf.osrd.sim_infra.impl.NeutralSection(
                        neutralSection.lowerPantograph,
                        isAnnouncement
                    )
                )
            trackSectionToNeutralMap[track] = trackRangeMaps
        }
    }

    val trackSectionToNeutralMap =
        mutableMapOf<
            String, DirectionalMap<DistanceRangeMap<fr.sncf.osrd.sim_infra.impl.NeutralSection>>
        >()
    for (neutralSection in rjsInfra.neutralSections) {
        parseNeutralRanges(true, neutralSection, trackSectionToNeutralMap)
        parseNeutralRanges(false, neutralSection, trackSectionToNeutralMap)
    }

    // Load track-sections: one chunk (to be split) for each
    for (rjsTrack in rjsInfra.trackSections) {
        //        val track = TrackSectionImpl(
        //            rjsTrack.length,
        //            rjsTrack.id,
        //
        // ImmutableSet.copyOf<OperationalPoint>(operationalPointsPerTrack.get(rjsTrack.id)),
        //            parseLineString(rjsTrack.geo),
        //            parseLineString(rjsTrack.sch),
        //            buildLoadingGaugeLimits(rjsTrack.loadingGaugeLimits)
        //        ).apply {
        //            curves = makeCurves(rjsTrack)
        //            slopes = makeSlopes(rjsTrack)
        //        };

        val trackSectionIdx =
            builder.trackSectionPool.add(
                TrackSectionDescriptor(rjsTrack.id, mutableStaticIdxArrayListOf())
            )
        rjsTrackSectionMap[rjsTrack.id] = trackSectionIdx

        val trackLength = rjsTrack.length.meters

        val slopes = getSlopes(rjsTrack)
        val curves = getCurves(rjsTrack)

        val chunkIdx =
            builder.trackChunkPool.add(
                TrackChunkDescriptor(
                    getGeo(rjsTrack)!!,
                    slopes,
                    curves,
                    DirectionalMap(
                        getGradients(
                            slopes.get(fr.sncf.osrd.utils.Direction.INCREASING),
                            curves.get(fr.sncf.osrd.utils.Direction.INCREASING)
                        ),
                        getGradients(
                            slopes.get(fr.sncf.osrd.utils.Direction.DECREASING),
                            curves.get(fr.sncf.osrd.utils.Direction.DECREASING)
                        )
                    ),
                    Length(trackLength),
                    // Route IDs will be filled later on, routes are not initialized yet
                    DirectionalMap(MutableStaticIdxArrayList(), MutableStaticIdxArrayList()),
                    trackSectionIdx,
                    Offset(0.meters),
                    // OperationalPointPart IDs will be filled later on, operational point parts are
                    // not initialized yet
                    MutableStaticIdxArrayList(),
                    getBlockedGauge(rjsTrack),
                    distanceRangeMapOf(
                        listOf(DistanceRangeMap.RangeMapEntry(0.meters, trackLength, ""))
                    ),
                    getNeutralSections(trackSectionToNeutralMap[rjsTrack.id], trackLength),
                    DirectionalMap(
                        distanceRangeMapOf(),
                        distanceRangeMapOf()
                    ) // TODO speedSections empty for now
                )
            )

        builder.trackSectionPool[trackSectionIdx].chunks.add(chunkIdx)

        val trackSectionChunks = TreeMap<Distance, TrackChunkId>()
        trackSectionChunks[0.meters] = chunkIdx
        trackChunkMap[trackSectionIdx] = trackSectionChunks
    }

    fun getTrackSectionChunks(
        rjsTrackSectionMap: HashBiMap<String, TrackSectionId>,
        trackChunkMap: MutableMap<TrackSectionId, TreeMap<Distance, TrackChunkId>>,
        track: String
    ): TreeMap<Distance, TrackChunkId> {
        val trackSectionId =
            rjsTrackSectionMap[track]
                ?: throw OSRDError.newInfraLoadingError(
                    ErrorType.InfraHardLoadingError,
                    "Impossible"
                ) // TODO PEB
        return trackChunkMap[trackSectionId]
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Impossible"
            ) // TODO PEB
    }

    for (electrification in rjsInfra.electrifications) {
        for (trackRange in electrification.trackRanges) {
            val trackSectionChunks =
                getTrackSectionChunks(rjsTrackSectionMap, trackChunkMap, trackRange.trackSectionID)
            assert(trackSectionChunks.size == 1)
            val chunk = builder.trackChunkPool[trackSectionChunks.firstEntry().value]
            chunk.electrificationVoltage.put(
                trackRange.begin.meters,
                trackRange.end.meters,
                electrification.voltage
            )
        }
    }

    // Load waypoints (detectors, buffer-stops): split track-sections in chunks
    fun parseRjsRouteWaypoint(
        waypoint: RJSRouteWaypoint,
        builder: RawInfraFromRjsBuilderImpl,
        rjsTrackSectionMap: HashBiMap<String, TrackSectionId>,
        trackChunkMap: MutableMap<TrackSectionId, TreeMap<Distance, TrackChunkId>>
    ) {
        val trackSectionChunks =
            getTrackSectionChunks(rjsTrackSectionMap, trackChunkMap, waypoint.track)
        val prevChunkId = trackSectionChunks.floorEntry(waypoint.position.meters)
        val newChunk =
            builder.trackChunkPool[prevChunkId.value].split(Offset(waypoint.position.meters))
        if (newChunk != null) {
            val newChunkIdx = builder.trackChunkPool.add(newChunk)
            trackSectionChunks[waypoint.position.meters] = newChunkIdx
            builder.trackSectionPool[newChunk.track].chunks.add(newChunkIdx)
        }
        detectorMap[waypoint.id] = builder.detectorPool.add(waypoint.id)
    }

    for (detector in rjsInfra.detectors) {
        parseRjsRouteWaypoint(detector, builder, rjsTrackSectionMap, trackChunkMap)
    }
    for (detector in rjsInfra.bufferStops) {
        parseRjsRouteWaypoint(detector, builder, rjsTrackSectionMap, trackChunkMap)
    }

    // parse operational points
    for (op in rjsInfra.operationalPoints) {
        for (part in op.parts) {
            val trackSectionChunks =
                getTrackSectionChunks(rjsTrackSectionMap, trackChunkMap, part.track)
            val chunkId = trackSectionChunks.floorEntry(part.position.meters)
            val oppId =
                builder.operationalPointPartPool.add(
                    OperationalPointPartDescriptor(
                        op.id,
                        Offset(part.position.meters - chunkId.key),
                        chunkId.value
                    )
                )
            val oppList =
                builder.trackChunkPool[chunkId.value].operationalPointParts
                    as MutableStaticIdxArrayList
            oppList.add(oppId)
        }
    }

    // TODO PEB couture
    for (edge in infra.trackGraph.edges()) {
        val track = edge as? TrackSection
        if (track != null) {
            trackSectionMap[track] = rjsTrackSectionMap[track.id]

            val chunkMap = mutableMapOf<Distance, TrackChunkId>()
            for (entry in trackChunkMap[rjsTrackSectionMap[track.id]]!!) {
                chunkMap[entry.key] = entry.value
            }
            oldTrackChunkMap[track] = chunkMap

            for (detector in track.detectors) {
                oldDetectorMap[detector] = detectorMap[detector.id]
            }
        }
    }

    // parse switches
    for (switchEntry in infra.switches) {
        val oldSwitch = switchEntry.value!!
        val nodeGraph = oldSwitch.graph!!
        val infraGraph = infra.trackGraph!!
        trackNodeMap[oldSwitch] =
            builder.movableElement(oldSwitch.id, oldSwitch.groupChangeDelay.seconds) {
                val nodeMap: MutableMap<SwitchPort, TrackNodePortId> = mutableMapOf()
                for (node in nodeGraph.nodes()) {
                    var track: TrackEdge? = null
                    for (edge in infraGraph.incidentEdges(node)) {
                        if (edge is TrackSection) {
                            track = edge
                            break
                        }
                    }
                    track!!
                    val endpoint =
                        if (infraGraph.incidentNodes(track).nodeU() == node) Endpoint.START
                        else Endpoint.END
                    nodeMap[node] = port(EndpointTrackSectionId(trackSectionMap[track]!!, endpoint))
                }
                val switchGroups = mutableMapOf<String, TrackNodeConfigId>()
                for (group in oldSwitch.groups.entries()) {
                    val groupName = group.key!!
                    val nodes = nodeGraph.incidentNodes(group.value!!)
                    val portPair = Pair(nodeMap[nodes.nodeU()]!!, nodeMap[nodes.nodeV()]!!)
                    switchGroups[groupName] = config(groupName, portPair)
                }
                trackNodeGroupsMap[oldSwitch] = switchGroups
            }
    }

    // parse track links
    for (node in infra.trackGraph.nodes()) {
        if (node is Joint) {
            val edges = infra.trackGraph.incidentEdges(node)
            assert(edges.count() == 2)
            builder.movableElement(node.id, ZERO) {
                val ports = ArrayList<TrackNodePortId>()
                for (edge in edges) {
                    val endpoint =
                        if (infra.trackGraph.incidentNodes(edge).nodeU() == node) Endpoint.START
                        else Endpoint.END
                    ports.add(port(EndpointTrackSectionId(trackSectionMap[edge]!!, endpoint)))
                }
                config("default", Pair(ports[0], ports[1]))
            }
        }
    }

    fun getOrCreateDet(oldDiDetector: DiDetector): DirDetectorId {
        val oldDetector = oldDiDetector.detector
        val detector = oldDetectorMap[oldDetector!!]!!
        return when (oldDiDetector.direction!!) {
            Direction.FORWARD -> detector.increasing
            Direction.BACKWARD -> detector.decreasing
        }
    }

    // create zones
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
    assertEqual(rawInfra, controlInfra)
    return controlInfra
}

open class ComparableOperationalPointPart(
    val name: String,
    val track: String,
    val trackOffset: Offset<fr.sncf.osrd.sim_infra.api.TrackSection>,
    val chunkOffset: Offset<TrackChunk>
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ComparableOperationalPointPart) return false
        if (name != other.name) return false
        if (track != other.track) return false
        if (trackOffset != other.trackOffset) return false
        if (chunkOffset != other.chunkOffset) return false
        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + track.hashCode()
        result = 31 * result + trackOffset.hashCode()
        result = 31 * result + chunkOffset.hashCode()
        return result
    }
}

open class ComparableChunk(simInfra: RawInfra, chunkId: TrackChunkId) {
    val geo = simInfra.getTrackChunkGeom(chunkId)
    val slopes =
        DirectionalMap(
            simInfra.getTrackChunkSlope(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.INCREASING)
            ),
            simInfra.getTrackChunkSlope(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.DECREASING)
            )
        )
    val curves =
        DirectionalMap(
            simInfra.getTrackChunkCurve(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.INCREASING)
            ),
            simInfra.getTrackChunkCurve(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.DECREASING)
            )
        )
    val gradients =
        DirectionalMap(
            simInfra.getTrackChunkGradient(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.INCREASING)
            ),
            simInfra.getTrackChunkGradient(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.DECREASING)
            )
        )
    val length = simInfra.getTrackChunkLength(chunkId)
    val routes =
        DirectionalMap(
            simInfra.getRoutesOnTrackChunk(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.INCREASING)
            ),
            simInfra.getRoutesOnTrackChunk(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.DECREASING)
            )
        )
    val track = simInfra.getTrackSectionName(simInfra.getTrackFromChunk(chunkId))
    val offset = simInfra.getTrackChunkOffset(chunkId)

    val operationalPointParts =
        HashSet<ComparableOperationalPointPart>(
            simInfra.getTrackChunkOperationalPointParts(chunkId).map { opp ->
                ComparableOperationalPointPart(
                    simInfra.getOperationalPointPartName(opp),
                    simInfra.getTrackSectionName(
                        simInfra.getTrackFromChunk(simInfra.getOperationalPointPartChunk(opp))
                    ),
                    simInfra.getTrackChunkOffset(simInfra.getOperationalPointPartChunk(opp)),
                    simInfra.getOperationalPointPartChunkOffset(opp)
                )
            }
        )

    init {
        assert(
            simInfra.getTrackChunkOperationalPointParts(chunkId).size == operationalPointParts.size
        )
        for (opp in simInfra.getTrackChunkOperationalPointParts(chunkId)) {
            assert(simInfra.getOperationalPointPartChunk(opp) == chunkId)
        }
    }

    val loadingGaugeConstraints = simInfra.getTrackChunkLoadingGaugeConstraints(chunkId)
    val electrificationVoltage = simInfra.getTrackChunkElectrificationVoltage(chunkId)
    val neutralSections =
        DirectionalMap(
            simInfra.getTrackChunkNeutralSections(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.INCREASING)
            ),
            simInfra.getTrackChunkNeutralSections(
                DirTrackChunkId(chunkId, fr.sncf.osrd.utils.Direction.DECREASING)
            )
        )
    //                    val speedSections = DirectionalMap(
    //                        simInfra.getTrackChunkSpeedSections(DirTrackChunkId(chunkId,
    // fr.sncf.osrd.utils.Direction.INCREASING)),
    //                        simInfra.getTrackChunkSpeedSections(DirTrackChunkId(chunkId,
    // fr.sncf.osrd.utils.Direction.DECREASING))
    //                    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ComparableChunk) return false
        if (geo != other.geo) return false
        if (slopes != other.slopes) return false
        if (curves != other.curves) return false
        if (gradients != other.gradients) return false
        if (length != other.length) return false
        if (routes != other.routes) return false
        if (track != other.track) return false
        if (offset != other.offset) return false
        if (operationalPointParts != other.operationalPointParts) return false
        if (loadingGaugeConstraints != other.loadingGaugeConstraints) return false
        if (electrificationVoltage != other.electrificationVoltage) return false
        if (neutralSections != other.neutralSections) return false
        //        if (speedSections != other.speedSections) return false
        return true
    }

    override fun hashCode(): Int {
        var result = geo.hashCode()
        result = 31 * result + slopes.hashCode()
        result = 31 * result + curves.hashCode()
        result = 31 * result + gradients.hashCode()
        result = 31 * result + length.hashCode()
        result = 31 * result + routes.hashCode()
        result = 31 * result + track.hashCode()
        result = 31 * result + offset.hashCode()
        result = 31 * result + operationalPointParts.hashCode()
        result = 31 * result + loadingGaugeConstraints.hashCode()
        result = 31 * result + electrificationVoltage.hashCode()
        result = 31 * result + neutralSections.hashCode()
        //        result = 31 * result + speedSections.hashCode()
        return result
    }
}

private fun assertEqual(left: SimInfraAdapter, right: SimInfraAdapter) {
    val leftDetectors = mutableSetOf<String>()
    for (d in left.simInfra.detectors) {
        leftDetectors.add(left.simInfra.getDetectorName(d)!!)
    }
    assert(left.simInfra.detectors.size.toInt() == leftDetectors.size)
    val rightDetectors = mutableSetOf<String>()
    for (d in right.simInfra.detectors) {
        rightDetectors.add(left.simInfra.getDetectorName(d)!!)
    }
    assert(right.simInfra.detectors.size.toInt() == rightDetectors.size)
    assert(leftDetectors == rightDetectors)

    assert(left.simInfra.trackSections.size == right.simInfra.trackSections.size)
    val leftTrackChunks =
        mutableMapOf<
            Pair<String, Offset<fr.sncf.osrd.sim_infra.api.TrackSection>>, ComparableChunk
        >()
    for (t in left.simInfra.trackSections) {
        for (c in left.simInfra.getTrackSectionChunks(t)) {
            assert(t == left.simInfra.getTrackFromChunk(c))
            val chunkKey =
                Pair(left.simInfra.getTrackSectionName(t), left.simInfra.getTrackChunkOffset(c))
            assert(!leftTrackChunks.containsKey(chunkKey))
            leftTrackChunks[chunkKey] = ComparableChunk(left.simInfra, c)
        }
    }
    val rightTrackChunks =
        mutableMapOf<
            Pair<String, Offset<fr.sncf.osrd.sim_infra.api.TrackSection>>, ComparableChunk
        >()
    for (t in right.simInfra.trackSections) {
        for (c in right.simInfra.getTrackSectionChunks(t)) {
            assert(t == right.simInfra.getTrackFromChunk(c))
            val chunkKey =
                Pair(right.simInfra.getTrackSectionName(t), right.simInfra.getTrackChunkOffset(c))
            assert(!rightTrackChunks.containsKey(chunkKey))
            rightTrackChunks[chunkKey] = ComparableChunk(right.simInfra, c)
        }
    }
    assert(leftTrackChunks == rightTrackChunks)

    // TODO complete simInfra checks

    assert(left.zoneMap == right.zoneMap)
    assert(left.detectorMap.size == right.detectorMap.size)
    for (l in left.detectorMap) {
        assert(right.detectorMap.containsKey(l.key))
    }
    assert(left.trackNodeMap == right.trackNodeMap)
    assert(left.trackNodeGroupsMap == right.trackNodeGroupsMap)
    assert(left.routeMap == right.routeMap)
    assert(left.signalMap == right.signalMap)
    assert(left.rjsSignalMap == right.rjsSignalMap)
}

private fun makeChunk(
    builder: RawInfraBuilder,
    track: TrackSection,
    startOffset: Distance,
    endOffset: Distance,
    trackSectionBuilder: TrackSectionBuilder,
    chunkMap: MutableMap<Distance, TrackChunkId>
) {
    if (startOffset == endOffset) return
    val rangeViewForward =
        TrackRangeView(
            startOffset.meters,
            endOffset.meters,
            DiTrackEdgeImpl(track, Direction.FORWARD)
        )
    val rangeViewBackward =
        TrackRangeView(
            startOffset.meters,
            endOffset.meters,
            DiTrackEdgeImpl(track, Direction.BACKWARD)
        )

    fun <T> makeDirectionalMap(f: (range: TrackRangeView) -> T): DirectionalMap<T> {
        return DirectionalMap(f.invoke(rangeViewForward), f.invoke(rangeViewBackward))
    }

    fun makeSpeedSections(range: TrackRangeView): DistanceRangeMap<SpeedSection> {
        val res = distanceRangeMapOf<SpeedSection>()
        for (entry in range.speedSections.asMapOfRanges()) {
            val legacySpeedLimit = entry.value
            val map =
                legacySpeedLimit.speedLimitByTag.mapValues { mapEntry ->
                    mapEntry.value!!.metersPerSecond
                }
            res.put(
                entry.key.lowerEndpoint().meters,
                entry.key.upperEndpoint().meters,
                SpeedSection(legacySpeedLimit.defaultSpeedLimit.metersPerSecond, map)
            )
        }
        return res
    }

    fun makeNeutralSection(range: TrackRangeView): DistanceRangeMap<SimNeutralSection> {
        val res = distanceRangeMapOf<SimNeutralSection>()
        for ((rangeMap, isAnnouncement) in
            listOf(
                Pair(range.neutralSections, false),
                Pair(range.neutralSectionAnnouncements, true),
            )) {
            for (entry in rangeMap.asMapOfRanges()) {
                val legacyNeutralSection = entry.value
                res.put(
                    entry.key.lowerEndpoint().meters,
                    entry.key.upperEndpoint().meters,
                    SimNeutralSection(legacyNeutralSection.lowerPantograph, isAnnouncement)
                )
            }
        }
        return res
    }

    val chunkId =
        builder.trackChunk(
            rangeViewForward.geo,
            makeDirectionalMap { range -> DistanceRangeMapImpl.from(range.slopes) },
            Length(endOffset - startOffset),
            Offset(startOffset),
            makeDirectionalMap { range -> DistanceRangeMapImpl.from(range.curves) },
            makeDirectionalMap { range -> DistanceRangeMapImpl.from(range.gradients) },
            DistanceRangeMapImpl.from(rangeViewForward.blockedGaugeTypes),
            DistanceRangeMapImpl.from(rangeViewForward.electrificationVoltages),
            makeDirectionalMap { range -> makeNeutralSection(range) },
            makeDirectionalMap { range -> makeSpeedSections(range) },
        )
    trackSectionBuilder.chunk(chunkId)
    chunkMap[startOffset] = chunkId
}

private fun buildZonePath(
    viewIterator: TrackRangeViewIterator,
    oldStartDet: DiDetector,
    oldEndDet: DiDetector,
    entry: DirDetectorId,
    exit: DirDetectorId,
    trackNodeMap: HashBiMap<Switch, TrackNodeId>,
    trackNodeGroupsMap: MutableMap<Switch, Map<String, TrackNodeConfigId>>,
    trackChunkMap: MutableMap<TrackSection, Map<Distance, TrackChunkId>>,
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
            val trackSection = edge as TrackSection
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
    track: TrackSection,
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
