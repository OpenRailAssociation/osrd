package fr.sncf.osrd.stdcm

import com.google.common.collect.*
import com.google.common.graph.ImmutableNetwork
import com.google.common.graph.NetworkBuilder
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.reservation.ReservationInfra.RouteEntry
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.infra.api.signaling.SignalState
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackNode
import fr.sncf.osrd.infra.api.tracks.undirected.*
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3Signal
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackEdgeImpl
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.infra.implementation.tracks.undirected.DetectorImpl
import fr.sncf.osrd.infra.implementation.tracks.undirected.TrackSectionImpl
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal

/** Builder class to create dummy infra with minimal effort.
 * The generated infras are missing most of the implementation, but they can be used for STDCM computations  */
class DummyRouteGraphBuilder {
    private val builder = ImmutableMap.Builder<String, DummyRoute>()
    private val signals: MutableMap<String, Signal<out SignalState?>> = HashMap()
    private val detectors: MutableMap<String, DiDetector> = HashMap()
    private val graphBuilder = NetworkBuilder
        .directed()
        .immutable<DiDetector?, SignalingRoute>()

    /** Builds the infra  */
    fun build(): SignalingInfra {
        return DummySignalingInfra(builder.build(), graphBuilder.build())
    }
    /** Creates a route going from nodes `entry` to `exit` of length `length`, named $entry->$exit,
     * with the given maximum speed  */
    @JvmOverloads
    fun addRoute(
        entry: String,
        exit: String,
        length: Double = 100.0,
        maxSpeed: Double = Double.POSITIVE_INFINITY
    ): SignalingRoute {
        if (!signals.containsKey(entry))
            signals[entry] = BAL3Signal(entry, 400.0)
        if (!signals.containsKey(exit))
            signals[exit] = BAL3Signal(exit, 400.0)
        if (!detectors.containsKey(entry)) {
            detectors[entry] = DiDetector(
                DetectorImpl(null, 0.0, false, entry), Direction.FORWARD
            )
            graphBuilder.addNode(detectors[entry]!!)
        }
        if (!detectors.containsKey(exit)) {
            detectors[exit] = DiDetector(
                DetectorImpl(null, 0.0, false, exit), Direction.FORWARD
            )
            graphBuilder.addNode(detectors[exit]!!)
        }
        val routeID = String.format("%s->%s", entry, exit)
        val newRoute = DummyRoute(
            routeID,
            length,
            signals[entry]!!,
            signals[exit]!!,
            ImmutableList.of(detectors[entry]!!, detectors[exit]!!)
        )

        // Set speed limit
        for (track in newRoute.trackRanges) {
            val speedSections = track.track.edge.speedSections
            speedSections[Direction.FORWARD] = ImmutableRangeMap.of(
                Range.closed(0.0, track.track.edge.length),
                SpeedLimits(maxSpeed, ImmutableMap.of())
            )
        }
        builder.put(routeID, newRoute)
        graphBuilder.addEdge(detectors[entry], detectors[exit], newRoute)
        return newRoute
    }

    /** Dummy route: every abstract method is implemented but only the ones needed for stdcm give actual results  */
    class DummyRoute internal constructor(
        private val id: String,
        private val length: Double,
        private val entrySignal: Signal<out SignalState?>,
        private val exitSignal: Signal<out SignalState?>,
        private val detectors: ImmutableList<DiDetector>
    ) : SignalingRoute, ReservationRoute {
        private val trackRanges: ImmutableList<TrackRangeView>

        init {
            val track = TrackSectionImpl(length, "track_id_$id")
            trackRanges = ImmutableList.of(
                TrackRangeView(
                    0.0, length,
                    DiTrackEdgeImpl(track, Direction.FORWARD)
                )
            )
        }

        override fun toString(): String {
            return id
        }

        override fun getID(): String {
            return id
        }

        override fun getDetectorPath(): ImmutableList<DiDetector> {
            return detectors
        }

        override fun getReleasePoints(): ImmutableList<Detector>? {
            return null
        }

        override fun getConflictingRoutes(): ImmutableSet<ReservationRoute>? {
            return null
        }

        override fun getTrackRanges(): ImmutableList<TrackRangeView> {
            return trackRanges
        }

        override fun getTrackRanges(beginOffset: Double, endOffset: Double): ImmutableList<TrackRangeView> {
            return ImmutableList.of(
                trackRanges[0]
                    .truncateBeginByLength(beginOffset)
                    .truncateEndByLength(length - endOffset)
            )
        }

        override fun getLength(): Double {
            return length
        }

        override fun isControlled(): Boolean {
            return false
        }

        override fun getInfraRoute(): ReservationRoute {
            return this
        }

        override fun getEntrySignal(): Signal<out SignalState?> {
            return entrySignal
        }

        override fun getExitSignal(): Signal<out SignalState?> {
            return exitSignal
        }

        override fun getSignalingType(): String? {
            return null
        }
    }

    /** Dummy infra: every abstract method is implemented but only the ones needed for stdcm give actual results  */
    class DummySignalingInfra(
        private val routes: ImmutableMap<String, DummyRoute>,
        private val routeGraph: ImmutableNetwork<DiDetector, SignalingRoute>
    ) : SignalingInfra {
        override fun getTrackGraph(): ImmutableNetwork<TrackNode, TrackEdge>? {
            return null
        }

        override fun getSwitches(): ImmutableMap<String, Switch>? {
            return null
        }

        override fun getTrackSection(id: String): TrackSection? {
            return null
        }

        override fun getDetectorMap(): ImmutableMap<String, Detector>? {
            return null
        }

        override fun getSectionMap(): ImmutableMap<DiDetector, DetectionSection>? {
            return null
        }

        override fun getDetectionSections(): ImmutableList<DetectionSection>? {
            return null
        }

        override fun getInfraRouteGraph(): ImmutableNetwork<DiDetector, ReservationRoute>? {
            return null
        }

        override fun getReservationRouteMap(): ImmutableMap<String, ReservationRoute> {
            val res = ImmutableMap.builder<String, ReservationRoute>()
            for ((key, value) in routes) res.put(key, value)
            return res.build()
        }

        override fun getRoutesOnEdges(): ImmutableMultimap<DiTrackEdge, RouteEntry>? {
            return null
        }

        override fun getSignalMap(): ImmutableMultimap<RJSSignal, Signal<out SignalState?>>? {
            return null
        }

        override fun getRouteMap(): ImmutableMultimap<ReservationRoute, SignalingRoute>? {
            return null
        }

        override fun getSignalingRouteGraph(): ImmutableNetwork<DiDetector, SignalingRoute> {
            return routeGraph
        }

        override fun findSignalingRoute(id: String, signalingType: String): SignalingRoute {
            return routes[id]!!
        }

        override fun getDiTrackGraph(): ImmutableNetwork<DiTrackNode, DiTrackEdge>? {
            return null
        }

        override fun getEdge(id: String, direction: Direction): DiTrackEdge? {
            return null
        }

        override fun getEdge(edge: TrackEdge, direction: Direction): DiTrackEdge? {
            return null
        }
    }
}
