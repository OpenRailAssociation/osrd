package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.Endpoint
import fr.sncf.osrd.utils.indexing.*
import kotlin.time.Duration

/** A track section is a real-life section of track, which cannot be interrupted by track nodes. */
sealed interface TrackSection

typealias TrackSectionId = StaticIdx<TrackSection>

/**
 * Track nodes connect track sections together. Each node corresponds to either a railway track node, or
 * an abstract boundary.
 */
sealed interface TrackNode

typealias TrackNodeId = StaticIdx<TrackNode>

/** Track nodes have ports, which can be connected to track section endpoints */
sealed interface TrackNodePort

typealias TrackNodePortId = StaticIdx<TrackNodePort>

/**
 * A possible track node config. Each track node has its own config id space. Abstract boundary nodes
 * (sometimes called track section links) have a single config.
 */
sealed interface TrackNodeConfig

typealias TrackNodeConfigId = StaticIdx<TrackNodeConfig>

@Suppress("INAPPLICABLE_JVM_NAME")
interface TrackNetworkInfra {
    fun getNextTrackSection(
        currentTrack: DirTrackSectionId,
        config: TrackNodeConfigId
    ): OptDirTrackSectionId

    fun getNextTrackNode(trackSection: DirTrackSectionId): OptStaticIdx<TrackNode>

    fun getNextTrackNodePort(trackSection: DirTrackSectionId): OptStaticIdx<TrackNodePort>
    /** Returns the track section which is plugged into a given node port */
    fun getPortConnection(trackNode: TrackNodeId, port: TrackNodePortId): EndpointTrackSectionId

    /**
     * Returns the collection of all possible configurations for the node. Switches always have more
     * than one, and abstract nodes (track section links) always have one.
     */
    fun getTrackNodeConfigs(trackNode: TrackNodeId): StaticIdxSpace<TrackNodeConfig>
    /**
     * Returns the number of ports for this node. Abstract nodes have two ports, and track nodes have
     * at least 3.
     */
    fun getTrackNodePorts(trackNode: TrackNodeId): StaticIdxSpace<TrackNodePort>
    /**
     * Given a node, a configuration, and an entry port, returns either the exit port, or -1 if the
     * entry cannot be used in this configuration.
     */
    fun getTrackNodeExitPort(
        trackNode: TrackNodeId,
        config: TrackNodeConfigId,
        entryPort: TrackNodePortId
    ): OptStaticIdx<TrackNodePort>
    /** Returns the time it takes for the node to change configuration */
    fun getTrackNodeDelay(trackNode: TrackNodeId): Duration

    fun getTrackNodeConfigName(trackNode: TrackNodeId, config: TrackNodeConfigId): String

    fun getTrackNodeName(trackNode: TrackNodeId): String

    val trackNodes: StaticIdxSpace<TrackNode>
    val trackSections: StaticIdxSpace<TrackSection>
}

/** A directional detector encodes a direction over a track section */
typealias DirTrackSectionId = DirStaticIdx<TrackSection>

typealias OptDirTrackSectionId = OptDirStaticIdx<TrackSection>

val TrackSectionId.increasing
    get() = DirTrackSectionId(this, Direction.INCREASING)
val TrackSectionId.decreasing
    get() = DirTrackSectionId(this, Direction.DECREASING)

typealias EndpointTrackSectionId = EndpointStaticIdx<TrackSection>

typealias OptEndpointTrackSectionId = OptEndpointStaticIdx<TrackSection>

val TrackSectionId.start
    get() = EndpointTrackSectionId(this, Endpoint.START)
val TrackSectionId.end
    get() = EndpointTrackSectionId(this, Endpoint.END)

val DirTrackSectionId.toEndpoint
    get() = EndpointTrackSectionId(value, direction.toEndpoint)
