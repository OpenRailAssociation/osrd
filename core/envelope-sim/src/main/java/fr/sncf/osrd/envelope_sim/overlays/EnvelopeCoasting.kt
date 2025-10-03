package fr.sncf.osrd.envelope_sim.overlays

import fr.sncf.osrd.envelope.part.InteractiveEnvelopePartConsumer
import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.Companion.step

object EnvelopeCoasting {
    /** Generate a coasting curve overlay  */
    fun coast(
        context: EnvelopeSimContext,
        startPosition: Double,
        startSpeed: Double,
        consumer: InteractiveEnvelopePartConsumer,
        directionSign: Double
    ) {
        consumer.checkConstraints()
        if (!consumer.initEnvelopePart(startPosition, startSpeed, directionSign)) return
        var position = startPosition
        var speed = startSpeed
        while (true) {
            val step = step(context, position, speed, Action.COAST, directionSign)
            position += step.positionDelta
            speed = step.endSpeed
            if (!consumer.addStep(position, speed, step.timeDelta)) break
        }
        assert(speed >= 0)
    }
}
