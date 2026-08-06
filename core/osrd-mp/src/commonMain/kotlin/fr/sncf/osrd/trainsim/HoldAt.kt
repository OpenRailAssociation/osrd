package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext

/**
 * Keeps the train waiting at [position].
 *
 * Useful when waiting for an intersection to be free for example
 */
class HoldAt(val position: PreciseDistance) : SpeedConstraint {
    private var holdCurve: Curve? = null

    override fun speedCurves(context: EnvelopeSimContext, currentState: TrainState): List<Curve> {
        if (holdCurve == null) {
            holdCurve =
                decelerationCurve(context, position, 0.micrometersPerSecond) +
                        Vec2(Long.MAX_VALUE, 0)
        }

        // SAFETY: holdCurve is never null in this code path
        return listOf(holdCurve!!)
    }

    override fun toString(): String = "HoldAt(position=$position)"
}
