package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.utils.DoubleUtils;

public class EnvelopePhysics {
    /** Compute the constant acceleration between two space / speed points. */
    public static double stepAcceleration(
            double lastPos, double nextPos,
            double lastSpeed, double nextSpeed
    ) {
        var positionDelta = nextPos - lastPos;
        if (positionDelta == 0.0) {
            assert lastSpeed == nextSpeed;
            return 0;
        }
        return (nextSpeed * nextSpeed - lastSpeed * lastSpeed) / 2 / positionDelta;
    }

    /** Given a constant acceleration, a last known speed and a position offset, compute the new speed */
    public static double interpolateStepSpeed(double acceleration, double lastSpeed, double positionDelta) {
        return Math.sqrt(lastSpeed * lastSpeed + 2 * acceleration * positionDelta);
    }

    /** Compute the speed at offset positionDelta inside a given step */
    public static double interpolateStepSpeed(
            double lastPos, double nextPos,
            double lastSpeed, double nextSpeed,
            double positionDelta
    ) {
        var acceleration = stepAcceleration(lastPos, nextPos, lastSpeed, nextSpeed);
        return interpolateStepSpeed(acceleration, lastSpeed, positionDelta);
    }

    /** Compute the time required to go from lastPos to lastPos + positionDelta inside the given range */
    public static double interpolateStepTime(
            double lastPos, double nextPos,
            double lastSpeed, double nextSpeed,
            double positionDelta
    ) {
        var acceleration = stepAcceleration(lastPos, nextPos, lastSpeed, nextSpeed);
        if (acceleration == 0.0)
            return Math.abs(positionDelta / lastSpeed);
        var interpolatedSpeed = interpolateStepSpeed(acceleration, lastSpeed, positionDelta);
        return Math.abs((interpolatedSpeed - lastSpeed) / acceleration);
    }

    /** Compute the time required to go from lastPos to nextPos */
    public static double interpolateStepTime(
            double lastPos, double nextPos,
            double lastSpeed, double nextSpeed
    ) {
        var positionDelta = nextPos - lastPos;
        var acceleration = stepAcceleration(lastPos, nextPos, lastSpeed, nextSpeed);
        if (acceleration == 0.0)
            return Math.abs(positionDelta / lastSpeed);
        return Math.abs((nextSpeed - lastSpeed) / acceleration);
    }

    /** a and b are two 1D segments, and val is clamped to their intersections */
    private static double clamp1D(double val, double a1, double a2, double b1, double b2) {
        var minA = Math.min(a1, a2);
        var minB = Math.min(b1, b2);
        var maxA = Math.max(a1, a2);
        var maxB = Math.max(b1, b2);
        return DoubleUtils.clamp(val, Math.max(minA, minB), Math.min(maxA, maxB));
    }

    /** Clamps a point to the intersection coordinate range of two 2D segments */
    private static void clamp2DPoint(
            EnvelopePoint point, double a1Pos, double a1Speed, double a2Pos, double a2Speed,
            double b1Pos, double b1Speed, double b2Pos, double b2Speed
    ) {
        point.position = clamp1D(point.position, a1Pos, a2Pos, b1Pos, b2Pos);
        point.speed = clamp1D(point.speed, a1Speed, a2Speed, b1Speed, b2Speed);
    }

    /**
     * Computes the intersection of two envelope steps.
     * The acceleration is assumed to be constant over <b>time</b> inside a step.
     * Interpolation thus needs to be done on a parabola, as envelopes are over <b>space</b>.
     * The intersection is guaranteed to be within the bounds of both segments.
     */
    public static EnvelopePoint intersectSteps(EnvelopePart a, int stepIndexA, EnvelopePart b, int stepIndexB) {
        return intersectSteps(
                a.getBeginPos(stepIndexA), a.getBeginSpeed(stepIndexA),
                a.getEndPos(stepIndexA), a.getEndSpeed(stepIndexA),
                b.getBeginPos(stepIndexB), b.getBeginSpeed(stepIndexB),
                b.getEndPos(stepIndexB), b.getEndSpeed(stepIndexB)
        );
    }

