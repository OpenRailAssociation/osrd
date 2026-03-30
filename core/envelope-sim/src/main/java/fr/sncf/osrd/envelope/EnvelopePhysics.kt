package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_utils.DoubleUtils
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.areAccelerationsEqual
import fr.sncf.osrd.utils.units.meters
import kotlin.assert
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

object EnvelopePhysics {
    /** Compute the constant acceleration between two space / speed points. */
    fun stepAcceleration(
        lastPos: Double,
        nextPos: Double,
        lastSpeed: Double,
        nextSpeed: Double,
    ): Double {
        val positionDelta = nextPos - lastPos
        if (positionDelta == 0.0) {
            assert(lastSpeed == nextSpeed)
            return 0.0
        }
        return (nextSpeed * nextSpeed - lastSpeed * lastSpeed) / 2 / positionDelta
    }

    /**
     * Given a constant acceleration, a last known speed and a position offset, compute the new
     * speed
     */
    fun interpolateStepSpeed(
        acceleration: Double,
        lastSpeed: Double,
        positionDelta: Double,
    ): Double {
        return sqrt(max(0.0, lastSpeed * lastSpeed + 2 * acceleration * positionDelta))
    }

    /** Compute the speed at offset positionDelta inside a given step */
    @JvmStatic
    fun interpolateStepSpeed(
        lastPos: Double,
        nextPos: Double,
        lastSpeed: Double,
        nextSpeed: Double,
        positionDelta: Double,
    ): Double {
        val acceleration = stepAcceleration(lastPos, nextPos, lastSpeed, nextSpeed)
        return interpolateStepSpeed(acceleration, lastSpeed, positionDelta)
    }

    /**
     * Compute the time required to go from lastPos to lastPos + positionDelta inside the given
     * range
     */
    fun interpolateStepTime(
        lastPos: Double,
        nextPos: Double,
        lastSpeed: Double,
        nextSpeed: Double,
        positionDelta: Double,
    ): Double {
        val acceleration = stepAcceleration(lastPos, nextPos, lastSpeed, nextSpeed)
        if (areAccelerationsEqual(acceleration, 0.0)) {
            val averageSpeed = (lastSpeed + nextSpeed) / 2
            return abs(positionDelta / averageSpeed)
        }
        val interpolatedSpeed = interpolateStepSpeed(acceleration, lastSpeed, positionDelta)
        return abs((interpolatedSpeed - lastSpeed) / acceleration)
    }

    /** Compute the time required to go from lastPos to nextPos */
    @JvmStatic
    fun interpolateStepTime(
        lastPos: Double,
        nextPos: Double,
        lastSpeed: Double,
        nextSpeed: Double,
    ): Double {
        val positionDelta = nextPos - lastPos
        val acceleration = stepAcceleration(lastPos, nextPos, lastSpeed, nextSpeed)
        if (acceleration == 0.0) return abs(positionDelta / lastSpeed)
        return abs((nextSpeed - lastSpeed) / acceleration)
    }

    /** a and b are two 1D segments, and val is clamped to their intersections */
    private fun clamp1D(`val`: Double, a1: Double, a2: Double, b1: Double, b2: Double): Double {
        val minA = min(a1, a2)
        val minB = min(b1, b2)
        val maxA = max(a1, a2)
        val maxB = max(b1, b2)
        return DoubleUtils.clamp(`val`, max(minA, minB), min(maxA, maxB))
    }

    /** Clamps a point to the intersection coordinate range of two 2D segments */
    private fun clamp2DPoint(
        point: EnvelopePoint,
        a1Pos: Double,
        a1Speed: Double,
        a2Pos: Double,
        a2Speed: Double,
        b1Pos: Double,
        b1Speed: Double,
        b2Pos: Double,
        b2Speed: Double,
    ) {
        point.position = clamp1D(point.position, a1Pos, a2Pos, b1Pos, b2Pos)
        point.speed = clamp1D(point.speed, a1Speed, a2Speed, b1Speed, b2Speed)
    }

    /**
     * Computes the intersection of two envelope steps. The acceleration is assumed to be constant
     * over **time** inside a step. Interpolation thus needs to be done on a parabola, as envelopes
     * are over **space**. The intersection is guaranteed to be within the bounds of both segments.
     */
    fun intersectSteps(
        a: EnvelopePart,
        stepIndexA: Int,
        b: EnvelopePart,
        stepIndexB: Int,
    ): EnvelopePoint {
        return intersectSteps(
            a.getBeginPos(stepIndexA),
            a.getBeginSpeed(stepIndexA),
            a.getEndPos(stepIndexA),
            a.getEndSpeed(stepIndexA),
            b.getBeginPos(stepIndexB),
            b.getBeginSpeed(stepIndexB),
            b.getEndPos(stepIndexB),
            b.getEndSpeed(stepIndexB),
        )
    }

    /** @see .intersectSteps */
    fun intersectSteps(a: EnvelopePart, b: EnvelopePart, position: Double): EnvelopePoint {
        val stepIndexA = a.findLeft(position)
        val stepIndexB = b.findLeft(position)
        return intersectSteps(a, stepIndexA, b, stepIndexB)
    }

    /** @see .intersectSteps */
    @JvmStatic
    fun intersectSteps(
        a1Pos: Double,
        a1Speed: Double,
        a2Pos: Double,
        a2Speed: Double,
        b1Pos: Double,
        b1Speed: Double,
        b2Pos: Double,
        b2Speed: Double,
    ): EnvelopePoint {
        // allocating the result value here instead of in multiple places
        // enables openjdk to optimize the allocation away. as of the writing of this comment,
        // openjdk can only perform scalar replacement when a function is inlined, and has accesses
        // to the function result can be traced back to a single allocation.
        val point = EnvelopePoint()
        intersectSteps(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed)
        return point
    }

