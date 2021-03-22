package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.TrainInteractable;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Consumer;

public class SignalNavigatePhase implements Phase {
    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    public final List<Route> routePath;
    public final TrackSectionLocation endLocation;
    private final ArrayList<TrackSectionRange> trackSectionPath;
    private final ArrayList<PointValue<TrainInteractable>> eventPath;

    private SignalNavigatePhase(
            List<Route> routePath,
            TrackSectionLocation endLocation,
            ArrayList<TrackSectionRange> trackSectionPath,
            ArrayList<PointValue<TrainInteractable>> eventPath
    ) {
        this.routePath = routePath;
        this.endLocation = endLocation;
        this.trackSectionPath = trackSectionPath;
        this.eventPath = eventPath;
    }

    /** Create a new navigation phase from an already determined path */
    public static SignalNavigatePhase from(
            List<Route> routes,
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation
    ) {
        var trackSectionPath = routesToTrackSectionRange(routes, startLocation, endLocation);
        var eventPath = trackSectionToEventPath(driverSightDistance, trackSectionPath);
        return new SignalNavigatePhase(routes, endLocation, trackSectionPath, eventPath);
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

    private static ArrayList<PointValue<TrainInteractable>> trackSectionToEventPath(
            double driverSightDistance,
            Iterable<TrackSectionRange> trackSectionRanges
    ) {
        var eventPath = new ArrayList<PointValue<TrainInteractable>>();
        double pathLength = 0;
        for (var trackRange : trackSectionRanges) {
            for (var interactablePoint : TrackSection.getInteractables(trackRange.edge, trackRange.direction)) {
                if (!trackRange.containsPosition(interactablePoint.position))
                    continue;

                var interactable = interactablePoint.value;

                var sightDistance = Double.min(interactable.getInteractionDistance(), driverSightDistance);
                var edgeDistToObj = Math.abs(interactablePoint.position - trackRange.getBeginPosition());
                var objPathOffset = pathLength + edgeDistToObj - sightDistance;
                if (objPathOffset < 0)
                    objPathOffset = 0;

                eventPath.add(new PointValue<>(objPathOffset, interactable));
            }
            pathLength += trackRange.length();
        }
        eventPath.sort(Comparator.comparing(pointValue -> pointValue.position));
        return eventPath;
    }

    public enum InteractionType {
        TAIL,
        HEAD
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

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    public static class State extends PhaseState {
        public final SignalNavigatePhase phase;
        private int routeIndex = 0;
        private int eventPathIndex = 0;

        public State(SignalNavigatePhase phase) {
            this.phase = phase;
        }

        private InteractionType nextInteractionType(TrainState trainState) {
            var nextHeadPosition = phase.eventPath.get(eventPathIndex).position;

            double nextTailPosition = Double.POSITIVE_INFINITY;
            if (!trainState.interactablesUnderTrain.isEmpty())
                nextTailPosition = trainState.interactablesUnderTrain.getFirst().position;

            if (nextTailPosition + trainState.trainSchedule.rollingStock.length < nextHeadPosition)
                return InteractionType.TAIL;
            return InteractionType.HEAD;
        }

        private PointValue<TrainInteractable> nextInteraction(TrainState trainState, InteractionType interactionType) {
            switch (interactionType) {
                case HEAD:
                    var nextHeadEvent = phase.eventPath.get(eventPathIndex);

                    if (nextHeadEvent.value.getInteractionType().interactsWithTail())
                        trainState.interactablesUnderTrain.addLast(nextHeadEvent);

                    eventPathIndex++;
                    return nextHeadEvent;
                case TAIL:
                    return trainState.interactablesUnderTrain.removeFirst();
                default:
                    throw new RuntimeException("Unknown interaction type");
            }
        }

        @Override
        public void simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError {
            // Check if we reached our goal
            if (eventPathIndex == phase.eventPath.size()) {
                sim.scheduleEvent(
                        train,
                        sim.getTime(),
                        new Train.TrainStateChange(sim, train.getID(), trainState.nextPhase())
                );
                return;
            }

            // 1) find the next event position
            var interactionType = nextInteractionType(trainState);
            var nextEventTrackPosition = nextInteraction(trainState, interactionType);

            // 2) simulate up to nextEventTrackPosition
            var newTrainState = trainState.clone();
            var simulationResult = newTrainState.evolveState(sim, nextEventTrackPosition.position);

            // 3) create an event with simulation data up to this point
            var eventTime = simulationResult.newState.time;
            assert eventTime >= sim.getTime();
            var event = new Train.TrainReachesInteraction(
                    nextEventTrackPosition.value, simulationResult, interactionType);
            sim.scheduleEvent(train, eventTime, event);
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

        private int findBackwardTVDSectionPathIndex(Waypoint waypoint) {
            for (; routeIndex < phase.routePath.size(); routeIndex++) {
                var route = phase.routePath.get(routeIndex);
                for (var i = 0; i < route.tvdSectionsPath.size(); i++) {
                    var tvdSectionPath = route.tvdSectionsPath.get(i);
                    var tvdSectionPathDirection = route.tvdSectionsPathDirection.get(i);
                    if (tvdSectionPath.getEndNode(tvdSectionPathDirection) == waypoint.index)
                        return i;
                }
            }
            throw new RuntimeException("Can't find the waypoint in the planned route path");
        }

        private TVDSection findForwardTVDSection(Waypoint waypoint) {
            var tvdSectionPathIndex = findBackwardTVDSectionPathIndex(waypoint);
            var route = phase.routePath.get(routeIndex);
            var tvdSectionPathDirection = route.tvdSectionsPathDirection.get(tvdSectionPathIndex);
            return waypoint.getTvdSectionPathNeighbors(tvdSectionPathDirection).get(0).tvdSection;
        }

        private TVDSection findBackwardTVDSection(Waypoint waypoint) {
            var tvdSectionPathIndex = findBackwardTVDSectionPathIndex(waypoint);
            var route = phase.routePath.get(routeIndex);
            var tvdSectionPath = route.tvdSectionsPath.get(tvdSectionPathIndex);
            return tvdSectionPath.tvdSection;
        }

        /** Occupy and free tvd sections given a detector the train is interacting with. */
        public void updateTVDSections(Simulation sim, Detector detector, InteractionType interactionType) {
            // Occupy the next tvdSection
            if (interactionType == InteractionType.HEAD) {
                var forwardTVDSectionPath = findForwardTVDSection(detector);
                var nextTVDSection = sim.infraState.getTvdSectionState(forwardTVDSectionPath.index);
                nextTVDSection.occupy(sim);
                return;
            }
            // Free the last tvdSection
            var backwardTVDSectionPath = findBackwardTVDSection(detector);
            var nextTVDSection = sim.infraState.getTvdSectionState(backwardTVDSectionPath.index);
            nextTVDSection.occupy(sim);
        }

        public int getRouteIndex() {
            return routeIndex;
        }
    }
}
