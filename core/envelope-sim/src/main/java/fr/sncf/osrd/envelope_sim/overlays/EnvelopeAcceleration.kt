package fr.sncf.osrd.envelope_sim.overlays

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer
import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.Companion.step

object EnvelopeAcceleration {
    /** Accelerate, storing the resulting steps into consumer  */
    fun accelerate(
        context: EnvelopeSimContext,
        startPosition: Double,
        startSpeed: Double,
        consumer: InteractiveEnvelopePartConsumer,
        direction: Double
    ) {
        consumer.checkConstraints()
        if (!consumer.initEnvelopePart(startPosition, startSpeed, direction)) return
        var position = startPosition
        var speed = startSpeed
        while (true) {
            val step = step(context, position, speed, Action.ACCELERATE, direction)
            position += step.positionDelta
            speed = step.endSpeed
            if (!consumer.addStep(position, speed, step.timeDelta)) break
            assert(step.positionDelta != 0.0)
        }
    }
}
