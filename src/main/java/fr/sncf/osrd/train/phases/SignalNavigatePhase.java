package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainInteractionType;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Consumer;

public final class SignalNavigatePhase implements Phase {
    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    public final List<Route> routePath;
    public final TrackSectionLocation endLocation;
    private final ArrayList<TrackSectionRange> trackSectionPath;
    private final ArrayList<PointValue<ActionPoint>> actionPointPath;

    private SignalNavigatePhase(
            List<Route> routePath,
            TrackSectionLocation endLocation,
            ArrayList<TrackSectionRange> trackSectionPath,
            ArrayList<PointValue<ActionPoint>> actionPointPath
    ) {
        this.routePath = routePath;
        this.endLocation = endLocation;
        this.trackSectionPath = trackSectionPath;
        this.actionPointPath = actionPointPath;
    }



    /** Create a new navigation phase from an already determined path */
    public static SignalNavigatePhase from(
            List<Route> routes,
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation
    ) {
        var trackSectionPath = routesToTrackSectionRange(routes, startLocation, endLocation);
        var actionPointPath = trackSectionToActionPointPath(driverSightDistance, trackSectionPath);
        return new SignalNavigatePhase(routes, endLocation, trackSectionPath, actionPointPath);
    }

    /** Build track section path. Need to concatenate all track section of all TvdSectionPath.
     * Avoid to have in the path TrackSectionPositions that reference the same TrackSection. */
    private static ArrayList<TrackSectionRange> routesToTrackSectionRange(
            List<Route> routePath,
            TrackSectionLocation beginLocation,
            TrackSectionLocation endLocation
    ) {
        // Flatten the list of track section range
        var flattenSections = new ArrayDeque<TrackSectionRange>();
        for (var route : routePath) {
            for (var i = 0; i < route.tvdSectionsPath.size(); i++) {
                var tvdSectionPath = route.tvdSectionsPath.get(i);
                var tvdSectionPathDir = route.tvdSectionsPathDirection.get(i);
                for (var trackIndex = 0; trackIndex < tvdSectionPath.trackSections.size(); trackIndex++) {
                    // Reverse iteration if the tvd section path is reversed
                    if (tvdSectionPathDir == EdgeDirection.STOP_TO_START) {
                        trackIndex = tvdSectionPath.trackSections.size() - 1 - trackIndex;
                        var trackSection = tvdSectionPath.trackSections.get(trackIndex);
                        flattenSections.addLast(TrackSectionRange.opposite(trackSection));
                        continue;
                    }
                    flattenSections.addLast(tvdSectionPath.trackSections.get(trackIndex));
                }
            }
        }

        // Drop first track sections until the begin location
        while (true) {
            if (flattenSections.isEmpty())
                throw new RuntimeException("Begin position not contained in the route path");
            var firstTrack = flattenSections.removeFirst();
            if (firstTrack.containsLocation(beginLocation)) {
                var newTrackSection = new TrackSectionRange(firstTrack.edge, firstTrack.direction,
                        beginLocation.offset, firstTrack.getEndPosition());
                flattenSections.addFirst(newTrackSection);
                break;
            }
        }

        // Drop lasts track sections until the end location
        while (true) {
            if (flattenSections.isEmpty())
                throw new RuntimeException("End position not contained in the route path");
            var lastTrack = flattenSections.removeLast();
            if (lastTrack.containsLocation(endLocation)) {
                var newTrackSection = new TrackSectionRange(lastTrack.edge, lastTrack.direction,
                        lastTrack.getBeginPosition(), endLocation.offset);
                flattenSections.addLast(newTrackSection);
                break;
            }
        }

        // Merge duplicated edges
        var trackSectionPath = new ArrayList<TrackSectionRange>();
        TrackSectionRange lastTrack = flattenSections.removeFirst();
        while (!flattenSections.isEmpty()) {
            var currentTrack = flattenSections.removeFirst();
            if (lastTrack.edge != currentTrack.edge) {
                trackSectionPath.add(lastTrack);
                lastTrack = currentTrack;
                continue;
            }
            lastTrack = TrackSectionRange.merge(lastTrack, currentTrack);
        }
        trackSectionPath.add(lastTrack);
        return trackSectionPath;
    }

