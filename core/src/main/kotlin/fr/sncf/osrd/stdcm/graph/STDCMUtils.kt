package fr.sncf.osrd.stdcm.graph

import com.google.common.collect.Iterables
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.infra_state.api.TrainPath
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange
import java.util.*
import kotlin.math.abs
import kotlin.math.min

object STDCMUtils {
    /** Combines all the envelopes in the given edge ranges  */
    fun mergeEnvelopeRanges(
        edges: List<EdgeRange<STDCMEdge?>>
    ): Envelope {
        val parts = ArrayList<EnvelopePart>()
        var offset = 0.0
        for (edge in edges) {
            val envelope = edge.edge!!.envelope
            val sliceUntil = min(envelope.endPos, abs(edge.end - edge.start))
            if (sliceUntil == 0.0) continue
            val slicedEnvelope = Envelope.make(*envelope.slice(0.0, sliceUntil))
            for (part in slicedEnvelope)
                parts.add(part.copyAndShift(offset))
            offset = parts[parts.size - 1].endPos
        }
        val newEnvelope = Envelope.make(*parts.toTypedArray<EnvelopePart>())
        assert(newEnvelope.continuous)
        return newEnvelope
    }

    /** Combines all the envelopes in the given edges  */
    fun mergeEnvelopes(
        edges: List<STDCMEdge>
    ): Envelope {
        return mergeEnvelopeRanges(
            edges.stream()
                .map { e: STDCMEdge -> EdgeRange(e, 0.0, e.route.infraRoute.length) }
                .toList()
        )
    }

    /** Returns the offset of the stops on the given route, starting at startOffset */
    fun getStopOnRoute(graph: STDCMGraph, route: SignalingRoute, startOffset: Double, waypointIndex: Int): Double? {
        var newWaypointIndex = waypointIndex
        val res = ArrayList<Double>()
        while (newWaypointIndex + 1 < graph.steps.size && !graph.steps[newWaypointIndex + 1].stop)
            newWaypointIndex++ // Only the next point where we actually stop matters here
        if (newWaypointIndex + 1 >= graph.steps.size) return null
        val nextStep = graph.steps[newWaypointIndex + 1]
        if (!nextStep.stop) return null
        for (endLocation in nextStep.locations) {
            if (endLocation.edge === route) {
                val offset = endLocation.offset - startOffset
                if (offset >= 0) res.add(offset)
            }
        }
        return if (res.isEmpty()) null else Collections.min(res)
    }

    /** Builds a train path from a route, and offset from its start, and an envelope.  */
    @JvmStatic
    fun makeTrainPath(route: SignalingRoute, startOffset: Double, endOffset: Double): TrainPath {
        var mutEndOffset = endOffset
        val routeLength = route.infraRoute.length
        if (mutEndOffset > routeLength) {
            assert(abs(mutEndOffset - routeLength) < TrainPhysicsIntegrator.POSITION_EPSILON)
            mutEndOffset = routeLength
        }
        assert(startOffset in 0.0..routeLength)
        assert(mutEndOffset in 0.0..routeLength)
        assert(startOffset <= mutEndOffset)
        val infraRoute = route.infraRoute
        val start = TrackRangeView.getLocationFromList(infraRoute.trackRanges, startOffset)
        val end = TrackRangeView.getLocationFromList(infraRoute.trackRanges, mutEndOffset)
        return TrainPathBuilder.from(java.util.List.of(route), start, end)
    }

    /** Create a TrainPath instance from a list of edge ranges  */
    fun makePathFromRanges(ranges: List<EdgeRange<STDCMEdge?>>): TrainPath {
        val firstEdge = ranges[0].edge!!
        val lastRange = ranges[ranges.size - 1]
        val lastEdge = lastRange.edge!!
        val start = TrackRangeView.getLocationFromList(
            firstEdge.route.infraRoute.trackRanges,
            firstEdge.envelopeStartOffset
        )
        val lastRangeLength = lastRange.end - lastRange.start
        val end = TrackRangeView.getLocationFromList(
            lastEdge.route.infraRoute.trackRanges,
            lastEdge.envelopeStartOffset + lastRangeLength
        )
        val routes = ArrayList<SignalingRoute>()
        for (range in ranges)
            if (routes.isEmpty() || Iterables.getLast(routes) != range.edge!!.route)
                routes.add(
                    range.edge!!.route
                )
        return TrainPathBuilder.from(routes, start, end)
    }
}
