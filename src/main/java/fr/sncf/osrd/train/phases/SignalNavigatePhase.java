package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.StopActionPoint;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.signaling.AspectConstraint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

public final class SignalNavigatePhase implements Phase {
    public final TrainPath expectedPath;
    public TrackSectionLocation startLocation;
    public final TrackSectionLocation endLocation;
    private final ArrayList<Interaction> interactionsPath;
    private final Interaction lastInteractionOnPhase;
    private final double driverSightDistance;

    private SignalNavigatePhase(
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            ArrayList<Interaction> interactionsPath,
            double driverSightDistance,
            TrainPath expectedPath) {
        this.startLocation = startLocation;
        this.endLocation = endLocation;
        this.interactionsPath = interactionsPath;
        this.driverSightDistance = driverSightDistance;
        this.expectedPath = expectedPath;
        lastInteractionOnPhase = interactionsPath.get(interactionsPath.size() - 1);
    }



    /** Create a new navigation phase from an already determined path */
    public static SignalNavigatePhase from(
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            TrainPath expectedPath,
            List<TrainStop> stops
    ) {
        if (stops == null)
            stops = new ArrayList<>();

        var actionPointPath = trackSectionToActionPointPath(driverSightDistance,
                expectedPath,
                startLocation,
                endLocation,
                expectedPath.trackSectionPath);
        addStopInteractions(actionPointPath, stops);
        return new SignalNavigatePhase(startLocation, endLocation, actionPointPath,
                driverSightDistance, expectedPath);
    }

    private static void addStopInteractions(ArrayList<Interaction> interactions, List<TrainStop> stops) {
        for (int i = 0; i < stops.size(); i++) {
            var stop = stops.get(i);
            interactions.add(new Interaction(InteractionType.HEAD, stop.position, new StopActionPoint(i)));
        }
    }

    private static ArrayList<Interaction> trackSectionToActionPointPath(
            double driverSightDistance,
            TrainPath path,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            Iterable<TrackSectionRange> trackSectionRanges
    ) {
        var startPosition = path.convertTrackLocation(startLocation);
        var endPosition = path.convertTrackLocation(endLocation);
        var eventPath = new ArrayList<Interaction>();
        double pathLength = 0;
        for (var trackRange : trackSectionRanges) {
            if (pathLength + trackRange.length() >= startPosition)
                registerRange(eventPath, trackRange, pathLength, driverSightDistance);
            pathLength += trackRange.length();
            if (pathLength > endPosition + driverSightDistance)
                break;
        }

        eventPath = eventPath.stream()
                .filter(interaction -> interaction.position >= startPosition && interaction.position <= endPosition)
                .sorted()
                .collect(Collectors.toCollection(ArrayList::new));

        return eventPath;
    }

    private static void registerRange(ArrayList<Interaction> eventPath, TrackSectionRange trackRange,
                                      double pathLength, double driverSightDistance) {
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
    }

    @Override
    public PhaseState getState(Simulation sim, TrainSchedule schedule) {
        return new State(this, sim, schedule);
    }

    @Override
    public TrackSectionLocation getEndLocation() {
        return endLocation;
    }

    public static final class State extends PhaseState {
        public final SignalNavigatePhase phase;
        private int interactionsPathIndex = 0;
        private final transient Simulation sim;
        private final transient TrainSchedule schedule;
        private final transient HashMap<Signal, ArrayList<SpeedController>> signalControllers;

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(PhaseState other) {
            if (other.getClass() != State.class)
                return false;
            var o = (State) other;
            return o.phase == phase && o.interactionsPathIndex == interactionsPathIndex;
        }

        @Override
        public PhaseState clone() {
            return new SignalNavigatePhase.State(this);
        }

        State(SignalNavigatePhase phase, Simulation sim, TrainSchedule schedule) {
            this.sim = sim;
            this.schedule = schedule;
            this.phase = phase;
            this.signalControllers = new HashMap<>();
        }

        State(SignalNavigatePhase.State state) {
            this.phase = state.phase;
            this.interactionsPathIndex = state.interactionsPathIndex;
            this.signalControllers = state.signalControllers;
            this.schedule = state.schedule;
            this.sim = state.sim;
        }

        private boolean isInteractionUnderTrain(TrainState trainState) {
            var nextFrontalInteraction = phase.interactionsPath.get(interactionsPathIndex);

            double nextBackInteractionDistance = Double.POSITIVE_INFINITY;
            if (!trainState.actionPointsUnderTrain.isEmpty())
                nextBackInteractionDistance = trainState.actionPointsUnderTrain.getFirst().position;

            return nextBackInteractionDistance < nextFrontalInteraction.position;
        }

