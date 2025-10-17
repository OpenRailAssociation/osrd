package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.envelope_sim.etcs.BrakingType;

public class EnvelopeDeceleration {
    /** Generate a deceleration curve overlay */
    public static void decelerate(
            EnvelopeSimContext context,
            double startPosition,
            double startSpeed,
            InteractiveEnvelopePartConsumer consumer,
            double direction,
            BrakingType brakingType) {
        consumer.checkConstraints();
        if (!consumer.initEnvelopePart(startPosition, startSpeed, direction)) return;
        double position = startPosition;
        double speed = startSpeed;
        while (true) {
            var step = TrainPhysicsIntegrator.step(context, position, speed, Action.BRAKE, direction, brakingType);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (!consumer.addStep(position, speed, step.timeDelta)) break;
        }
    }

    public static void decelerate(
            EnvelopeSimContext context,
            double startPosition,
            double startSpeed,
            InteractiveEnvelopePartConsumer consumer,
            double direction) {
        decelerate(context, startPosition, startSpeed, consumer, direction, BrakingType.CONSTANT);
    }
}