    private static ArrayList<PointValue<ActionPoint>> trackSectionToActionPointPath(
            double driverSightDistance,
            Iterable<TrackSectionRange> trackSectionRanges
    ) {
        var eventPath = new ArrayList<PointValue<ActionPoint>>();
        double pathLength = 0;
        for (var trackRange : trackSectionRanges) {
            for (var interactablePoint : TrackSection.getInteractables(trackRange.edge, trackRange.direction)) {
                if (!trackRange.containsPosition(interactablePoint.position))
                    continue;

                var interactable = interactablePoint.value;

                var sightDistance = Double.min(interactable.getActionDistance(), driverSightDistance);
                var edgeDistToObj = Math.abs(interactablePoint.position - trackRange.getBeginPosition());
                var objPathOffset = pathLength + edgeDistToObj - sightDistance;
                if (objPathOffset < 0)
                    objPathOffset = 0;

                eventPath.add(new PointValue<>(objPathOffset, interactable));
            }
            pathLength += trackRange.length();
        }
        eventPath.sort(Comparator.comparing(pointValue -> pointValue.position));
        // If no action point at the very end of the path then add a virtual action point
        if (eventPath.get(eventPath.size() - 1).position < pathLength) {
            var virtualActionPoint = new VirtualActionPoint();
            eventPath.add(new PointValue<>(pathLength, virtualActionPoint));
        }
        return eventPath;
    }

    @Override
    public PhaseState getState() {
        return new State(this);
    }

    @Override
    public TrackSectionLocation getEndLocation() {
        return endLocation;
    }

    @Override
    public void forEachPathSection(Consumer<TrackSectionRange> consumer) {
        trackSectionPath.forEach(consumer);
    }

    /** This class represent an empty action point. It's as last event in the event path */
    private static final class VirtualActionPoint implements ActionPoint {

        @Override
        public TrainInteractionType getInteractionType() {
            return TrainInteractionType.HEAD;
        }

        @Override
        public double getActionDistance() {
            return 0;
        }

        @Override
        public void interact(Simulation sim, Train train, TrainInteractionType actionType) { }

