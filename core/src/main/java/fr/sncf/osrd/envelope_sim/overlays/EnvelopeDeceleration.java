package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.StepConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;

public class EnvelopeDeceleration {
    /** Generate a deceleration curve overlay */
    public static void decelerate(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            double startPosition,
            double startSpeed,
            StepConsumer consumer,
            double directionSign
    ) {
        double position = startPosition;
        double speed = startSpeed;
        while (true) {
            var step = TrainPhysicsIntegrator.step(
                    rollingStock, path, timeStep, position, speed, Action.BRAKE, directionSign
            );
            position += step.positionDelta;
            speed = step.endSpeed;
            if (consumer.addStep(position, speed, step.timeDelta))
                break;
        }
    }
}
