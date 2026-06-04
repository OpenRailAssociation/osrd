package fr.sncf.osrd.railjson.builder

import fr.sncf.osrd.parseRJSInfra
import fr.sncf.osrd.railjson.schema.common.ID
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.*
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector
import fr.sncf.osrd.sim_infra.api.RawInfra

interface TrackSectionLocation {
    val track: TrackSectionBuilder
    val offset: Double
}

class TrackSectionOffset(override val track: TrackSectionBuilder, override val offset: Double) :
    TrackSectionLocation

class TrackSectionEndpoint(override val track: TrackSectionBuilder, val endpoint: EdgeEndpoint) :
    TrackSectionLocation {
    override val offset
        get() =
            when (endpoint) {
                EdgeEndpoint.BEGIN -> 0.0
                EdgeEndpoint.END -> track.length
            }

    fun build(): RJSTrackEndpoint {
        return RJSTrackEndpoint(track.name, endpoint)
    }
}

val TrackSectionBuilder.begin
    get() = TrackSectionEndpoint(this, EdgeEndpoint.BEGIN)
val TrackSectionBuilder.end
    get() = TrackSectionEndpoint(this, EdgeEndpoint.END)

private val DEFAULT_LINE_STRING = RJSLineString.make(listOf(0.0, 1.0), listOf(0.0, 1.0))

class TrackSectionBuilder(val name: String, val length: Double) {
    var geo: RJSLineString = DEFAULT_LINE_STRING

    fun at(offset: Double): TrackSectionOffset {
        assert(offset in 0.0..length)
        return TrackSectionOffset(this, offset)
    }

    fun build(): RJSTrackSection {
        val res = RJSTrackSection(name, length, geo)
        return res
    }
}

interface TrackNodeBuilder {
    val name: String

    fun build(defaultSwitchDelay: Double?): RJSSwitch
}

class GenericTrackNodeBuilder(
    override val name: String,
    val type: String,
    val groupChangeDelay: Double? = null,
) : TrackNodeBuilder {
    private val connections = mutableMapOf<String, RJSTrackEndpoint>()

    fun connect(port: String, endpoint: RJSTrackEndpoint) {
        connections[port] = endpoint
    }

    override fun build(defaultSwitchDelay: Double?): RJSSwitch {
        return RJSSwitch(name, type, connections, groupChangeDelay ?: defaultSwitchDelay!!)
    }
}

class TrackLinkBuilder(
    override val name: String,
    private val a: TrackSectionEndpoint,
    private val b: TrackSectionEndpoint,
) : TrackNodeBuilder {
    override fun build(defaultSwitchDelay: Double?): RJSSwitch {
        return RJSSwitch(name, "link", mapOf("A" to a.build(), "B" to b.build()), 0.0)
    }
}

class PointSwitchBuilder(
    override val name: String,
    private val a: TrackSectionEndpoint,
    private val b1: TrackSectionEndpoint,
    private val b2: TrackSectionEndpoint,
    val groupChangeDelay: Double? = null,
) : TrackNodeBuilder {
    override fun build(defaultSwitchDelay: Double?): RJSSwitch {
        val connections = mapOf("A" to a, "B1" to b1, "B2" to b2)
        val delay = groupChangeDelay ?: defaultSwitchDelay!!
        return RJSSwitch(name, "point_switch", connections.mapValues { it.value.build() }, delay)
    }
}

sealed interface WaypointBuilder {
    val name: String
    val location: TrackSectionLocation
    val waypointRef: RJSWaypointRef<RJSRouteWaypoint>

    fun build(): RJSRouteWaypoint
}

class BufferStopBuilder(override val name: String, override val location: TrackSectionLocation) :
    WaypointBuilder {
    override val waypointRef: RJSWaypointRef<RJSRouteWaypoint>
        get() = RJSWaypointRef(ID(name), RJSWaypointRef.RJSWaypointType.BUFFER_STOP)

    override fun build(): RJSBufferStop {
        return RJSBufferStop(name, location.offset, location.track.name)
    }
}

