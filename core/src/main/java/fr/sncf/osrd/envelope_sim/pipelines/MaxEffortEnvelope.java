package fr.sncf.osrd.envelope_sim.pipelines;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration;

/** Max effort envelope = Max speed envelope + acceleration curves + check maintain speed
 * It is the max physical speed at any given point, ignoring allowances */
public class MaxEffortEnvelope {
    public static final class AccelerationMeta extends EnvelopePartMeta {}

    public static final class MaintainMeta extends EnvelopePartMeta {}

    public static final EnvelopePartMeta ACCELERATION = new AccelerationMeta();
    public static final EnvelopePartMeta MAINTAIN = new MaintainMeta();

    static boolean maxEffortPlateau(EnvelopePart part) {
        if (part.stepCount() != 1)
            return false;
        return part.getBeginSpeed() == part.getEndSpeed();
    }

    /** Generate acceleration curves overlay everywhere the max speed envelope increase with a discontinuity */
    private static Envelope addAccelerationCurves(PhysicsRollingStock rollingStock,
                                                 PhysicsPath path,
                                                 Envelope maxSpeedProfile,
                                                 double initialSpeed) {
        var builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile);
        {
            var partBuilder = builder.startDiscontinuousOverlay(ACCELERATION, initialSpeed);
            EnvelopeAcceleration.accelerate(rollingStock, path, 4, 0, initialSpeed, partBuilder);
            builder.addPart(partBuilder);
        }
        while (builder.cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var partBuilder = builder.startContinuousOverlay(ACCELERATION);
            var startSpeed = partBuilder.getLastSpeed();
            var startPosition = builder.cursor.getPosition();
            EnvelopeAcceleration.accelerate(rollingStock, path, 4, startPosition, startSpeed, partBuilder);
            builder.addPart(partBuilder);
            builder.cursor.nextPart();
        }
        return builder.build();
    }

    /** Generate overlays everywhere the train cannot physically maintain the target speed */
    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static Envelope addMaintainSpeedCurves(PhysicsRollingStock rollingStock,
                                                  PhysicsPath path,
                                                  Envelope maxSpeedProfile) {
        var builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile);
        while (builder.cursor.findPart(MaxEffortEnvelope::maxEffortPlateau)) {
            double speed = builder.cursor.getStepBeginSpeed();
            double maxTractionForce = rollingStock.getMaxEffort(speed);
            double rollingResistance = rollingStock.getRollingResistance(speed);
            double inertia = rollingStock.getInertia();
            double worstRamp = Math.asin((maxTractionForce - rollingResistance) / inertia / 9.81) * 1000;
            var envelopePart = builder.cursor.getPart();
            while (true) {
                double highRampPosition = path.findHighGradePosition(
                        builder.cursor.getPosition(), envelopePart.getEndPos(), rollingStock.getLength(), worstRamp);
                builder.cursor.findPosition(highRampPosition);
                if (builder.cursor.getPosition() == envelopePart.getEndPos())
                    break;
                var partBuilder = builder.startContinuousOverlay(MAINTAIN);
                var startPosition = builder.cursor.getPosition();
                var startSpeed = partBuilder.getLastSpeed();
                EnvelopeAcceleration.accelerate(rollingStock, path, 4, startPosition, startSpeed, partBuilder);
                builder.addPart(partBuilder);
            }
            builder.cursor.nextPart();
        }
        return builder.build();
    }

    /** Generate a max effort envelope given a max speed envelope */
    public static Envelope from(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double initialSpeed,
            Envelope maxSpeedProfile
    ) {
        var maxEffortEnvelope = addAccelerationCurves(rollingStock, path, maxSpeedProfile, initialSpeed);
        maxEffortEnvelope = addMaintainSpeedCurves(rollingStock, path, maxEffortEnvelope);
        return maxEffortEnvelope;
    }
}
