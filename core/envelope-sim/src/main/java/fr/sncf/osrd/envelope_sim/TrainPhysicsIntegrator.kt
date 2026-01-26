package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope_sim.IntegrationStep.Companion.fromNaiveStep
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.TractiveEffortPoint
import fr.sncf.osrd.envelope_sim.etcs.BrakingType
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.POSITION_EPSILON
import fr.sncf.osrd.utils.SPEED_EPSILON
import fr.sncf.osrd.utils.units.meters
import kotlin.math.*

/**
 * A utility class to help simulate the train, using numerical integration. It's used when
 * simulating the train, and it is passed to speed controllers so they can take decisions about what
 * action to make. Once speed controllers took a decision, this same class is used to compute the
 * next position and speed of the train.
 */
class TrainPhysicsIntegrator
private constructor(
    private val rollingStock: PhysicsRollingStock,
    private val path: PhysicsPath,
    private val action: Action,
    private val directionSign: Double,
    private val tractiveEffortCurveMap: DistanceRangeMap<Array<TractiveEffortPoint>>,
    private val brakingType: BrakingType,
) {
    /** Simulates train movement */
    private fun step(
        timeStep: Double,
        initialLocation: Double,
        initialSpeed: Double,
        directionSign: Double,
    ): IntegrationStep {
        val halfStep = timeStep / 2
        val step1 = step(halfStep, initialLocation, initialSpeed)
        val step2 = step(halfStep, initialLocation + step1.positionDelta, step1.endSpeed)
        val step3 = step(timeStep, initialLocation + step2.positionDelta, step2.endSpeed)
        val step4 = step(timeStep, initialLocation + step3.positionDelta, step3.endSpeed)

        val meanAcceleration =
            (step1.acceleration +
                2 * step2.acceleration +
                2 * step3.acceleration +
                step4.acceleration) / 6.0
        return newtonStep(timeStep, initialSpeed, meanAcceleration, directionSign)
    }

    private fun step(timeStep: Double, position: Double, speed: Double): IntegrationStep {
        if (action == Action.BRAKE) {
            return newtonStep(timeStep, speed, getDeceleration(speed, position), directionSign)
        }

        var tractionForce = 0.0
        val tractiveEffortCurve =
            tractiveEffortCurveMap.get(position.coerceIn(0.0, path.length).meters)!!
        val maxTractionForce = PhysicsRollingStock.getMaxEffort(speed, tractiveEffortCurve)
        val rollingResistance = rollingStock.getRollingResistance(speed)
        val averageGrade: Double = getAverageGrade(rollingStock, path, position)
        val weightForce: Double = getWeightForce(rollingStock, averageGrade)

        if (action == Action.MAINTAIN) {
            tractionForce = rollingResistance - weightForce
            if (tractionForce <= maxTractionForce) {
                return newtonStep(timeStep, speed, 0.0, directionSign)
            } else {
                tractionForce = maxTractionForce
            }
        }

        if (action == Action.ACCELERATE) tractionForce = maxTractionForce
        val acceleration: Double =
            computeAcceleration(
                rollingStock,
                rollingResistance,
                weightForce,
                speed,
                tractionForce,
                directionSign,
            )
        return newtonStep(timeStep, speed, acceleration, directionSign)
    }

    private fun getDeceleration(speed: Double, position: Double): Double {
        assert(action == Action.BRAKE)
        if (brakingType == BrakingType.CONSTANT) return rollingStock.deceleration

        val grade: Double = getMinGrade(rollingStock, path, position)
        val gradientAcceleration = PhysicsRollingStock.getGradientAcceleration(grade)
        return when (brakingType) {
            BrakingType.EBD ->
                -rollingStock.etcsBrakeParams.getSafeBrakingAcceleration(speed) +
                    gradientAcceleration

            BrakingType.SBD ->
                -rollingStock.etcsBrakeParams.getServiceBrakingAcceleration(speed) +
                    gradientAcceleration

            BrakingType.GUI ->
                (-rollingStock.etcsBrakeParams.getNormalServiceBrakingAcceleration(speed) +
                    gradientAcceleration +
                    rollingStock.etcsBrakeParams.getGradientAccelerationCorrection(grade, speed))

            else -> throw UnsupportedOperationException("Braking type not supported: $brakingType")
        }
    }

    // TODO move these static items out of the class
    companion object {
        // Gravity acceleration, in m/s²
        const val GRAVITY_ACCELERATION: Double = 9.81

        /** Simulates train movement */
        @JvmStatic
        @JvmOverloads
        fun step(
            context: EnvelopeSimContext,
            initialLocation: Double,
            initialSpeed: Double,
            action: Action,
            directionSign: Double,
            brakingType: BrakingType = BrakingType.CONSTANT,
        ): IntegrationStep {
            val integrator =
                TrainPhysicsIntegrator(
                    context.rollingStock,
                    context.path,
                    action,
                    directionSign,
                    context.tractiveEffortCurveMap,
                    brakingType,
                )
            return integrator.step(context.timeStep, initialLocation, initialSpeed, directionSign)
        }

        /**
         * Compute the average grade of a rolling stock at a given position on a given path in m/km
         */
        fun getAverageGrade(
            rollingStock: PhysicsRollingStock,
            path: PhysicsPath,
            headPosition: Double,
        ): Double {
            var headPosition = headPosition
            val tailPosition = min(max(0.0, headPosition - rollingStock.length), path.length)
            headPosition = min(max(0.0, headPosition), path.length)
            return path.getAverageGrade(tailPosition, headPosition)
        }

        /** Compute the weight force of a rolling stock at a given position on a given path */
        fun getWeightForce(rollingStock: PhysicsRollingStock, grade: Double): Double {
            // get an angle from a m/km elevation difference
            // the curve's radius is taken into account in meanTrainGrade
            val angle = atan(grade / 1000.0) // from m/km to m/m
            return -rollingStock.mass * GRAVITY_ACCELERATION * sin(angle)
        }

        /** Compute the min grade of a rolling stock at a given position on a given path in m/km */
        fun getMinGrade(
            rollingStock: PhysicsRollingStock,
            path: PhysicsPath,
            headPosition: Double,
        ): Double {
            var headPosition = headPosition
            val tailPosition = min(max(0.0, headPosition - rollingStock.length), path.length)
            headPosition = min(max(0.0, headPosition), path.length)
            return path.getMinGrade(tailPosition, headPosition)
        }

        /**
         * Compute the acceleration given a rolling stock, different forces, a speed, and a
         * direction
         */
        fun computeAcceleration(
            rollingStock: PhysicsRollingStock,
            rollingResistance: Double,
            weightForce: Double,
            currentSpeed: Double,
            tractionForce: Double,
            directionSign: Double,
        ): Double {
            assert(tractionForce >= 0.0)

            if (currentSpeed == 0.0 && directionSign > 0) {
                // If we are stopped and if the forces are not enough to compensate the opposite
                // force,
                // the rolling resistance and braking force don't apply and the speed stays at 0
                // Unless we integrate backwards, then we need the speed to increase
                val totalOtherForce = tractionForce + weightForce
                if (abs(totalOtherForce) < rollingResistance) return 0.0
            }

            // as the oppositeForces are reaction forces, they need to be adjusted to be opposed to
            // the
            // other forces
            return if (currentSpeed >= 0.0) {
                // if the train is moving forward or still, the opposite forces are negative
                (tractionForce + weightForce - rollingResistance) / rollingStock.inertia
            } else {
                // if the train is moving backwards, the opposite forces are positive
                (tractionForce + weightForce + rollingResistance) / rollingStock.inertia
            }
        }

        /** Integrate the Newton movement equations */
        fun newtonStep(
            timeStep: Double,
            currentSpeed: Double,
            acceleration: Double,
            directionSign: Double,
        ): IntegrationStep {
            val signedTimeStep = timeStep.withSign(directionSign)
            var newSpeed = currentSpeed + acceleration * signedTimeStep
            if (abs(newSpeed) < SPEED_EPSILON) newSpeed = 0.0

            // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
            var positionDelta =
                currentSpeed * signedTimeStep + 0.5 * acceleration * signedTimeStep * signedTimeStep

            if (abs(positionDelta) < POSITION_EPSILON) positionDelta = 0.0
            return fromNaiveStep(
                timeStep,
                positionDelta,
                currentSpeed,
                newSpeed,
                acceleration,
                directionSign,
            )
        }
    }
}