    /** @see #intersectSteps(EnvelopePart, int, EnvelopePart, int) */
    public static EnvelopePoint intersectSteps(EnvelopePart a, EnvelopePart b, double position) {
        var stepIndexA = a.findLeft(position);
        var stepIndexB = b.findLeft(position);
        return intersectSteps(a, stepIndexA, b, stepIndexB);
    }

    /** @see #intersectSteps(EnvelopePart, int, EnvelopePart, int) */
    public static EnvelopePoint intersectSteps(
            double a1Pos, double a1Speed, double a2Pos, double a2Speed,
            double b1Pos, double b1Speed, double b2Pos, double b2Speed
    ) {
        // allocating the result value here instead of in multiple places
        // enables openjdk to optimize the allocation away. as of the writing of this comment,
        // openjdk can only perform scalar replacement when a function is inlined, and has accesses
        // to the function result can be traced back to a single allocation.
        EnvelopePoint point = new EnvelopePoint();
        intersectSteps(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed);
        return point;
    }

    /** @see #intersectSteps(EnvelopePart, int, EnvelopePart, int) */
    public static void intersectSteps(
            EnvelopePoint point, double a1Pos, double a1Speed, double a2Pos, double a2Speed,
            double b1Pos, double b1Speed, double b2Pos, double b2Speed
    ) {
        // find acceleration for the parabolas formula
        double accA = stepAcceleration(a1Pos, a2Pos, a1Speed, a2Speed);
        double accB = stepAcceleration(b1Pos, b2Pos, b1Speed, b2Speed);

        // A is at constant speed
        if (accA == 0) {
            point.position = intersectStepWithSpeed(b1Speed, b1Pos, accB, a1Speed);
            point.speed = a1Speed;
            clamp2DPoint(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed);
            return;
        }

        // B is at constant speed
        if (accB == 0) {
            point.position = intersectStepWithSpeed(a1Speed, a1Pos, accA, b1Speed);
            point.speed = b1Speed;
            clamp2DPoint(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed);
            return;
        }

        // find intersection between parabolas
        var a1SpeedSquare = a1Speed * a1Speed;
        var b1SpeedSquare = b1Speed * b1Speed;
        point.position = (b1SpeedSquare / 2 - a1SpeedSquare / 2 - accB * b1Pos + accA * a1Pos) / (accA - accB);
        // inject the position in the formula of the second parabola.
        // the fact this is injected into the second parabola and not the first is very important,
        // as this functions is typically used to intersect the left parabola into the right one,
        // cutting the left one at just the right point, then interpolating again to cut the right one.
        // doing it this way guarantees we get the same result
        point.speed = interpolateStepSpeed(accB, b1Speed, point.position - b1Pos);
        clamp2DPoint(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed);
    }

    /** Returns the position at which a step intersects a speed */
    public static double intersectStepWithSpeed(double a1Speed, double a1Pos, double accA, double bSpeed) {
        if (a1Speed == bSpeed)
            return a1Pos;
        var res =  (bSpeed * bSpeed - a1Speed * a1Speed + 2 * accA * a1Pos) / 2 / accA;
        assert !Double.isInfinite(res);
        return res;
    }

    /** Returns the position at which a step intersects a speed */
    public static double intersectStepWithSpeed(
            double a1Pos, double a1Speed, double a2Pos, double a2Speed,
            double bSpeed
    ) {
        double accA = stepAcceleration(a1Pos, a2Pos, a1Speed, a2Speed);
        var interpolatedPosition = intersectStepWithSpeed(a1Speed, a1Pos, accA, bSpeed);
        var minPos = Math.min(a1Pos, a2Pos);
        var maxPos = Math.max(a1Pos, a2Pos);
        assert minPos - 0.0001 <= interpolatedPosition && interpolatedPosition <= maxPos + 0.0001;
        if (interpolatedPosition > maxPos)
            interpolatedPosition = maxPos;
        if (interpolatedPosition < minPos)
            interpolatedPosition = minPos;
        return interpolatedPosition;
    }
}