        /** Return the first interaction that satisfies the predicate. */
        public Interaction findFirstInteractions(TrainState trainState, Predicate<Interaction> predicate) {
            var interactionIndex = interactionsPathIndex;
            for (var underTrain : trainState.actionPointsUnderTrain) {
                var posUnderTrain = underTrain.position;
                while (interactionIndex < phase.interactionsPath.size()
                        && phase.interactionsPath.get(interactionIndex).position < posUnderTrain) {
                    var interaction = phase.interactionsPath.get(interactionIndex);
                    if (predicate.test(interaction))
                        return interaction;
                    interactionIndex++;
                }
                if (predicate.test(underTrain))
                    return underTrain;
            }
            while (interactionIndex < phase.interactionsPath.size()) {
                var interaction = phase.interactionsPath.get(interactionIndex);
                if (predicate.test(interaction))
                    return interaction;
                interactionIndex++;
            }
            return null;
        }

        private Interaction peekInteraction(TrainState trainState) {
            // Interact with next action point under the train
            if (isInteractionUnderTrain(trainState))
                return trainState.actionPointsUnderTrain.peekFirst();

            // Interact with next action point in front of the train
            return phase.interactionsPath.get(interactionsPathIndex);
        }

        private void popInteraction(TrainState trainState) {
            if (isInteractionUnderTrain(trainState))
                trainState.actionPointsUnderTrain.removeFirst();
            else
                interactionsPathIndex++;
        }

        private boolean hasPhaseEnded() {
            if (interactionsPathIndex == phase.interactionsPath.size())
                return true;
            if (interactionsPathIndex == 0)
                return false;
            return phase.interactionsPath.get(interactionsPathIndex - 1) == phase.lastInteractionOnPhase;
        }

        @Override
        public TimelineEvent simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError {
            // Check if we reached our goal
            if (hasPhaseEnded()) {
                var nextState = trainState.nextPhase(sim);
                var change = new Train.TrainStateChange(sim, train.getName(), nextState);
                change.apply(sim, train);
                sim.publishChange(change);
                if (trainState.isDuringLastPhase())
                    return null;
                else
                    return nextState.simulatePhase(train, sim);
            }

            // 1) find the next interaction event
            var nextInteraction = peekInteraction(trainState);

            // 2) If the action point can interact with the tail of the train add it to the interaction list
            addInteractionUnderTrain(trainState, nextInteraction);

            // 3) simulate up to nextEventTrackPosition
            var simulationResult = trainState.evolveStateUntilPosition(sim, nextInteraction.position);

            // 4) create an event with simulation data up to this point

            // The train reached the action point
            if (trainState.location.getPathPosition() >= nextInteraction.position) {
                popInteraction(trainState);
                return TrainReachesActionPoint.plan(sim, trainState.time, train, simulationResult, nextInteraction);
            }
            // The train didn't reached the action point (stopped because of signalisation)
            return TrainMoveEvent.plan(sim, trainState.time, train, simulationResult);
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

        private ArrayList<SpeedController> parseAspectConstraint(AspectConstraint constraint, TrainState trainState) {
            if (constraint.getClass() == AspectConstraint.SpeedLimit.class) {
                var speedLimit = (AspectConstraint.SpeedLimit) constraint;
                var appliesAt = speedLimit.appliesAt.convert(this, trainState);
                var until = speedLimit.until.convert(this, trainState);
                var res = new ArrayList<SpeedController>();
                res.add(LimitAnnounceSpeedController.create(
                        trainState.trainSchedule.rollingStock.maxSpeed,
                        speedLimit.speed,
                        appliesAt,
                        trainState.trainSchedule.rollingStock.timetableGamma
                ));
                res.add(new MaxSpeedController(
                        speedLimit.speed,
                        appliesAt,
                        until
                ));
                return res;
            }
            throw new RuntimeException("AspectConstraint not handled");
        }

        /** Add or update aspects constraint of a signal */
        public void setAspectConstraints(SignalState signalState, TrainState trainState) {
            var controllers = new ArrayList<SpeedController>();
            for (var aspect : signalState.aspects) {
                for (var constraint : aspect.constraints)
                    controllers.addAll(parseAspectConstraint(constraint, trainState));
            }
            signalControllers.put(signalState.signal, controllers);
        }

        @Override
        public ArrayList<SpeedController> getSpeedControllers() {
            var controllers = new ArrayList<SpeedController>();
            for (var signalControllers : signalControllers.values())
                controllers.addAll(signalControllers);
            return controllers;
        }
    }
}
