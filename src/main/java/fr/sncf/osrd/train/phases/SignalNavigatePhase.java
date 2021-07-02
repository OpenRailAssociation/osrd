package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.routegraph.Route;
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
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;

public final class SignalNavigatePhase implements Phase {
    public final TrainPath expectedPath;
    public final List<Route> routePath;
    public final TrackSectionLocation endLocation;
    private final ArrayList<TrackSectionRange> trackSectionPath;
    private final ArrayList<Interaction> interactionsPath;
    private final Interaction lastInteractionOnPhase;
    private final double driverSightDistance;
    public transient List<SpeedControllerGenerator> targetSpeedGenerators;

    /** Offset between the beginning of the global train path and the beginning of this phase */
    public double offset;

    private SignalNavigatePhase(
            List<Route> routePath,
            TrackSectionLocation endLocation,
            ArrayList<TrackSectionRange> trackSectionPath,
            ArrayList<Interaction> interactionsPath,
            double driverSightDistance,
            List<SpeedControllerGenerator> targetSpeedGenerators,
            TrainPath expectedPath) {
        this.routePath = routePath;
        this.endLocation = endLocation;
        this.trackSectionPath = trackSectionPath;
        this.interactionsPath = interactionsPath;
        this.driverSightDistance = driverSightDistance;
        this.targetSpeedGenerators = targetSpeedGenerators;
        this.expectedPath = expectedPath;
        lastInteractionOnPhase = interactionsPath.get(interactionsPath.size() - 1);
    }



    /** Create a new navigation phase from an already determined path */
    public static SignalNavigatePhase from(
            List<Route> routes,
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            List<SpeedControllerGenerator> targetSpeedGenerators,
            TrainPath expectedPath
    ) throws InvalidSchedule {
        var trackSectionPath = Route.routesToTrackSectionRange(routes,
                startLocation, endLocation);
        var actionPointPath = trackSectionToActionPointPath(driverSightDistance, trackSectionPath);
        return new SignalNavigatePhase(routes, endLocation, trackSectionPath, actionPointPath,
                driverSightDistance, targetSpeedGenerators, expectedPath);
    }

    private static ArrayList<Interaction> trackSectionToActionPointPath(
            double driverSightDistance,
            Iterable<TrackSectionRange> trackSectionRanges
    ) {
        var eventPath = new ArrayList<Interaction>();
        double pathLength = 0;
        for (var trackRange : trackSectionRanges) {
            registerRange(eventPath, trackRange, pathLength, driverSightDistance);
            pathLength += trackRange.length();
        }

        Collections.sort(eventPath);

        var phaseEnd = new PhaseEndActionPoint();
        // We place the end of phase a few meters before the actual end, because we will stop before reaching it
        eventPath.add(new Interaction(InteractionType.HEAD, pathLength - 1, phaseEnd));
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
    public void resolvePhases(List<Phase> phases) {
        boolean seenSelf = false;
        AtomicReference<Double> currentPosition = new AtomicReference<>(0.);
        for (var phase : phases) {
            boolean finalSeenSelf = seenSelf;
            if (phase == this) {
                seenSelf = true;
                offset = currentPosition.get();
                for (var ip : interactionsPath)
                    ip.position += offset;
            }

            // TODO ech: remove this block by the end of the phase rework
            if (phase instanceof SignalNavigatePhase) {
                var other = (SignalNavigatePhase) phase;
                other.trackSectionPath.forEach(pathSection -> {
                    if (finalSeenSelf)
                        registerRange(interactionsPath, pathSection, currentPosition.get(), driverSightDistance);
                    currentPosition.updateAndGet(v -> v + pathSection.length());
                });
            }
        }
        interactionsPath.sort(Comparator.comparingDouble(i -> i.position));
    }

    @Override
    public PhaseState getState(Simulation sim, TrainSchedule schedule) {
        return new State(this, sim, schedule);
    }

    @Override
    public TrackSectionLocation getEndLocation() {
        return endLocation;
    }

    /** This class represent the location of the phase end. It's as last event in the event path */
    public static final class PhaseEndActionPoint implements ActionPoint {

        @Override
        public InteractionTypeSet getInteractionsType() {
            return new InteractionTypeSet();
        }

        @Override
        public double getActionDistance() {
            return 0;
        }

        @Override
        public void interact(Simulation sim, Train train, InteractionType actionType) {
            var change = new EndOfPhase(sim, train, train.getLastState().currentPhaseIndex);
            sim.publishChange(change);
        }

        @Override
        public String toString() {
            return "PhaseEndActionPoint { }";
        }

        public static class EndOfPhase extends Change {
            public final Train train;
            public final int phaseIndex;

            /** Create a change to notify that a train has reached the end of its current phase */
            public EndOfPhase(Simulation sim, Train train, int phaseIndex) {
                super(sim);
                this.train = train;
                this.phaseIndex = phaseIndex;
            }

            @Override
            public void replay(Simulation sim) {}

            @Override
            public String toString() {
                return String.format("EndOfPhase { train: %s, phase index: %d }", train.getName(), phaseIndex);
            }
        }
    }

    public static final class State extends PhaseState {
        public final SignalNavigatePhase phase;
        private int routeIndex = 0;
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
            return o.phase == phase && o.routeIndex == routeIndex && o.interactionsPathIndex == interactionsPathIndex;
        }

        @Override
        public PhaseState clone() {
            return new SignalNavigatePhase.State(this);
        }

        State(SignalNavigatePhase phase, Simulation sim, TrainSchedule schedule) {
            super(phase.targetSpeedGenerators);
            this.sim = sim;
            this.schedule = schedule;
            speedInstructions.generate(sim, schedule);
            this.phase = phase;
            this.signalControllers = new HashMap<>();
        }

        State(SignalNavigatePhase.State state) {
            super(state.speedInstructions);
            this.phase = state.phase;
            this.routeIndex = state.routeIndex;
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
