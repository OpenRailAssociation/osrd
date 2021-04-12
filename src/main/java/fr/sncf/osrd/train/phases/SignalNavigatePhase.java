package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

public final class SignalNavigatePhase implements Phase {
    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    public final List<Route> routePath;
    public final TrackSectionLocation endLocation;
    private final ArrayList<TrackSectionRange> trackSectionPath;
    private final ArrayList<Interaction> interactionsPath;

    private SignalNavigatePhase(
            List<Route> routePath,
            TrackSectionLocation endLocation,
            ArrayList<TrackSectionRange> trackSectionPath,
            ArrayList<Interaction> interactionsPath
    ) {
        this.routePath = routePath;
        this.endLocation = endLocation;
        this.trackSectionPath = trackSectionPath;
        this.interactionsPath = interactionsPath;
    }



    /** Create a new navigation phase from an already determined path */
    public static SignalNavigatePhase from(
            List<Route> routes,
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation
    ) {
        var trackSectionPath = Route.routesToTrackSectionRange(routes, startLocation, endLocation);
        var actionPointPath = trackSectionToActionPointPath(driverSightDistance, trackSectionPath);
        return new SignalNavigatePhase(routes, endLocation, trackSectionPath, actionPointPath);
    }

    private static ArrayList<Interaction> trackSectionToActionPointPath(
            double driverSightDistance,
            Iterable<TrackSectionRange> trackSectionRanges
    ) {
        var eventPath = new ArrayList<Interaction>();
        double pathLength = 0;
        for (var trackRange : trackSectionRanges) {
            for (var interactablePoint : TrackSection.getInteractables(trackRange.edge, trackRange.direction)) {
                if (!trackRange.containsPosition(interactablePoint.position))
                    continue;

                var interactable = interactablePoint.value;
                var edgeDistToObj = Math.abs(interactablePoint.position - trackRange.getBeginPosition());

                if (interactable.getInteractionsType().interactWithHead()) {
                    var distance = pathLength + edgeDistToObj;
                    eventPath.add(new Interaction(InteractionType.HEAD, distance, interactable));
                }
                if (interactable.getInteractionsType().interactWhenSeen()) {
                    var sightDistance = Double.min(interactable.getActionDistance(), driverSightDistance);
                    var distance = pathLength + edgeDistToObj - sightDistance;
                    if (distance < 0)
                        distance = 0;
                    eventPath.add(new Interaction(InteractionType.SEEN, distance, interactable));
                }
            }
            pathLength += trackRange.length();
        }

        Collections.sort(eventPath);

        // If no action point at the very end of the path then add a virtual action point
        if (eventPath.isEmpty() || eventPath.get(eventPath.size() - 1).position < pathLength) {
            var virtualActionPoint = new VirtualActionPoint();
            eventPath.add(new Interaction(InteractionType.HEAD, pathLength, virtualActionPoint));
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
    public static final class VirtualActionPoint implements ActionPoint {

        @Override
        public InteractionsType getInteractionsType() {
            return new InteractionsType();
        }

        @Override
        public double getActionDistance() {
            return 0;
        }

        @Override
        public void interact(Simulation sim, Train train, InteractionType actionType) { }

        @Override
        public String toString() {
            return "VirtualActionPoint { }";
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    public static final class State extends PhaseState {
        public final SignalNavigatePhase phase;
        private int routeIndex = 0;
        private int interactionsPathIndex = 0;
        private SignalState signalSubscribed = null;
        private TimelineEvent lastEvent = null;

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(PhaseState other) {
            if (other.getClass() != State.class)
                return false;
            var o = (State) other;
            return o.phase == phase && o.routeIndex == routeIndex && o.interactionsPathIndex == interactionsPathIndex;
        }

        public State(SignalNavigatePhase phase) {
            this.phase = phase;
        }

        private Interaction nextInteraction(TrainState trainState) {
            var nextFrontalInteraction = phase.interactionsPath.get(interactionsPathIndex);

            double nextBackInteractionDistance = Double.POSITIVE_INFINITY;
            if (!trainState.actionPointsUnderTrain.isEmpty())
                nextBackInteractionDistance = trainState.actionPointsUnderTrain.getFirst().position;

            // Interact with next action point under the train
            if (nextBackInteractionDistance < nextFrontalInteraction.position)
                return trainState.actionPointsUnderTrain.removeFirst();

            // Interact with next action point in front of the train
            return phase.interactionsPath.get(interactionsPathIndex++);
        }

        @Override
        public void simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError {
            // Check if we reached our goal
            if (interactionsPathIndex == phase.interactionsPath.size()) {
                if (signalSubscribed != null)
                    unsubscribeToSignal(sim, signalSubscribed.signal, trainState);
                var change = new Train.TrainStateChange(sim, train.getName(), trainState.nextPhase());
                change.apply(sim, train);
                sim.publishChange(change);
                return;
            }

            // 1) find the next interaction event
            var nextInteraction = nextInteraction(trainState);

            // 2) If the action point can interact with the tail of the train add it to the interaction list
            addInteractionUnderTrain(trainState, nextInteraction);

            // 3) simulate up to nextEventTrackPosition
            var newTrainState = trainState.clone();
            var simulationResult = newTrainState.evolveState(sim, nextInteraction.position);

            // 4) create an event with simulation data up to this point
            lastEvent = TrainReachesActionPoint.plan(
                    sim,
                    simulationResult.newState.time,
                    train,
                    simulationResult,
                    nextInteraction
            );
        }

        private static void addInteractionUnderTrain(TrainState trainState, Interaction interaction) {
            if (interaction.interactionType == InteractionType.TAIL)
                return;
            if (!interaction.actionPoint.getInteractionsType().interactWithTail())
                return;

            var trainLength = trainState.trainSchedule.rollingStock.length;
            var underTrainInteraction = new Interaction(
                    InteractionType.TAIL,
                    interaction.position + trainLength,
                    interaction.actionPoint
            );
            trainState.actionPointsUnderTrain.addLast(underTrainInteraction);
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
                for (var j = 0; j < route.tvdSectionsPaths.size(); j++) {
                    var tvdSectionPath = route.tvdSectionsPaths.get(j);
                    var tvdSectionPathDirection = route.tvdSectionsPathDirections.get(j);
                    if (tvdSectionPath.getStartNode(tvdSectionPathDirection) == waypoint.index)
                        return tvdSectionPath.tvdSection;
                }
            }
            throw new RuntimeException("Can't find the waypoint in the planned route path");
        }

        private TVDSection findBackwardTVDSection(Waypoint waypoint) {
            // TODO: Find a faster and smarter way to do it
            for (var route : phase.routePath) {
                for (var j = 0; j < route.tvdSectionsPaths.size(); j++) {
                    var tvdSectionPath = route.tvdSectionsPaths.get(j);
                    var tvdSectionPathDirection = route.tvdSectionsPathDirections.get(j);
                    if (tvdSectionPath.getEndNode(tvdSectionPathDirection) == waypoint.index)
                        return tvdSectionPath.tvdSection;
                }
            }
            throw new RuntimeException("Can't find the waypoint in the planned route path");
        }

        /** Occupy and free tvd sections given a detector the train is interacting with. */
        public void updateTVDSections(
                Simulation sim,
                Detector detector,
                InteractionType interactionType
        ) throws SimulationError {
            // Update route index
            var currentRoute = phase.routePath.get(routeIndex);
            var tvdSectionPathIndex = currentRoute.tvdSectionsPaths.size() - 1;
            var lastTvdSectionPath = currentRoute.tvdSectionsPaths.get(tvdSectionPathIndex);
            var lastTvdSectionPathDir = currentRoute.tvdSectionsPathDirections.get(tvdSectionPathIndex);
            if (lastTvdSectionPath.getEndNode(lastTvdSectionPathDir) == detector.index)
                routeIndex++;

            // Occupy the next tvdSection
            if (interactionType == InteractionType.HEAD) {
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

        /** Subscribe to a signal */
        public void subscribeToSignal(Simulation sim, Signal signal, TrainState train) {
            assert signalSubscribed == null;
            var signalState = sim.infraState.getSignalState(signal.index);
            signalState.subscribeTrain(train);
            signalSubscribed = signalState;

        }

        /** Unsubscribe to a signal */
        public void unsubscribeToSignal(Simulation sim, Signal signal, TrainState train) {
            assert signalSubscribed != null;
            var signalState = sim.infraState.getSignalState(signal.index);
            signalState.unsubscribeTrain(train);
            signalSubscribed = null;

        }

        public int getRouteIndex() {
            return routeIndex;
        }

        public TimelineEvent getLastEvent() {
            return lastEvent;
        }
    }
}
