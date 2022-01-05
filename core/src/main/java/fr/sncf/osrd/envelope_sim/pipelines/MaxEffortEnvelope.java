package fr.sncf.osrd.envelope_sim.pipelines;

import fr.sncf.osrd.envelope.*;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeMaintainSpeed;

/** Max effort envelope = Max speed envelope + acceleration curves + check maintain speed
 * It is the max physical speed at any given point, ignoring allowances */
public class MaxEffortEnvelope {
    public static final class AccelerationMeta extends EnvelopePartMeta {
    }

    public static final class MaintainMeta extends EnvelopePartMeta {
    }

    public static final EnvelopePartMeta ACCELERATION = new AccelerationMeta();
    public static final EnvelopePartMeta MAINTAIN = new MaintainMeta();

    static boolean maxEffortPlateau(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        return prevSpeed == nextSpeed;
    }

    /** Generate acceleration curves overlay everywhere the max speed envelope increase with a discontinuity */
    public static Envelope addAccelerationCurves(PhysicsRollingStock rollingStock,
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
    public static Envelope addMaintainSpeedCurves(PhysicsRollingStock rollingStock,
                                                  PhysicsPath path,
                                                  Envelope maxSpeedProfile) {
        var builder = OverlayEnvelopeBuilder.forward(maxSpeedProfile);
        while (builder.cursor.findPartTransition(MaxEffortEnvelope::maxEffortPlateau)) {
            var partBuilder = builder.startContinuousOverlay(MAINTAIN);
            var startSpeed = partBuilder.getLastSpeed();
            var startPosition = builder.cursor.getPosition();
            EnvelopeMaintainSpeed.maintain(rollingStock, path, 4, startPosition, startSpeed, partBuilder);
            builder.addPart(partBuilder);
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
        //maxEffortEnvelope = addMaintainSpeedCurves(rollingStock, path, maxEffortEnvelope);
        return maxEffortEnvelope;
    }
}
