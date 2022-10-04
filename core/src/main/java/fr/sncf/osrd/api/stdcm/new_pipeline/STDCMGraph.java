package fr.sncf.osrd.api.stdcm.new_pipeline;

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
            SignalingRoute route,
            Envelope envelope,
            double timeStart
    ) {

        @Override
        public boolean equals(Object other) {
            if (other == null || other.getClass() != Edge.class)
                return false;
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
            DiDetector detector
    ) {

        @Override
        public boolean equals(Object other) {
            if (other == null || other.getClass() != Node.class)
                return false;
            return detector.equals(((Node) other).detector);
        }

        @Override
        public int hashCode() {
            return detector.hashCode();
        }
    }

    @Override
    public Node getEdgeEnd(Edge edge) {
        return new Node(
                edge.envelope.getTotalTime() + edge.timeStart,
                edge.envelope.getEndSpeed(),
                infra.getSignalingRouteGraph().incidentNodes(edge.route).nodeV()
        );
    }

    @Override
    public Collection<Edge> getAdjacentEdges(Node node) {
        var neighbors = infra.getSignalingRouteGraph().outEdges(node.detector);
        var res = new ArrayList<Edge>();
        for (var neighbor : neighbors) {
            var newEdge = makeEdge(neighbor, node.time, node.speed, 0);
            if (!isUnavailable(newEdge))
                res.add(newEdge);
        }
        return res;
    }

    /** Returns true if the envelope crosses one of the unavailable time blocks.
     * This method only exists in this form in the "simple" implementation where a train can't slow down. */
    public boolean isUnavailable(Edge edge) {
        if (edge.envelope == null)
            return true;
        var unavailableRouteTimes  = unavailableTimes.get(edge.route);
        var routeLength = edge.route.getInfraRoute().getLength();
        var routeStartOffset = routeLength - edge.envelope.getEndPos();
        for (var block : unavailableRouteTimes) {
            var distanceStart = Math.max(0, block.distanceStart() - routeStartOffset);
            var distanceEnd = Math.min(routeLength, block.distanceEnd()) - routeStartOffset;
            var timeEnter = edge.envelope.interpolateTotalTime(distanceStart) + edge.timeStart;
            var timeExit = edge.envelope.interpolateTotalTime(distanceEnd) + edge.timeStart;
            if (timeEnter < block.timeEnd() && timeExit > block.timeStart())
                return true;
        }
        return false;
    }

    /** Creates an edge from a given route and start time/speed */
    public Edge makeEdge(SignalingRoute route, double startTime, double startSpeed, double start) {
        return new Edge(
                route,
                simulateRoute(route, startSpeed, start),
                startTime
        );
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     *
     * </p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path. */
    private Envelope simulateRoute(SignalingRoute route, double initialSpeed, double start) {
        try {
            var length = route.getInfraRoute().getLength();
            var tracks = STDCMPathfinding.truncateTrackRange(route, start, length);
            var envelopePath = EnvelopeTrainPath.from(tracks);
            var context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep);
            var mrsp = MRSP.from(tracks, rollingStock, false, Set.of());
            var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, new double[]{}, mrsp);
            return MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);
        } catch (ImpossibleSimulationError e) {
            return null; // The edge will be considered "unavailable"
        }
    }
}
