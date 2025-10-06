package fr.sncf.osrd.envelope_sim.overlays

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer
import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.Companion.step

object EnvelopeMaintain {
    /** Maintain the speed, storing the resulting steps into consumer */
    fun maintain(
        context: EnvelopeSimContext,
        startPosition: Double,
        startSpeed: Double,
        consumer: InteractiveEnvelopePartConsumer,
        direction: Double,
    ) {
        consumer.checkConstraints()
        if (!consumer.initEnvelopePart(startPosition, startSpeed, direction)) return
        var position = startPosition
        var speed = startSpeed
        while (true) {
            var action = Action.MAINTAIN
            if (speed < startSpeed) action = Action.ACCELERATE
            val step = step(context, position, speed, action, direction)
            position += step.positionDelta
            speed = step.endSpeed
            if (!consumer.addStep(position, speed, step.timeDelta)) break
        }
    }
}
