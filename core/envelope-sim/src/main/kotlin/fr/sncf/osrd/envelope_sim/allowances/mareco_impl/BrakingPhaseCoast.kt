package fr.sncf.osrd.envelope_sim.allowances.mareco_impl

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext

class BrakingPhaseCoast(override val endPosition: Double) : CoastingOpportunity {
    override fun compute(
        base: Envelope,
        context: EnvelopeSimContext,
        v1: Double,
        vf: Double,
    ): EnvelopePart? {
        // coast backwards from the last point of braking phases above vf. forbid going below vf,
        // continue until an intersection with the base is found. if vf was reached or no
        // intersection was found until the starting point, coast forwards from the intersection /
        // starting point.
        return CoastingGenerator.coastFromEnd(base, context, endPosition, vf)
    }

    companion object {
        /** Finds all coasting opportunities caused by braking phases */
        fun findAll(envelope: Envelope, v1: Double, vf: Double): ArrayList<BrakingPhaseCoast> {
            val res = ArrayList<BrakingPhaseCoast>()
            for (part in envelope) {
                if (!part.hasAttr(EnvelopeProfile.BRAKING)) continue
                val targetSpeed = part.endSpeed
                // if that LimitAnnounceSpeedController is above v1 that means it will not have an
                // impact here
                if (targetSpeed > v1) continue
                // deceleration phases that are entirely above vf
                if (targetSpeed > vf) {
                    res.add(BrakingPhaseCoast(part.endPos))
                    continue
                }
                // deceleration phases that cross vf
                if (part.maxSpeed > vf) {
                    val endPos = part.interpolatePosition(vf)
                    res.add(BrakingPhaseCoast(endPos))
                }
            }
            return res
        }
    }
}
