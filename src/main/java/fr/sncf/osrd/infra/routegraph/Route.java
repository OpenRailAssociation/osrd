package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.*;

public class Route extends BiNEdge<Route> {
    public final String id;
    /** List of tvdSectionPath forming the route */
    public final List<TVDSectionPath> tvdSectionsPath;
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final List<EdgeDirection> tvdSectionsPathDirection;
    public final TransitType transitType;
    public final HashMap<Switch, SwitchPosition> switchesPosition;

    protected Route(
            String id,
            RouteGraph graph,
            double length,
            TransitType transitType,
            List<TVDSectionPath> tvdSectionsPath,
            List<EdgeDirection> tvdSectionsPathDirection,
            HashMap<Switch, SwitchPosition> switchesPosition
    ) {
        super(
                graph.nextEdgeIndex(),
                tvdSectionsPath.get(0).startNode,
                tvdSectionsPath.get(tvdSectionsPath.size() - 1).startNode,
                length
        );
        this.transitType = transitType;
        this.tvdSectionsPathDirection = tvdSectionsPathDirection;
        this.switchesPosition = switchesPosition;
        graph.registerEdge(this);
        this.id = id;
        this.tvdSectionsPath = tvdSectionsPath;
    }

    public State newState() {
        return new State(this);
    }

    public static final class RouteID implements EntityID<Route.State> {
        private final int routeIndex;

        public RouteID(int routeIndex) {
            this.routeIndex = routeIndex;
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null || obj.getClass() != RouteID.class)
                return false;
            return routeIndex == ((RouteID) obj).routeIndex;
        }

        @Override
        public int hashCode() {
            return Objects.hash(routeIndex);
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getRouteState(routeIndex);
        }
    }

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State extends AbstractEntity<Route.State, RouteID> implements RSMatchable {
        public final Route route;
        public RouteStatus status;
        public final Collection<TVDSection.State> tvdSectionStates;
        private int nbReservedTvdSection;

        State(Route route) {
            super(new RouteID(route.index));
            this.route = route;
            this.status = RouteStatus.FREE;
            this.tvdSectionStates = new ArrayList<>();
        }

        @Override
        public void onEventOccurred(Simulation sim, TimelineEvent<?> event) {
            switch (status) {
                case FREE:
                    if (event.value.getClass() == TVDSection.TVDSectionReservedChange.class) {
                        var change = new Route.RouteConflictChange(sim, this);
                        change.apply(sim, this);
                        sim.scheduleEvent(this, sim.getTime(), change);
                    }
                    break;
                case RESERVED:
                    if (event.value.getClass() == TVDSection.TVDSectionOccupied.class) {
                        var change = new RouteOccupyChange(sim, this);
                        change.apply(sim, this);
                        sim.scheduleEvent(this, sim.getTime(), change);
                        nbReservedTvdSection = tvdSectionStates.size();
                    }
                    break;
                case OCCUPIED:
                    if (event.value.getClass() == TVDSection.TVDSectionNotOccupied.class) {
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
                var change = new RouteFreeChange(sim, this);
                change.apply(sim, this);
                sim.scheduleEvent(this, sim.getTime(), change);
            }
        }

        @Override
        public void onEventCancelled(Simulation sim, TimelineEvent<?> event) { }

        /** Reserve a route and his tvd sections. Routes that share tvd sections will have the status CONFLICT */
        public void reserve(Simulation sim) {
            assert status == RouteStatus.FREE;
            var change = new RouteReserveChange(sim, this);
            change.apply(sim, this);
            sim.scheduleEvent(this, sim.getTime(), change);
            for (var tvdSection : tvdSectionStates)
                tvdSection.reserve(sim);
            for (var switchPos : route.switchesPosition.entrySet()) {
                var switchState = sim.infraState.getSwitchState(switchPos.getKey().switchIndex);
                switchState.setPosition(sim, switchPos.getValue());
            }
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

    public static class RouteFreeChange extends EntityChange<Route.State, RouteID, Void> {
        public RouteFreeChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public Void apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.FREE;
            return null;
        }
    }

    public static class RouteOccupyChange extends EntityChange<Route.State, RouteID, Void> {
        public RouteOccupyChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public Void apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.OCCUPIED;
            return null;
        }
    }

    public static class RouteReserveChange extends EntityChange<Route.State, RouteID, Void> {
        public RouteReserveChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public Void apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.RESERVED;
            return null;
        }
    }

    public static class RouteConflictChange extends EntityChange<Route.State, RouteID, Void> {
        public RouteConflictChange(Simulation sim, Route.State entity) {
            super(sim, entity.id);
        }

        @Override
        public Void apply(Simulation sim, Route.State entity) {
            entity.status = RouteStatus.CONFLICT;
            return null;
        }
    }

    public enum TransitType {
        FLEXIBLE,
        RIGID
    }
}
