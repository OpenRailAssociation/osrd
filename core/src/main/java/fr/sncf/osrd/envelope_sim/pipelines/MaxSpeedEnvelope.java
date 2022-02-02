package fr.sncf.osrd.envelope_sim.pipelines;

import com.carrotsearch.hppc.DoubleArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.EnvelopePartMeta;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainStop;
import java.util.ArrayList;

/** Max speed envelope = MRSP + braking curves
 * It is the max speed allowed at any given point, ignoring allowances
 */
public class MaxSpeedEnvelope {

    public static final class DecelerationMeta extends EnvelopePartMeta {}

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
    private static Envelope addBrakingCurves(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            Envelope mrsp,
            double timeStep
    ) {
        var builder = OverlayEnvelopeBuilder.backward(mrsp);
        while (builder.cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var partBuilder = builder.startContinuousOverlay(DECELERATION);
            var startSpeed = partBuilder.getLastSpeed();
            var startPosition = builder.cursor.getPosition();
            // TODO: link directionSign to cursor boolean reverse
            EnvelopeDeceleration.decelerate(rollingStock, path, timeStep, startPosition, startSpeed, partBuilder, -1);
            builder.addPart(partBuilder);
        }
        return builder.build();
    }

    /** Generate braking curves overlay at every stop position */
    private static Envelope addStopBrakingCurves(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double[] stopPositions,
            Envelope curveWithDecelerations,
            double timeStep
    ) {
        for (int i = 0; i < stopPositions.length; i++) {
            var stopPosition = stopPositions[i];
            // if the stopPosition is zero, no need to build a deceleration curve
            if (stopPosition == 0.0)
                continue;
            var builder = OverlayEnvelopeBuilder.backward(curveWithDecelerations);
            builder.cursor.findPosition(stopPosition);
            var partBuilder = builder.startDiscontinuousOverlay(new StopMeta(i), 0);
            EnvelopeDeceleration.decelerate(rollingStock, path, timeStep, stopPosition, 0, partBuilder, -1);
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
            Envelope mrsp,
            double timeStep
    ) {
        var maxSpeedEnvelope = addBrakingCurves(rollingStock, path, mrsp, timeStep);
        maxSpeedEnvelope = addStopBrakingCurves(rollingStock, path, stopPositions, maxSpeedEnvelope, timeStep);
        return maxSpeedEnvelope;
    }

    /** Generate a max speed envelope given a mrsp */
    public static Envelope from(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            ArrayList<TrainStop> stops,
            Envelope mrsp,
            double timeStep
    ) {
        var stopPositions = new DoubleArrayList();
        for (var stop : stops) {
            if (stop.stopDuration > 0)
                stopPositions.add(stop.position);
        }
        return from(rollingStock, path, stopPositions.toArray(), mrsp, timeStep);
    }
}
