package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer;
import fr.sncf.osrd.envelope_sim.*;

public class EnvelopeCoasting {
    /** Generate a coasting curve overlay */
    public static void coast(
            EnvelopeSimContext context,
            double startPosition,
            double startSpeed,
            InteractiveEnvelopePartConsumer consumer,
            double directionSign
    ) {
        if (!consumer.initEnvelopePart(startPosition, startSpeed, directionSign))
            return;
        double position = startPosition;
        double speed = startSpeed;
        while (true) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, directionSign);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (!consumer.addStep(position, speed, step.timeDelta))
                break;
        }
        assert speed >= 0;
    }
}