class TrainDetectorBuilder(override val name: String, override val location: TrackSectionLocation) :
    WaypointBuilder {
    override val waypointRef: RJSWaypointRef<RJSRouteWaypoint>
        get() = RJSWaypointRef(ID(name), RJSWaypointRef.RJSWaypointType.DETECTOR)

    override fun build(): RJSTrainDetector {
        return RJSTrainDetector(name, location.offset, location.track.name)
    }
}

class RouteBuilder(
    val name: String,
    val entry: WaypointBuilder,
    val entryDir: EdgeDirection,
    val exit: WaypointBuilder,
    releaseDetectors: List<TrainDetectorBuilder>? = null,
    switchesDirections: Map<TrackNodeBuilder, String>? = null,
) {
    val releaseDetectors = releaseDetectors?.toMutableList() ?: mutableListOf()
    val switchesDirections = switchesDirections?.toMutableMap() ?: mutableMapOf()

    fun addReleaseDetector(detector: TrainDetectorBuilder) {
        releaseDetectors.add(detector)
    }

    fun addSwitchDirection(switch: TrackNodeBuilder, direction: String) {
        switchesDirections[switch] = direction
    }

    fun build(): RJSRoute {
        return RJSRoute(
            name,
            entry.waypointRef,
            entryDir,
            exit.waypointRef,
            releaseDetectors.map { it.name },
            switchesDirections.mapKeys { it.key.name }.mapValues { it.value },
        )
    }
}

data class ConditionalParameter(val onRoute: RouteBuilder, val parameters: Map<String, String>)

class LogicalSignalBuilder(val signalingSystem: String) {
    private val nextSignalingSystems = mutableListOf<String>()
    private val settings = mutableMapOf<String, String>()
    private val defaultParameters = mutableMapOf<String, String>()
    private val conditionalParameters = mutableListOf<ConditionalParameter>()

    fun nextSignalingSystem(signalingSystem: String) {
        nextSignalingSystems.add(signalingSystem)
    }

    fun setting(key: String, value: String) {
        settings[key] = value
    }

    fun defaultParameter(key: String, value: String) {
        defaultParameters[key] = value
    }

    fun conditionalParameter(condParameter: ConditionalParameter) {
        conditionalParameters.add(condParameter)
    }

    fun conditionalParameter(onRoute: RouteBuilder, parameters: Map<String, String>) {
        conditionalParameters.add(ConditionalParameter(onRoute, parameters))
    }

    fun build(): RJSSignal.LogicalSignal {
        return RJSSignal.LogicalSignal(
            signalingSystem,
            settings,
            defaultParameters,
            conditionalParameters.map {
                RJSSignal.LogicalSignal.ConditionalParameter(it.onRoute.name, it.parameters)
            },
            nextSignalingSystems,
        )
    }
}

class PhysicalSignalBuilder(
    val name: String,
    val location: TrackSectionLocation,
    val direction: EdgeDirection,
    val sightDistance: Double? = null,
) {
    val logicalSignals = mutableListOf<LogicalSignalBuilder>()

    fun logicalSignal(signal: LogicalSignalBuilder) {
        logicalSignals.add(signal)
    }

    fun logicalSignal(
        signalingSystem: String,
        init: LogicalSignalBuilder.() -> Unit = {},
    ): LogicalSignalBuilder {
        val builder = LogicalSignalBuilder(signalingSystem)
        builder.init()
        logicalSignals.add(builder)
        return builder
    }

    fun build(defaultSightDistance: Double?): RJSSignal {
        val distance = sightDistance ?: defaultSightDistance!!
        return RJSSignal(
            location.track.name,
            location.offset,
            name,
            direction,
            distance,
            logicalSignals.map { it.build() },
        )
    }
}

class RJSInfraBuilder {
    var defaultSwitchDelay: Double? = null
    var defaultSightDistance: Double? = null

    private val trackSections = mutableListOf<TrackSectionBuilder>()
    private val nodes = mutableListOf<TrackNodeBuilder>()
    private val bufferStops = mutableListOf<BufferStopBuilder>()
    private val detectors = mutableListOf<TrainDetectorBuilder>()
    private val signals = mutableListOf<PhysicalSignalBuilder>()
    private val routes = mutableListOf<RouteBuilder>()