        @Override
        public String toString() {
            return "VirtualActionPoint { }";
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    public static final class State extends PhaseState {
        public final SignalNavigatePhase phase;
        private int routeIndex = 0;
        private int eventPathIndex = 0;

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(PhaseState other) {
            if (other.getClass() != State.class)
                return false;
            var o = (State) other;
            return o.phase == phase && o.routeIndex == routeIndex && o.eventPathIndex == eventPathIndex;
        }

        public State(SignalNavigatePhase phase) {
            this.phase = phase;
        }

        private TrainInteractionType nextInteractionType(TrainState trainState) {
            var nextHeadPosition = phase.actionPointPath.get(eventPathIndex).position;

            double nextTailPosition = Double.POSITIVE_INFINITY;
            if (!trainState.actionPointsUnderTrain.isEmpty())
                nextTailPosition = trainState.actionPointsUnderTrain.getFirst().position;

            if (nextTailPosition + trainState.trainSchedule.rollingStock.length < nextHeadPosition)
                return TrainInteractionType.TAIL;
            return TrainInteractionType.HEAD;
        }

        private PointValue<ActionPoint> nextInteraction(TrainState trainState, TrainInteractionType interactionType) {
            switch (interactionType) {
                case HEAD:
                    var nextHeadEvent = phase.actionPointPath.get(eventPathIndex);

                    if (nextHeadEvent.value.getInteractionType().interactsWithTail())
                        trainState.actionPointsUnderTrain.addLast(nextHeadEvent);

                    eventPathIndex++;
                    return nextHeadEvent;
                case TAIL:
                    var nextInteraction = trainState.actionPointsUnderTrain.removeFirst();
                    // Need to compute the next interaction position relative to the head
                    var goalPosition = nextInteraction.position + trainState.trainSchedule.rollingStock.length;
                    return new PointValue<>(goalPosition, nextInteraction.value);
                default:
                    throw new RuntimeException("Unknown interaction type");
            }
        }

        @Override
        public void simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError {
            // Check if we reached our goal
            if (eventPathIndex == phase.actionPointPath.size()) {
                var change = new Train.TrainStateChange(sim, train.getName(), trainState.nextPhase());
                change.apply(sim, train);
                sim.publishChange(change);
                return;
            }

            // 1) find the next event position
            var interactionType = nextInteractionType(trainState);
            var nextEventTrackPosition = nextInteraction(trainState, interactionType);

            // 2) simulate up to nextEventTrackPosition
            var newTrainState = trainState.clone();
            var simulationResult = newTrainState.evolveState(sim, nextEventTrackPosition.position);

            // 3) create an event with simulation data up to this point
            TrainReachesActionPoint.plan(
                    sim,
                    simulationResult.newState.time,
                    train,
                    nextEventTrackPosition.value,
                    simulationResult,
                    interactionType
            );
        }

        /**
         * A function called by signals when a new limit is announced
         * @param distanceToAnnounce distance to the place the announce starts
         * @param distanceToExecution distance to the place the limit must be enforced
         */
        public void onLimitAnnounce(
                TrainState trainState,
                double distanceToAnnounce,
                double distanceToExecution,
                double speedLimit
        ) {
            var currentPos = trainState.location.getPathPosition();
            trainState.speedControllers.add(new LimitAnnounceSpeedController(
                    speedLimit,
                    currentPos + distanceToAnnounce,
                    currentPos + distanceToExecution,
                    trainState.trainSchedule.rollingStock.timetableGamma
            ));
        }

        private TVDSection findForwardTVDSection(Waypoint waypoint) {
            // TODO: Find a faster and smarter way to do it
            for (var route : phase.routePath) {
                for (var j = 0; j < route.tvdSectionsPath.size(); j++) {
                    var tvdSectionPath = route.tvdSectionsPath.get(j);
                    var tvdSectionPathDirection = route.tvdSectionsPathDirection.get(j);
                    if (tvdSectionPath.getStartNode(tvdSectionPathDirection) == waypoint.index)
                        return tvdSectionPath.tvdSection;
                }
            }
            throw new RuntimeException("Can't find the waypoint in the planned route path");
        }

        private TVDSection findBackwardTVDSection(Waypoint waypoint) {
            // TODO: Find a faster and smarter way to do it
            for (var route : phase.routePath) {
                for (var j = 0; j < route.tvdSectionsPath.size(); j++) {
                    var tvdSectionPath = route.tvdSectionsPath.get(j);
                    var tvdSectionPathDirection = route.tvdSectionsPathDirection.get(j);
                    if (tvdSectionPath.getEndNode(tvdSectionPathDirection) == waypoint.index)
                        return tvdSectionPath.tvdSection;
                }
            }
            throw new RuntimeException("Can't find the waypoint in the planned route path");
        }

        /** Occupy and free tvd sections given a detector the train is interacting with. */
        public void updateTVDSections(Simulation sim, Detector detector, TrainInteractionType interactionType) {
            // Update route index
            var currentRoute = phase.routePath.get(routeIndex);
            var tvdSectionPathIndex = currentRoute.tvdSectionsPath.size() - 1;
            var lastTvdSectionPath = currentRoute.tvdSectionsPath.get(tvdSectionPathIndex);
            var lastTvdSectionPathDir = currentRoute.tvdSectionsPathDirection.get(tvdSectionPathIndex);
            if (lastTvdSectionPath.getEndNode(lastTvdSectionPathDir) == detector.index)
                routeIndex++;

            // Occupy the next tvdSection
            if (interactionType == TrainInteractionType.HEAD) {
                var forwardTVDSectionPath = findForwardTVDSection(detector);
                var nextTVDSection = sim.infraState.getTvdSectionState(forwardTVDSectionPath.index);
                nextTVDSection.occupy(sim);
                return;
            }
            // Doesn't occupy the last tvdSection
            var backwardTVDSectionPath = findBackwardTVDSection(detector);
            var backwardTVDSection = sim.infraState.getTvdSectionState(backwardTVDSectionPath.index);
            backwardTVDSection.unoccupy(sim);
        }

        public int getRouteIndex() {
            return routeIndex;
        }
    }
}
