package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.train.Interaction;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.phases.NavigatePhaseState;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;

public abstract class AspectConstraint {

    public static class ConstraintPosition {
        public final double offset;
        public final ConstraintPosition.Element element;

        public enum Element {
            CURRENT_SIGNAL,
            NEXT_SIGNAL,
            NEXT_SWITCH,
            END
        }

        public ConstraintPosition(double offset, ConstraintPosition.Element element) {
            this.offset = offset;
            this.element = element;
        }

        /** Convert to a path position given a phase a train state */
        public double convert(NavigatePhaseState navigatePhase, TrainState trainState) {
            Predicate<Interaction> isSignal = interaction -> interaction.interactionType == InteractionType.HEAD
                    && interaction.actionPoint.getClass() == Signal.class;
            double interactionPosition = Double.POSITIVE_INFINITY;
            if (element == Element.NEXT_SIGNAL) {
                AtomicBoolean isNext = new AtomicBoolean(false);
                interactionPosition = interactionToPosition(
                        navigatePhase.findFirstInteractions(trainState, interaction -> {
                            if (!isSignal.test(interaction))
                                return false;
                            if (isNext.get())
                                return true;
                            isNext.set(true);
                            return false;
                        }));
            } else if (element == Element.CURRENT_SIGNAL) {
                interactionPosition = interactionToPosition(navigatePhase.findFirstInteractions(trainState, isSignal));
            } else if (element == Element.NEXT_SWITCH)
                interactionPosition = getNextSwitchPosition(
                        navigatePhase.phase.expectedPath,
                        trainState.location.getPathPosition()
                );

            return interactionPosition + offset;
        }

        /** Returns the interaction position, or positive infinity if null */
        private static double interactionToPosition(Interaction interaction) {
            if (interaction == null)
                return Double.POSITIVE_INFINITY;
            return interaction.position;
        }

        /** Returns the next switch position in the given path */
        private static double getNextSwitchPosition(TrainPath path, double position) {
            return path.switchPosition.stream()
                    .filter(p -> p >= position)
                    .findFirst()
                    .orElse(Double.POSITIVE_INFINITY);
        }
    }

    public static class SpeedLimit extends AspectConstraint {
        public final double speed;
        public final ConstraintPosition appliesAt;
        public final ConstraintPosition until;

        /** Create a speed limit constraint */
        public SpeedLimit(double speed, ConstraintPosition appliesAt, ConstraintPosition until) {
            this.speed = speed;
            this.appliesAt = appliesAt;
            this.until = until;
        }
    }
}
