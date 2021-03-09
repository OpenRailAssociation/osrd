package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;
import java.util.Collection;
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

    public static class RouteEntityID implements EntityID<Route.State> {
        private final int routeIndex;

        public RouteEntityID(int routeIndex) {
            this.routeIndex = routeIndex;
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getRouteState(routeIndex);
        }
    }

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State extends AbstractEntity<Route.State> implements RSMatchable {
        public final Route route;
        public RouteStatus status;
        public final Collection<TVDSection.State> tvdSectionStates;

        State(Route route) {
            super(new RouteEntityID(route.index));
            this.route = route;
            this.status = RouteStatus.FREE;
            this.tvdSectionStates = new ArrayList<>();
        }

        @Override
        public void onTimelineEventUpdate(
                Simulation sim, TimelineEvent<?> event, TimelineEvent.State state
        ) throws SimulationError {
            var newStatus = RouteStatus.FREE;
            for (var tvdSectionState : tvdSectionStates) {
                if (tvdSectionState.isReserved()) {
                    newStatus = RouteStatus.OCCUPIED;
                    break;
                }
            }

            if (newStatus != status) {
                status = newStatus;
                // TODO Send notification to subscribers
            }
        }

        /** Initialize his tvdSections and register itself as subscriber of them */
        public void initialize(Infra.State state) {
            var tvdSections = new SortedArraySet<TVDSection>();
            for (var tvdSectionPath : route.tvdSectionsPath)
                tvdSections.union(tvdSectionPath.tvdSections);

            for (var tvdSection : tvdSections) {
                var tvdSectionState = state.getTvdSectionState(tvdSection.index);
                tvdSectionState.subscribers.add(this);
                tvdSectionStates.add(tvdSectionState);
            }
        }

        @Override
        public int getEnumValue() {
            return status.ordinal();
        }
    }
}
