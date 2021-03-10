package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.*;
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
    public final TransitType transitType;

    protected Route(
            String id,
            RouteGraph graph,
            double length,
            TransitType transitType, List<TVDSectionPath> tvdSectionsPath,
            List<EdgeDirection> tvdSectionsPathDirection
    ) {
        super(
                graph.nextEdgeIndex(),
                tvdSectionsPath.get(0).startNode,
                tvdSectionsPath.get(tvdSectionsPath.size() - 1).startNode,
                length
        );
        this.transitType = transitType;
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
        private int nbReservedTvdSection;

        State(Route route) {
            super(new RouteEntityID(route.index));
            this.route = route;
            this.status = RouteStatus.FREE;
            this.tvdSectionStates = new ArrayList<>();
        }

        @Override
        public void onTimelineEventUpdate(
                Simulation sim,
                TimelineEvent<?> event,
                TimelineEvent.State state
        ) throws SimulationError {
            switch (status) {
                case FREE:
                    if (event.value.getClass() == TVDSection.TVDSectionReservedChange.class)
                        sim.createEvent(this, sim.getTime(), new Route.RouteConflictChange(sim, this));
                    break;
                case RESERVED:
                    if (event.value.getClass() == TVDSection.TVDSectionOccupiedChange.class) {
                        sim.createEvent(this, sim.getTime(), new RouteOccupyChange(sim, this));
                        nbReservedTvdSection = tvdSectionStates.size();
                    }
                    break;
                case OCCUPIED:
                    if (event.value.getClass() == TVDSection.TVDSectionNotOccupiedChange.class) {
                        if (route.transitType == TransitType.FLEXIBLE) {
                            var tvdSection = (TVDSection.State) event.source;
                            tvdSection.free(sim);
                        } else {
                            nbReservedTvdSection--;
                            // The train has covered the entire route
                            if (nbReservedTvdSection == 0) {
                                for (var tvdSection : tvdSectionStates)
                                    tvdSection.free(sim);
                            }
                        }
                    }
                    break;
            }
            if (event.value.getClass() == TVDSection.TVDSectionFreedChange.class) {
                for (var tvdSectionState : tvdSectionStates) {
                    if (tvdSectionState.isReserved())
                        return;
                }
                sim.createEvent(this, sim.getTime(), new RouteFreeChange(sim, this));
            }
        }

        /** Reserve a route and his tvd sections. Routes that share tvd sections will have the status CONFLICT */
        public void reserve(Simulation sim) throws SimulationError {
            assert status == RouteStatus.FREE;
            sim.createEvent(this, sim.getTime(), new RouteReserveChange(sim, this));
            for (var tvdSection : tvdSectionStates)
                tvdSection.reserve(sim);
        }

        /** Initialize his tvdSections and register itself as subscriber of them */
        public void initialize(Infra.State state) {
            for (var tvdSectionPath : route.tvdSectionsPath) {
                var tvdSectionState = state.getTvdSectionState(tvdSectionPath.tvdSection.index);
                tvdSectionState.subscribers.add(this);
                tvdSectionStates.add(tvdSectionState);
            }
        }

        @Override
        public int getEnumValue() {
            return status.ordinal();
        }
    }

    public static class RouteFreeChange extends EntityChange<Route.State, RouteFreeChange> {
        public RouteFreeChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public RouteFreeChange apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.FREE;
            return this;
        }
    }

    public static class RouteOccupyChange extends EntityChange<Route.State, RouteOccupyChange> {
        public RouteOccupyChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public RouteOccupyChange apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.OCCUPIED;
            return this;
        }
    }

    public static class RouteReserveChange extends EntityChange<Route.State, RouteReserveChange> {
        public RouteReserveChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public RouteReserveChange apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.RESERVED;
            return this;
        }
    }

    public static class RouteConflictChange extends EntityChange<Route.State, RouteConflictChange> {
        public RouteConflictChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public RouteConflictChange apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.CONFLICT;
            return this;
        }
    }

    public enum TransitType {
        FLEXIBLE,
        RIGID
    }
}
