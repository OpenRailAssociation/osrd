package fr.sncf.osrd.envelope_sim.overlays

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer
import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.Companion.step
import fr.sncf.osrd.envelope_sim.etcs.BrakingType

object EnvelopeDeceleration {
    /** Generate a deceleration curve overlay */
    @JvmOverloads
    fun decelerate(
        context: EnvelopeSimContext,
        startPosition: Double,
        startSpeed: Double,
        consumer: InteractiveEnvelopePartConsumer,
        direction: Double,
        brakingType: BrakingType = BrakingType.CONSTANT,
    ) {
        consumer.checkConstraints()
        if (!consumer.initEnvelopePart(startPosition, startSpeed, direction)) return
        var position = startPosition
        var speed = startSpeed
        while (true) {
            val step = step(context, position, speed, Action.BRAKE, direction, brakingType)
            position += step.positionDelta
            speed = step.endSpeed
            if (!consumer.addStep(position, speed, step.timeDelta)) break
        }
    }
}
