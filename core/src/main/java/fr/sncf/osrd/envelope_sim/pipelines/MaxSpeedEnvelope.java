package fr.sncf.osrd.envelope_sim.pipelines;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeOverlayBuilder;
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
        var overlayBuilder = EnvelopeOverlayBuilder.backward(mrsp);
        while (overlayBuilder.cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var startSpeed = overlayBuilder.startContinuousOverlay(DECELERATION);
            var startPosition = overlayBuilder.cursor.getPosition();
            EnvelopeDeceleration.decelerate(rollingStock, path, 4, startPosition, startSpeed, overlayBuilder);
            overlayBuilder.cursor.nextPart();

        }
        return overlayBuilder.build();
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
            var overlayBuilder = EnvelopeOverlayBuilder.backward(curveWithDecelerations);
            overlayBuilder.cursor.findPosition(stopPosition);
            overlayBuilder.startDiscontinuousOverlay(new StopMeta(i), 0);
            EnvelopeDeceleration.decelerate(rollingStock, path, 4, stopPosition, 0, overlayBuilder);
            curveWithDecelerations = overlayBuilder.build();
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
