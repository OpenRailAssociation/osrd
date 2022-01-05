package fr.sncf.osrd.envelope_sim.pipelines;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.EnvelopePartMeta;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;

/** Max speed envelope = MRSP + braking curves
 * It is the max speed allowed at any given point, ignoring allowances
 */
public class MaxSpeedEnvelope {

    public static final class DecelerationMeta extends EnvelopePartMeta {
    }

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class StopMeta extends EnvelopePartMeta {
        public final int stopIndex;

        public StopMeta(int stopIndex) {
            this.stopIndex = stopIndex;
        }
    }

    public static final EnvelopePartMeta DECELERATION = new DecelerationMeta();

    static boolean increase(double prevPos, double prevSpeed, double nextPos, double nextSpeed) {
        // Works for both accelerations (forwards) and decelerations (backwards)
        return prevSpeed < nextSpeed;
    }

    /** Generate braking curves overlay everywhere the mrsp decrease (increase backwards) with a discontinuity */
    public static Envelope addBrakingCurves(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            Envelope mrsp
    ) {
        var builder = OverlayEnvelopeBuilder.backward(mrsp);
        while (builder.cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var partBuilder = builder.startContinuousOverlay(DECELERATION);
            var startSpeed = partBuilder.getLastSpeed();
            var startPosition = builder.cursor.getPosition();
            EnvelopeDeceleration.decelerate(rollingStock, path, 4, startPosition, startSpeed, partBuilder);
            builder.addPart(partBuilder);
            builder.cursor.nextPart();

        }
        return builder.build();
    }

    /** Generate braking curves overlay at every stop position */
    public static Envelope addStopBrakingCurves(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double[] stopPositions,
            Envelope curveWithDecelerations
    ) {
        for (int i = 0; i < stopPositions.length; i++) {
            var stopPosition = stopPositions[i];
            var builder = OverlayEnvelopeBuilder.backward(curveWithDecelerations);
            builder.cursor.findPosition(stopPosition);
            var partBuilder = builder.startDiscontinuousOverlay(new StopMeta(i), 0);
            EnvelopeDeceleration.decelerate(rollingStock, path, 4, stopPosition, 0, partBuilder);
            builder.addPart(partBuilder);
            curveWithDecelerations = builder.build();
        }
        return curveWithDecelerations;
    }

    /** Generate a max speed envelope given a mrsp */
    public static Envelope from(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double[] stopPositions,
            Envelope mrsp
    ) {
        var maxSpeedEnvelope = addBrakingCurves(rollingStock, path, mrsp);
        maxSpeedEnvelope = addStopBrakingCurves(rollingStock, path, stopPositions, maxSpeedEnvelope);
        return maxSpeedEnvelope;
    }
}
