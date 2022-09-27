package fr.sncf.osrd.api.stdcm.new_pipeline;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Graph;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

public class STDCMGraph implements Graph<STDCMGraph.Node, STDCMGraph.Edge> {

    public final SignalingInfra infra;
    public final RollingStock rollingStock;
    private final Multimap<SignalingRoute, OccupancyBlock> unavailableTimes;

    /** Constructor */
    public STDCMGraph(
            SignalingInfra infra,
            RollingStock rollingStock,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes
    ) {
        this.infra = infra;
        this.rollingStock = rollingStock;
        this.unavailableTimes = unavailableTimes;
    }

    public record Edge(
            SignalingRoute route,
            Envelope envelope,
            double timeStart
    ) {

        public boolean equals(Edge other) {
            return route.equals(other.route);
        }
    }

    public record Node(
            double time,
            double speed,
            DiDetector detector
    ) {

        public boolean equals(Node other) {
            return detector.equals(other.detector);
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
        var res = new HashSet<Edge>();
        for (var neighbor : neighbors) {
            var newEdge = makeEdge(neighbor, node.speed, node.time);
            if (!isUnavailable(newEdge))
                res.add(newEdge);
        }
        return res;
    }

    /** Returns true if the envelope crosses one of the unavailable time blocks.
     * This method only exists in this form in the "simple" implementation where a train can't slow down. */
    private boolean isUnavailable(Edge edge) {
        var unavailableRouteTimes  = unavailableTimes.get(edge.route);
        for (var block : unavailableRouteTimes) {
            var timeEnter = edge.envelope.interpolateTotalTime(block.distanceStart()) + edge.timeStart;
            var timeExit = edge.envelope.interpolateTotalTime(block.distanceEnd()) + edge.timeStart;
            if (timeEnter < block.timeEnd() && timeExit > block.timeStart())
                return true;
        }
        return false;
    }

    /** Creates an edge from a given route and start time/speed */
    public Edge makeEdge(SignalingRoute route, double startTime, double startSpeed) {
        return new Edge(
                route,
                simulateRoute(route, startSpeed),
                startTime
        );
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     *
     * </p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path. */
    private Envelope simulateRoute(SignalingRoute route, double initialSpeed) {
        var tracks = route.getInfraRoute().getTrackRanges();
        var envelopePath = EnvelopeTrainPath.from(tracks);
        var context  = new EnvelopeSimContext(rollingStock, envelopePath, 2.);
        var mrsp = MRSP.from(tracks, rollingStock, false, Set.of());
        return MaxEffortEnvelope.from(context, initialSpeed, mrsp);
    }
}
