package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope.Envelope.Companion.make
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.CoastingGenerator.coastFromBeginning
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test

class TrainPhysicsIntegratorTest {
    @Test
    fun testSlopeNoTraction() {
        val context = SimpleContextBuilder.makeSimpleContext(100000.0, -40.0, TIME_STEP)
        var position = 0.0
        var speed = 0.0

        // how fast would a train go after 30 sec, coasting on a -40m / km slope?
        for (i in 0..29) {
            val step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, +1.0)
            position += step.positionDelta
            speed = step.endSpeed
        }

        // we expect about +11m/s (the train goes forward)
        Assertions.assertTrue(speed < 11 && speed > 10, speed.toString())
    }

    @Test
    fun testSteepSlopeTraction() {
        val context = SimpleContextBuilder.makeSimpleContext(100000.0, -45.0, TIME_STEP)
        var position = 0.0
        var speed = 0.0

        // how fast would a train go after 10 steps of 1 sec, full throttle on a 45deg slope?
        for (i in 0..9) {
            val step =
                TrainPhysicsIntegrator.step(context, position, speed, Action.ACCELERATE, +1.0)
            position += step.positionDelta
            speed = step.endSpeed
        }
        // we expect the train to go pretty fast
        Assertions.assertTrue(speed > 6 && speed < 10, speed.toString())
    }

    @Test
    fun testSlopeChangeVMax() {
        val context = SimpleContextBuilder.makeSimpleContext(100000.0, 0.0, TIME_STEP)
        var position = 0.0
        var speed = 0.0

        // go to full speed by cruising for 20 minutes
        for (i in 0..<20 * 60) {
            val step =
                TrainPhysicsIntegrator.step(context, position, speed, Action.ACCELERATE, +1.0)
            position += step.positionDelta
            speed = step.endSpeed
        }
        val fullThrottle = speed
        // we expect the train to go pretty fast
        Assertions.assertTrue(speed > 100, speed.toString())

        // continue the simulation, but with some slope
        val newContext = SimpleContextBuilder.makeSimpleContext(100000.0, 35.0, TIME_STEP)
        for (i in 0..<20 * 60) {
            val step =
                TrainPhysicsIntegrator.step(newContext, position, speed, Action.ACCELERATE, +1.0)
            position += step.positionDelta
            speed = step.endSpeed
        }
        // we expect the train to run at less than half the speed, but still decently fast
        Assertions.assertTrue(speed < fullThrottle / 2, speed.toString())
        Assertions.assertTrue(speed > fullThrottle / 3, speed.toString())
    }

    @Test
    fun testAccelerateAndCoast() {
        val testPath = FlatPath(100000.0, 0.0)
        val testRollingStock = SimpleRollingStock.STANDARD_TRAIN
        val effortCurveMap = SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP
        val context = EnvelopeSimContext(testRollingStock, testPath, TIME_STEP, effortCurveMap)
        var position = 0.0
        var speed = 0.0

        // make a huge traction effort
        val rollingResistance = testRollingStock.getRollingResistance(speed)
        val grade = TrainPhysicsIntegrator.getAverageGrade(testRollingStock, testPath, position)
        val weightForce = TrainPhysicsIntegrator.getWeightForce(testRollingStock, grade)
        val acceleration =
            TrainPhysicsIntegrator.computeAcceleration(
                testRollingStock,
                rollingResistance,
                weightForce,
                speed,
                500000.0,
                +1.0,
            )
        var step = TrainPhysicsIntegrator.newtonStep(TIME_STEP, speed, acceleration, +1.0)
        position += step.positionDelta
        speed = step.endSpeed
        Assertions.assertTrue(speed > 0.5)

        // the train should be able to coast for a minute without stopping
        for (i in 0..59) {
            step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, +1.0)
            position += step.positionDelta
            val prevSpeed = step.startSpeed
            speed = step.endSpeed
            Assertions.assertTrue(speed < prevSpeed && speed > 0.0)
        }

        // another minute later
        for (i in 0..59) {
            step = TrainPhysicsIntegrator.step(context, position, speed, Action.COAST, +1.0)
            position += step.positionDelta
            speed = step.endSpeed
        }
        // it should be stopped
        Assertions.assertEquals(speed, 0.0)
    }

    @Test
    fun testEmptyCoastFromBeginning() {
        val context = SimpleContextBuilder.makeSimpleContext(100000.0, 0.0, TIME_STEP)
        val builder = EnvelopePartBuilder()
        val constrainedBuilder =
            ConstrainedEnvelopePartBuilder(
                builder,
                SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                PositionConstraint(0.0, 10_000.0),
            )
        EnvelopeDeceleration.decelerate(context, 0.0, 10.0, constrainedBuilder, 1.0)
        builder.setAttr(EnvelopeProfile.BRAKING)
        val acceleration = make(builder.build())
        // starting a coasting phase in a braking phase must result in a null EnvelopePart
        val speed = acceleration.interpolateSpeed(0.0)
        val failedCoast = coastFromBeginning(acceleration, context, 0.0, speed)
        Assertions.assertNull(failedCoast)
    }

    companion object {
        private const val TIME_STEP = 1.0
    }
}
