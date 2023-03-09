package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;

public class EnvelopeMaintain {
    /** Maintain the speed, storing the resulting steps into consumer */
    public static void maintain(
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
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.MAINTAIN, direction);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (!consumer.addStep(position, speed, step.timeDelta))
                break;
        }
    }
}
