package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope_sim.etcs.BrakingType
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.train_sim.ClosedRangeF64
import fr.sncf.osrd.train_sim.Direction
import fr.sncf.osrd.train_sim.IntegrationStep
import fr.sncf.osrd.train_sim.RollingStock
import fr.sncf.osrd.train_sim.TractiveEffortCurveMap
import fr.sncf.osrd.train_sim.TractiveEffortPoint
import fr.sncf.osrd.train_sim.TrainPath
import kotlin.math.*

/** Wrapper around a `PhysicsRollingSock` that implements rust-side's `RollingSock` */
class MyFirstRollingStock(val p: PhysicsRollingStock) : RollingStock {
    override fun mass(): Double = this.p.mass

    override fun inertia(): Double = this.p.inertia

    override fun length(): Double = this.p.length

    override fun maxSpeed(): Double = this.p.maxSpeed

    override fun rollingResistance(speed: Double): Double = this.p.getRollingResistance(speed)

    override fun rollingResistanceDeriv(speed: Double): Double =
        this.p.getRollingResistanceDeriv(speed)

    override fun deceleration(): Double = this.p.deceleration
}

/** Wrapper around a `PhysicsPath` that implements rust-side's `TrainPath` */
class MyFirstPath(val p: PhysicsPath) : TrainPath {
    override fun length(): Double = this.p.length

    override fun avgGrade(start: Double, end: Double): Double = this.p.getAverageGrade(start, end)

    override fun minGrade(start: Double, end: Double): Double = this.p.getMinGrade(start, end)
}

/**
 * A utility class to help simulate the train, using numerical integration. It's used when
 * simulating the train, and it is passed to speed controllers so they can take decisions about what
 * action to make. Once speed controllers took a decision, this same class is used to compute the
 * next position and speed of the train.
 */
class TrainPhysicsIntegrator {
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
            val tecm = TractiveEffortCurveMap()
            for (x in context.tractiveEffortCurveMap.asMapOfRanges()) {
                val range =
                    ClosedRangeF64(
                        start = if (x.key.hasLowerBound()) x.key.lowerEndpoint() else null,
                        end = if (x.key.hasUpperBound()) x.key.upperEndpoint() else null,
                    )
                // TODO use custom types?
                // https://mozilla.github.io/uniffi-rs/latest/kotlin/configuration.html
                val value =
                    List(size = x.value.size) {
                        TractiveEffortPoint(
                            speed = x.value[it].speed,
                            maxEffort = x.value[it].maxEffort,
                        )
                    }
                tecm.insert(range, value)
            }
            return fr.sncf.osrd.train_sim.step(
                rollingStock = MyFirstRollingStock(context.rollingStock),
                path = MyFirstPath(context.path),
                timeDelta = context.timeStep,
                tractiveEffortCurveMap = tecm,
                initialPosition = initialLocation,
                initialSpeed = initialSpeed,
                action =
                    when (action) {
                        Action.ACCELERATE -> fr.sncf.osrd.train_sim.Action.ACCELERATE
                        Action.BRAKE -> fr.sncf.osrd.train_sim.Action.BRAKE
                        Action.MAINTAIN -> fr.sncf.osrd.train_sim.Action.MAINTAIN
                        Action.COAST -> fr.sncf.osrd.train_sim.Action.COAST
                    },
                direction = if (directionSign >= 0.0) Direction.FORWARDS else Direction.BACKWARDS,
                brakingType =
                    when (brakingType) {
                        BrakingType.CONSTANT -> fr.sncf.osrd.train_sim.BrakingType.CONSTANT
                        BrakingType.EBD -> fr.sncf.osrd.train_sim.BrakingType.EBD
                        BrakingType.EBI -> fr.sncf.osrd.train_sim.BrakingType.EBI
                        BrakingType.SBD -> fr.sncf.osrd.train_sim.BrakingType.SBD
                        BrakingType.SBI_1 -> fr.sncf.osrd.train_sim.BrakingType.SBI1
                        BrakingType.SBI_2 -> fr.sncf.osrd.train_sim.BrakingType.SBI2
                        BrakingType.GUI -> fr.sncf.osrd.train_sim.BrakingType.GUIDANCE
                        BrakingType.PRE_PS -> fr.sncf.osrd.train_sim.BrakingType.PRE_PS
                        BrakingType.PS -> fr.sncf.osrd.train_sim.BrakingType.PS
                        BrakingType.IND -> fr.sncf.osrd.train_sim.BrakingType.INDICATION
                    },
            )
        }

        /** Compute the weight force of a rolling stock at a given position on a given path */
        fun getWeightForce(rollingStock: PhysicsRollingStock, grade: Double): Double {
            // get an angle from a m/km elevation difference
            // the curve's radius is taken into account in meanTrainGrade
            val angle = atan(grade / 1000.0) // from m/km to m/m
            return -rollingStock.getMass() * GRAVITY_ACCELERATION * sin(angle)
        }

        /** Compute the min grade of a rolling stock at a given position on a given path in m/km */
        fun getMinGrade(
            rollingStock: PhysicsRollingStock,
            path: PhysicsPath,
            headPosition: Double,
        ): Double {
            var headPosition = headPosition
            val tailPosition = min(max(0.0, headPosition - rollingStock.getLength()), path.length)
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
                // force, the rolling resistance and braking force don't apply and the speed stays
                // at 0, unless we integrate backwards, then we need the speed to increase
                val totalOtherForce = tractionForce + weightForce
                if (abs(totalOtherForce) < rollingResistance) return 0.0
            }

            // as the oppositeForces are reaction forces, they need to be adjusted to be opposed to
            // the other forces
            return if (currentSpeed >= 0.0) {
                // if the train is moving forward or still, the opposite forces are negative
                (tractionForce + weightForce - rollingResistance) / rollingStock.getInertia()
            } else {
                // if the train is moving backwards, the opposite forces are positive
                (tractionForce + weightForce + rollingResistance) / rollingStock.getInertia()
            }
        }
    }
}
