package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.StepConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;

public class EnvelopeMaintainSpeed {
    /** Generate an overlay under a constant speed curve.
     * This method is called when scanning a constant speed profile and detecting a slope so high that the train cannot
     * physically maintain the target speed */
    public static void maintain(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            double startPosition,
            double startSpeed,
            StepConsumer consumer
    ) {
        double position = startPosition;
        double speed = startSpeed;
        while (true) {
            var step = TrainPhysicsIntegrator.step(rollingStock, path, timeStep, position, speed,
                    Action.MAINTAIN, 1);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (consumer.addStep(position, speed, step.timeDelta))
                break;
        }
    }
}
