package fr.sncf.osrd.infra.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.DeepEqualsUtils;
import fr.sncf.osrd.utils.graph.BiNEdge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class Route extends BiNEdge<Route> {
    public final String id;
    /** List of tvdSectionPath forming the route */
    public final List<TVDSectionPath> tvdSectionsPath;
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final List<EdgeDirection> tvdSectionsPathDirection;
    public final TransitType transitType;
    public final HashMap<Switch, SwitchPosition> switchesPosition;
    public ArrayList<Signal> signalSubscribers;

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
        this.id = id;
        this.transitType = transitType;
        this.tvdSectionsPathDirection = tvdSectionsPathDirection;
        this.switchesPosition = switchesPosition;
        graph.registerEdge(this);
        this.tvdSectionsPath = tvdSectionsPath;
    }

    public State newState() {
        return new State(this);
    }

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State implements RSMatchable {
        public final Route route;
        public RouteStatus status;

        State(Route route) {
            this.route = route;
            this.status = RouteStatus.FREE;
        }

        public void onTvdSectionUnoccupied(Simulation sim, TVDSection.State tvdSectionUnoccupied) {
            if (status != RouteStatus.OCCUPIED)
                return;

            if (route.transitType == TransitType.FLEXIBLE) {
                tvdSectionUnoccupied.free(sim);
                return;
            }
            // The train has covered the entire route
            var lastTvdSection = route.tvdSectionsPath.get(route.tvdSectionsPath.size() - 1).tvdSection;
            if (lastTvdSection == tvdSectionUnoccupied.tvdSection) {
                for (var tvdSectionPath : route.tvdSectionsPath) {
                    var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
                    tvdSection.free(sim);
                }
            }
        }

        public void onTvdSectionFreed(Simulation sim) {
            if (status == RouteStatus.FREE)
                return;

            // Check that all tvd sections are free to free the route
            for (var tvdSectionPath : route.tvdSectionsPath) {
                var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
                if (tvdSection.isReserved())
                    return;
            }

            var change = new RouteStatusChange(sim, this, RouteStatus.FREE);
            change.apply(sim, this);
            sim.publishChange(change);
            notifySignals(sim);
        }

        public void onTvdSectionReserved(Simulation sim) {
            if (status != RouteStatus.FREE)
                return;
            var change = new Route.RouteStatusChange(sim, this, RouteStatus.CONFLICT);
            change.apply(sim, this);
            sim.publishChange(change);
            notifySignals(sim);
        }

        public void onTvdSectionOccupied(Simulation sim) {
            if (status != RouteStatus.RESERVED)
                return;
            var change = new RouteStatusChange(sim, this, RouteStatus.OCCUPIED);
            change.apply(sim, this);
            sim.publishChange(change);
            notifySignals(sim);
        }

        private void notifySignals(Simulation sim) {
            for (var signal : route.signalSubscribers) {
                var signalState = sim.infraState.getSignalState(signal.index);
                signalState.notifyChange(sim);
            }
        }

        /** Reserve a route and his tvd sections. Routes that share tvd sections will have the status CONFLICT */
        public void reserve(Simulation sim) {
            assert status == RouteStatus.FREE;
            var change = new RouteStatusChange(sim, this, RouteStatus.RESERVED);
            change.apply(sim, this);
            sim.publishChange(change);
            notifySignals(sim);

            // Reserve the tvd sections
            for (var tvdSectionPath : route.tvdSectionsPath) {
                var tvdSection = sim.infraState.getTvdSectionState(tvdSectionPath.tvdSection.index);
                tvdSection.reserve(sim);
            }

            // Set the switches in the required position
            for (var switchPos : route.switchesPosition.entrySet()) {
                var switchState = sim.infraState.getSwitchState(switchPos.getKey().switchIndex);
                switchState.setPosition(sim, switchPos.getValue());
            }
        }

        @Override
        public int getEnumValue() {
            return status.ordinal();
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(RSValue other) {
            if (other.getClass() != Route.State.class)
                return false;
            var o = (Route.State) other;
            if (route != o.route)
                return false;
            return status == o.status;
        }
    }

    public static class RouteStatusChange extends EntityChange<Route.State, Void>
            implements TimelineEventValue {
        public final RouteStatus newStatus;
        public final int routeIndex;

        /** create a RouteStatusChange */
        public RouteStatusChange(Simulation sim, Route.State entity, RouteStatus newStatus) {
            super(sim);
            this.newStatus = newStatus;
            this.routeIndex = entity.route.index;
        }

        @Override
        public Void apply(Simulation sim, Route.State entity) {
            entity.status = newStatus;
            return null;
        }

        @Override
        public Route.State getEntity(Simulation sim) {
            return sim.infraState.getRouteState(routeIndex);
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEventValue other) {
            if (other.getClass() != RouteStatusChange.class)
                return false;
            var o = (RouteStatusChange) other;
            return o.newStatus == newStatus && o.routeIndex == routeIndex;
        }
    }

    public enum TransitType {
        FLEXIBLE,
        RIGID
    }
}
