package fr.sncf.osrd.envelope_sim.allowances.mareco_impl

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeCursor
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortPlateau
import fr.sncf.osrd.envelope_utils.DistanceAverage
import fr.sncf.osrd.utils.arePositionsEqual
import fr.sncf.osrd.utils.areSpeedsEqual
import java.lang.Double.isNaN
import kotlin.math.max
import kotlin.math.min

/** Encodes metadata about an accelerating slope on a plateau */
class AcceleratingSlopeCoast
private constructor(
    /** Position where the train starts accelerating again until it reaches the max speed */
    private val accelerationStartPosition: Double,
    /** The start and end speed limit of the accelerating slope */
    private val speedLimit: Double,
) : CoastingOpportunity {
    /** Position where the coasting envelope should merge back into the base envelope */
    override var endPosition: Double = Double.NaN

    /** Average acceleration of the train during the slope */
    private var slopeAverageAcceleration = Double.NaN

    /**
     * An estimate of the average acceleration of the train from the start of coasting to the
     * beginning of the accelerating slope
     */
    private var previousAccelerationEstimate = Double.NaN

    /** Used to compute the mean acceleration over the accelerating slope */
    private val meanAccelerationBuilder = DistanceAverage()

    /** Finish building the slope instance, once we know the end position */
    private fun build(endPos: Double, context: EnvelopeSimContext): AcceleratingSlopeCoast {
        this.slopeAverageAcceleration = meanAccelerationBuilder.average
        this.previousAccelerationEstimate = estimatePreviousAcceleration(context)
        this.endPosition = endPos
        assert(!isNaN(slopeAverageAcceleration))
        assert(!isNaN(endPos))
        assert(!isNaN(previousAccelerationEstimate))
        assert(!isNaN(speedLimit))
        return this
    }

    /** Estimates the average acceleration during the part where the train decelerates */
    private fun estimatePreviousAcceleration(context: EnvelopeSimContext): Double {
        // We look for the natural acceleration an offset before the start of the slope.
        // The exact offset is arbitrary, we only need an approximation
        // (as long as there is no discontinuity in the binary search).
        // It still needs to be fairly large as the train covers a wide area.
        // We use the train length to make sure the head of the train isn't on the slope.
        val accelerationStart = findExactStartAcceleratingSlope(context)
        val offset = context.rollingStock.length
        val estimatePosition = max(0.0, accelerationStart - offset)
        return min(0.0, getNaturalAcceleration(context, estimatePosition, speedLimit))
    }

    /**
     * Returns the exact position where the natural acceleration sign goes from negative to positive
     */
    private fun findExactStartAcceleratingSlope(context: EnvelopeSimContext): Double {
        // We do this by starting from the first position with a positive acceleration,
        // and we go back until it's negative. We may go back for more than one step if the part
        // started in a slope.

        val positionStep = 10.0 // Because we interpolate, there's no need for a small step
        var position = accelerationStartPosition
        while (
            position > 0 && getNaturalAcceleration(context, position, speedLimit) > 0
        ) position -= positionStep
        if (position <= 0) return 0.0 // The path is on a negative slope from its start

        val accelerationPrevStep = getNaturalAcceleration(context, position, speedLimit)
        val accelerationNextStep =
            getNaturalAcceleration(context, position + positionStep, speedLimit)
        assert(accelerationPrevStep <= 0)
        assert(accelerationNextStep >= 0)
        return interpolateAccelerationSignChange(
            accelerationNextStep,
            accelerationPrevStep,
            position + positionStep,
            position,
        )
    }

    private fun computeV(rollingStock: PhysicsRollingStock, v1: Double, vf: Double): Double {
        // formulas given my MARECO
        // giving the optimized speed v the train should have when entering the accelerating slope
        // this speed v might not be reached if the slope is not long enough, then we just enter the
        // slope with the lowest possible speed that will catch up with target speed at the end
        val wle = rollingStock.getRollingResistance(v1) * v1 * vf / (v1 - vf)
        val accelRatio = previousAccelerationEstimate / slopeAverageAcceleration
        assert(accelRatio <= 0)
        return 1 /
            (1 / speedLimit +
                rollingStock.getRollingResistance(speedLimit) / (wle * (1 - accelRatio)))
    }

    override fun compute(
        base: Envelope,
        context: EnvelopeSimContext,
        v1: Double,
        vf: Double,
    ): EnvelopePart? {
        // for constant speed limit accelerating slopes, compute the minimum speed v for this
        // coasting opportunity, coast backwards from the end of accelerating slope, limiting the
        // minimum speed to v. Then coasting forward from the point reached by the backward coasting
        // TODO: it turns out that v depends on the average acceleration of the deceleration part of
        // the coasting result. it should be probably be iteratively computed.

        val v = computeV(context.rollingStock, v1, vf)
        val minCoastingSpeed = max(v, vf) // We don't want to coast below vf nor v
        return CoastingGenerator.coastFromEnd(base, context, endPosition, minCoastingSpeed)
    }

    companion object {
        // TODO: rewrite as a method of the physics path
        /** Finds all the opportunities for coasting on accelerating slopes */
        fun findAll(
            envelope: Envelope,
            context: EnvelopeSimContext,
            vf: Double,
        ): ArrayList<AcceleratingSlopeCoast> {
            val res = ArrayList<AcceleratingSlopeCoast>()
            val cursor = EnvelopeCursor.forward(envelope)
            // scan until maintain speed envelope parts
            while (cursor.findPart(::maxEffortPlateau)) {
                // constant parameters on this plateau
                val speed = cursor.stepBeginSpeed
                // no coasting will be triggered if the speed is below vf
                if (speed <= vf) {
                    cursor.nextPart()
                    continue
                }

                var previousPosition = Double.NaN
                var previousAcceleration = Double.NaN
                var currentAcceleratingSlope: AcceleratingSlopeCoast? = null

                // constant variables for this plateau
                val envelopePart = cursor.part
                val positionStep = context.timeStep * speed

                while (!cursor.hasReachedEnd() && cursor.position <= envelopePart.endPos) {
                    val position = cursor.position
                    val naturalAcceleration = getNaturalAcceleration(context, position, speed)
                    if (naturalAcceleration > 0) {
                        // Accelerating slope
                        if (currentAcceleratingSlope == null)
                            currentAcceleratingSlope = AcceleratingSlopeCoast(position, speed)
                        currentAcceleratingSlope.meanAccelerationBuilder.addSegment(
                            positionStep,
                            naturalAcceleration,
                        )
                    } else if (currentAcceleratingSlope != null) {
                        // end the accelerating slope
                        val endPos =
                            interpolateAccelerationSignChange(
                                naturalAcceleration,
                                previousAcceleration,
                                position,
                                previousPosition,
                            )
                        res.add(currentAcceleratingSlope.build(endPos, context))
                        currentAcceleratingSlope = null // reset the accelerating slope
                    }
                    previousAcceleration = naturalAcceleration
                    previousPosition = position
                    cursor.findPosition(position + positionStep)
                }
                // if the end of the plateau is an accelerating slope
                if (currentAcceleratingSlope != null)
                    res.add(currentAcceleratingSlope.build(previousPosition, context))
            }
            return res
        }

        /** Returns acceleration at the given position if the train coasts */
        private fun getNaturalAcceleration(
            context: EnvelopeSimContext,
            position: Double,
            speed: Double,
        ): Double {
            return TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, 1.0)
                .acceleration
        }

        /** Interpolate the exact position where the natural acceleration is 0 */
        private fun interpolateAccelerationSignChange(
            currentAcceleration: Double,
            previousAcceleration: Double,
            currentPosition: Double,
            previousPosition: Double,
        ): Double {
            assert(!isNaN(previousAcceleration))
            if (arePositionsEqual(currentPosition, previousPosition)) return currentPosition
            if (areSpeedsEqual(currentAcceleration, previousAcceleration)) return currentPosition
            val factor =
                (previousAcceleration - currentAcceleration) / (previousPosition - currentPosition)
            val y0 = previousAcceleration - factor * previousPosition
            val res = -y0 / factor
            assert(res in previousPosition..currentPosition)
            return res
        }
    }
}
