package fr.sncf.osrd.envelope_sim.overlays;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;

public class EnvelopeAcceleration {
    /** Accelerate, storing the resulting steps into consumer */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public static void accelerate(
            EnvelopeSimContext context,
            double startPosition,
            double startSpeed,
            InteractiveEnvelopePartConsumer consumer,
            double direction) {
        consumer.checkConstraints();
        if (!consumer.initEnvelopePart(startPosition, startSpeed, direction)) return;
        double position = startPosition;
        double speed = startSpeed;
        while (true) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.ACCELERATE, direction);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (step.positionDelta == 0.0 && step.startSpeed != step.endSpeed) {
                // This case causes failed assertions in `consumer.addStep`, we need to throw earlier than in the
                // generic positionDelta == 0 case. When the speed delta is 0, we may break normally before throwing.
                throw new OSRDError(ErrorType.ImpossibleSimulationError);
            }
            if (!consumer.addStep(position, speed, step.timeDelta)) break;
            if (step.positionDelta == 0.0) throw new OSRDError(ErrorType.ImpossibleSimulationError);
        }
    }
}
