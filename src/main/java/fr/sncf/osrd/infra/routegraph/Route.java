package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.List;

public class Route extends BiNEdge<Route> {
    public final String id;
    /** List of tvdSectionPath forming the route */
    public final List<TVDSectionPath> tvdSectionsPath;
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final List<EdgeDirection> tvdSectionsPathDirection;

    protected Route(
            String id,
            RouteGraph graph,
            double length,
            List<TVDSectionPath> tvdSectionsPath,
            List<EdgeDirection> tvdSectionsPathDirection
    ) {
        super(
                graph.nextEdgeIndex(),
                tvdSectionsPath.get(0).startNode,
                tvdSectionsPath.get(tvdSectionsPath.size() - 1).startNode,
                length
        );
        this.tvdSectionsPathDirection = tvdSectionsPathDirection;
        graph.registerEdge(this);
        this.id = id;
        this.tvdSectionsPath = tvdSectionsPath;
    }

    public State newState() {
        return new State(this);
    }

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State extends Entity implements RSValue {
        public final Route route;
        public RouteStatus status;

        State(Route route) {
            super(EntityType.ROUTE, route.id);
            this.route = route;
            this.status = RouteStatus.FREE;
        }

        @Override
        protected void onTimelineEventUpdate(
                Simulation sim, TimelineEvent<?> event, TimelineEvent.State state
        ) throws SimulationError {
        }
    }
}
