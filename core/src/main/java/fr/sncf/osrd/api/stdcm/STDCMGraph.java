package fr.sncf.osrd.api.stdcm;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Graph;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;

/** This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding implementation.
 *
 * </p>
 * The implementation is incomplete for now, as we do not consider that the same location at different time
 * can lead to different results. We only visit each route once.
 * */
public class STDCMGraph implements Graph<STDCMGraph.Node, STDCMGraph.Edge> {

    public final SignalingInfra infra;
    public final RollingStock rollingStock;
    public final double timeStep;
    private final Multimap<SignalingRoute, OccupancyBlock> unavailableTimes;

    /** Constructor */
    public STDCMGraph(
            SignalingInfra infra,
            RollingStock rollingStock,
            double timeStep,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes
    ) {
        this.infra = infra;
        this.rollingStock = rollingStock;
        this.timeStep = timeStep;
        this.unavailableTimes = unavailableTimes;
    }

    public record Edge(
            // Route considered for this edge
            SignalingRoute route,
            // Envelope of the train going through the route (starts at t=0)
            Envelope envelope,
            // Time at which the train enters the route
            double timeStart,
            // Maximum delay we can add after this route by delaying the start time without causing conflicts
            double maximumAddedDelayAfter,
            // Delay we needed to add in this route to avoid conflicts (by shifting the departure time)
            double addedDelay
    ) {

        @Override
        public boolean equals(Object other) {
            if (other == null || other.getClass() != Edge.class)
                return false;
            // TODO: we should consider that the same route at different times is a new edge.
            // Doing this naively results in the algorithm visiting the same edges *many* times.
            return route.getInfraRoute().getID().equals(((Edge) other).route.getInfraRoute().getID());
        }

        @Override
        public int hashCode() {
            return route.getInfraRoute().getID().hashCode();
        }
    }

    public record Node(
            double time,
            double speed,
            DiDetector detector,
            double maximumAddedDelay // Maximum delay we can add by delaying the start time without causing conflicts
    ) {}

    @Override
    public Node getEdgeEnd(Edge edge) {
        return new Node(
                edge.envelope.getTotalTime() + edge.timeStart,
                edge.envelope.getEndSpeed(),
                infra.getSignalingRouteGraph().incidentNodes(edge.route).nodeV(),
                edge.maximumAddedDelayAfter
        );
    }

    @Override
    public Collection<Edge> getAdjacentEdges(Node node) {
        var neighbors = infra.getSignalingRouteGraph().outEdges(node.detector);
        var res = new ArrayList<Edge>();
        for (var neighbor : neighbors) {
            var newEdge = makeEdge(neighbor, node.time, node.speed, 0, node.maximumAddedDelay);
            if (!isUnavailable(newEdge))
                res.add(newEdge);
        }
        return res;
    }

    /** Returns true if the envelope crosses one of the unavailable time blocks.
     * This method only exists in this form in the "simple" implementation where a train can't slow down. */
    public boolean isUnavailable(Edge edge) {
        return edge.envelope == null;
    }

    /** Creates an edge from a given route and start time/speed */
    public Edge makeEdge(
            SignalingRoute route,
            double startTime,
            double startSpeed,
            double start,
            double prevMaximumAddedDelay
    ) {
        var envelope = simulateRoute(route, startSpeed, start, rollingStock, timeStep);
        var delayNeeded = findMinimumAddedDelay(route, startTime, envelope);
        var maximumDelay = Math.min(
                prevMaximumAddedDelay,
                findMaximumAddedDelay(route, startTime + delayNeeded, envelope)
        );
        var delay = 0.;
        if (delayNeeded > 0) {
            if (maximumDelay >= delayNeeded) {
                delay = delayNeeded;
                maximumDelay -= delay;
            } else
                envelope = null;
        }
        return new Edge(
                route,
                envelope,
                startTime + delay,
                maximumDelay,
                delay
        );
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     *
     * </p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path.
     * </p>
     * This is public for the purpose of unit tests */
    public static Envelope simulateRoute(
            SignalingRoute route,
            double initialSpeed,
            double start,
            RollingStock rollingStock,
            double timeStep
    ) {
        try {
            var length = route.getInfraRoute().getLength();
            var tracks = route.getInfraRoute().getTrackRanges(start, length);
            var envelopePath = EnvelopeTrainPath.from(tracks);
            var context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep);
            var mrsp = MRSP.from(tracks, rollingStock, false, Set.of());
            var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, new double[]{}, mrsp);
            return MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);
        } catch (ImpossibleSimulationError e) {
            // This can happen when the train can't go through this part,
            // for example because of high slopes with a "weak" rolling stock
            return null; // The edge will be considered "unavailable"
        }
    }

    /** Returns by how much we can shift this envelope (in time) before causing a conflict.
     * </p>
     * e.g. if the train takes 42s to go through the route, enters the route at t=10s,
     * and we need to leave the route at t=60s, this will return 8s. */
    private double findMaximumAddedDelay(SignalingRoute route, double startTime, Envelope envelope) {
        var minValue = Double.POSITIVE_INFINITY;
        for (var occupancy : unavailableTimes.get(route)) {
            // This loop has a poor complexity, we need to optimize it by the time we handle full timetables
            var exitTime = startTime + envelope.interpolateTotalTime(occupancy.distanceEnd());
            var margin = occupancy.timeStart() - exitTime;
            if (margin < 0) {
                // This occupancy block was before the train passage, we can ignore it
                continue;
            }
            minValue = Math.min(minValue, margin);
        }
        return minValue;
    }

    /** Returns by how much delay we need to add to avoid causing a conflict.
     * </p>
     * e.g. if the whole route is occupied from t=0s to t=60s, and we enter the route at t=42s,
     * this will return 18s. */
    private double findMinimumAddedDelay(SignalingRoute route, double startTime, Envelope envelope) {
        double maxValue = 0;
        for (var occupancy : unavailableTimes.get(route)) {
            // This loop has a poor complexity, we need to optimize it by the time we handle full timetables
            var enterTime = startTime + envelope.interpolateTotalTime(occupancy.distanceStart());
            var exitTime = startTime + envelope.interpolateTotalTime(occupancy.distanceEnd());
            if (enterTime > occupancy.timeEnd() || exitTime < occupancy.timeStart())
                continue;
            var diff = occupancy.timeEnd() - enterTime;
            maxValue = Math.max(maxValue, diff);
        }
        if (maxValue == 0 || Double.isInfinite(maxValue))
            return maxValue;

        // We need a recursive call to see if we can fit a curve in the new position,
        // or if we need to shift it further because of a different occupancy block
        return maxValue + findMinimumAddedDelay(route, startTime + maxValue, envelope);
    }
}