    /** @see .intersectSteps */
    fun intersectSteps(
        point: EnvelopePoint,
        a1Pos: Double,
        a1Speed: Double,
        a2Pos: Double,
        a2Speed: Double,
        b1Pos: Double,
        b1Speed: Double,
        b2Pos: Double,
        b2Speed: Double,
    ) {
        // find acceleration for the parabolas formula
        val accA = stepAcceleration(a1Pos, a2Pos, a1Speed, a2Speed)
        val accB = stepAcceleration(b1Pos, b2Pos, b1Speed, b2Speed)

        // A is at constant speed
        if (accA == 0.0) {
            point.position = intersectStepWithSpeed(b1Speed, b1Pos, accB, a1Speed)
            point.speed = a1Speed
            clamp2DPoint(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed)
            return
        }

        // B is at constant speed
        if (accB == 0.0) {
            point.position = intersectStepWithSpeed(a1Speed, a1Pos, accA, b1Speed)
            point.speed = b1Speed
            clamp2DPoint(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed)
            return
        }

        // find intersection between parabolas
        val a1SpeedSquare = a1Speed * a1Speed
        val b1SpeedSquare = b1Speed * b1Speed
        point.position =
            (b1SpeedSquare / 2 - a1SpeedSquare / 2 - accB * b1Pos + accA * a1Pos) / (accA - accB)
        // inject the position in the formula of the second parabola.
        // the fact this is injected into the second parabola and not the first is very important,
        // as this functions is typically used to intersect the left parabola into the right one,
        // cutting the left one at just the right point, then interpolating again to cut the right
        // one.
        // doing it this way guarantees we get the same result
        point.speed = interpolateStepSpeed(accB, b1Speed, point.position - b1Pos)
        clamp2DPoint(point, a1Pos, a1Speed, a2Pos, a2Speed, b1Pos, b1Speed, b2Pos, b2Speed)
    }

    /** Returns the position at which a step intersects a speed */
    fun intersectStepWithSpeed(
        a1Speed: Double,
        a1Pos: Double,
        accA: Double,
        bSpeed: Double,
    ): Double {
        if (a1Speed == bSpeed) return a1Pos
        val res = (bSpeed * bSpeed - a1Speed * a1Speed + 2 * accA * a1Pos) / 2 / accA
        assert(!res.isInfinite())
        return res
    }

    /** Returns the position at which a step intersects a speed */
    @JvmStatic
    fun intersectStepWithSpeed(
        a1Pos: Double,
        a1Speed: Double,
        a2Pos: Double,
        a2Speed: Double,
        bSpeed: Double,
    ): Double {
        val accA = stepAcceleration(a1Pos, a2Pos, a1Speed, a2Speed)
        var interpolatedPosition = intersectStepWithSpeed(a1Speed, a1Pos, accA, bSpeed)
        val minPos = min(a1Pos, a2Pos)
        val maxPos = max(a1Pos, a2Pos)
        assert(minPos - 0.0001 <= interpolatedPosition && interpolatedPosition <= maxPos + 0.0001)
        if (interpolatedPosition > maxPos) interpolatedPosition = maxPos
        if (interpolatedPosition < minPos) interpolatedPosition = minPos
        return interpolatedPosition
    }

    /**
     * Returns the cumulative energy consumed of the given envelope at the wheels of the train,
     * given a certain path and rolling stock
     */
    fun getMechanicalEnergyConsumed(
        envelope: Envelope,
        path: PhysicsPath,
        rollingStocks: DistanceRangeMap<PhysicsRollingStock>,
    ): Double {
        var cumulativeEnergy = 0.0
        for (i in 0..<envelope.size()) {
            val part = envelope.get(i)
            val averagePos = (part.beginPos + part.endPos) / 2
            val rollingStock = rollingStocks.get(averagePos.meters)!!
            cumulativeEnergy += getPartMechanicalEnergyConsumed(part, path, rollingStock)
        }
        return cumulativeEnergy
    }

    /** Returns the total mechanical energy consumed on a given envelopePart */
    fun getPartMechanicalEnergyConsumed(
        part: EnvelopePart,
        path: PhysicsPath,
        rollingStock: PhysicsRollingStock,
    ): Double {
        // The energy consumed by the train corresponds to the kinetic energy delta, subtracting the
        // work by
        // gravity and drag / friction
        val length = part.pointCount()
        val mass = rollingStock.mass
        val inertia = rollingStock.inertia

        val meanGrade = 0.001 * path.getAverageGrade(part.beginPos, part.endPos)
        val altitudeDelta = meanGrade * part.totalDistance

        val workGravity = -mass * TrainPhysicsIntegrator.GRAVITY_ACCELERATION * altitudeDelta

        val kineticEnergyDelta =
            0.5 * inertia * (part.endSpeed * part.endSpeed - part.beginSpeed * part.beginSpeed)

        var workDrag = 0.0
        for (i in 0..<length - 1) {
            val speed = part.getPointSpeed(i)
            val nextSpeed = part.getPointSpeed(i + 1)
            val meanSpeed = (speed + nextSpeed) / 2
            val pos = part.getPointPos(i)
            val nextPos = part.getPointPos(i + 1)
            val positionDelta = nextPos - pos
            workDrag -= rollingStock.getRollingResistance(meanSpeed) * positionDelta
        }

        val totalEnergyConsumed = kineticEnergyDelta - workGravity - workDrag

        return max(0.0, totalEnergyConsumed)
    }
}