    fun trackSection(name: String, length: Double): TrackSectionBuilder {
        val builder = TrackSectionBuilder(name, length)
        trackSections.add(builder)
        return builder
    }

    fun link(name: String, a: TrackSectionEndpoint, b: TrackSectionEndpoint): TrackLinkBuilder {
        val builder = TrackLinkBuilder(name, a, b)
        nodes.add(builder)
        return builder
    }

    fun pointSwitch(
        name: String,
        a: TrackSectionEndpoint,
        b1: TrackSectionEndpoint,
        b2: TrackSectionEndpoint,
        groupChangeDelay: Double? = null,
    ): PointSwitchBuilder {
        val builder = PointSwitchBuilder(name, a, b1, b2, groupChangeDelay)
        nodes.add(builder)
        return builder
    }

    fun genericNode(
        name: String,
        type: String,
        groupChangeDelay: Double? = null,
        init: GenericTrackNodeBuilder.() -> Unit,
    ): GenericTrackNodeBuilder {
        val builder = GenericTrackNodeBuilder(name, type, groupChangeDelay)
        builder.init()
        nodes.add(builder)
        return builder
    }

    fun bufferStop(name: String, location: TrackSectionLocation): BufferStopBuilder {
        val builder = BufferStopBuilder(name, location)
        bufferStops.add(builder)
        return builder
    }

    fun detector(name: String, location: TrackSectionLocation): TrainDetectorBuilder {
        val builder = TrainDetectorBuilder(name, location)
        detectors.add(builder)
        return builder
    }

    /**
     * Only call this function if you intend to add copies of the same logical signal to multiple
     * physical signals
     */
    fun logicalSignal(
        signalingSystem: String,
        init: LogicalSignalBuilder.() -> Unit = {},
    ): LogicalSignalBuilder {
        val builder = LogicalSignalBuilder(signalingSystem)
        builder.init()
        return builder
    }

    fun physicalSignal(
        name: String,
        location: TrackSectionLocation,
        direction: EdgeDirection,
        sightDistance: Double? = null,
        init: PhysicalSignalBuilder.() -> Unit = {},
    ): PhysicalSignalBuilder {
        val builder = PhysicalSignalBuilder(name, location, direction, sightDistance)
        builder.init()
        signals.add(builder)
        return builder
    }

    fun route(
        name: String,
        entry: WaypointBuilder,
        entryDir: EdgeDirection,
        exit: WaypointBuilder,
        releaseDetectors: List<TrainDetectorBuilder>? = null,
        switchesDirections: Map<TrackNodeBuilder, String>? = null,
        init: RouteBuilder.() -> Unit = {},
    ): RouteBuilder {
        val builder =
            RouteBuilder(name, entry, entryDir, exit, releaseDetectors, switchesDirections)
        routes.add(builder)
        builder.init()
        return builder
    }

    fun build(): RJSInfra {
        val rjsInfra =
            RJSInfra(
                version = RJSInfra.CURRENT_VERSION,
                speedSections = listOf(),
                electrifications = listOf(),
                neutralSections = listOf(),
                operationalPoints = listOf(),
                trackSections = trackSections.map { it.build() },
                switches = nodes.map { it.build(defaultSwitchDelay) },
                switchTypes = listOf(),
                bufferStops = bufferStops.map { it.build() },
                detectors = detectors.map { it.build() },
                signals = signals.map { it.build(defaultSightDistance) },
                routes = routes.map { it.build() },
                levelCrossings = listOf(),
            )
        return rjsInfra
    }
}

fun rjsInfra(init: RJSInfraBuilder.() -> Unit): RJSInfra {
    val builder = RJSInfraBuilder()
    builder.init()
    return builder.build()
}

fun buildParseRJSInfra(init: RJSInfraBuilder.() -> Unit): RawInfra {
    val builder = RJSInfraBuilder()
    builder.init()
    val rjsInfra = builder.build()
    return parseRJSInfra(rjsInfra)
}
