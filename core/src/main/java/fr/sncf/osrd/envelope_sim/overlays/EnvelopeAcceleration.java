package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.InteractiveEnvelopePartConsumer;
import fr.sncf.osrd.envelope_sim.*;

public class EnvelopeAcceleration {
    /** Accelerate, storing the resulting steps into consumer */
    public static void accelerate(
            EnvelopeSimContext context,
            double startPosition,
            double startSpeed,
            InteractiveEnvelopePartConsumer consumer,
            double direction
    ) {
        if (!consumer.initEnvelopePart(startPosition, startSpeed, direction))
            return;
        double position = startPosition;
        double speed = startSpeed;
        while (true) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.ACCELERATE, direction);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (!consumer.addStep(position, speed, step.timeDelta))
                break;
        }
    }
}
