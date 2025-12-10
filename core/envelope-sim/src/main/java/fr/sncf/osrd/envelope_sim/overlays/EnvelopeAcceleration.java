package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;

public class EnvelopeAcceleration {
    /** Accelerate, storing the resulting steps into consumer */
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
            if (!consumer.addStep(position, speed, step.timeDelta)) break;
            if (step.positionDelta == 0.0) throw new OSRDError(ErrorType.ImpossibleSimulationError);
        }
    }
}
