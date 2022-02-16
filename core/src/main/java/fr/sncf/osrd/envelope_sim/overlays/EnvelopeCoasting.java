package fr.sncf.osrd.envelope_sim.overlays;

import fr.sncf.osrd.envelope.EnvelopePartMeta;
import fr.sncf.osrd.envelope.StepConsumer;
import fr.sncf.osrd.envelope_sim.Action;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;

public class EnvelopeCoasting {
    public static final class CoastingMeta extends EnvelopePartMeta {
    }

    public static final EnvelopePartMeta COASTING = new CoastingMeta();

    /** Generate a coasting curve overlay */
    public static void coast(
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
            var step = TrainPhysicsIntegrator.step(rollingStock, path, timeStep, position, speed,
                    Action.COAST, directionSign);
            position += step.positionDelta;
            speed = step.endSpeed;
            if (consumer.addStep(position, speed, step.timeDelta))
                break;
        }
        assert speed >= 0;
    }
}
