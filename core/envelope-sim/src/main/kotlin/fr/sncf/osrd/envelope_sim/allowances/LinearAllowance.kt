package fr.sncf.osrd.envelope_sim.allowances

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePart.Companion.generateTimes
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.utils.SelfTypeHolder

class LinearAllowance(
    beginPos: Double,
    endPos: Double,
    capacitySpeedLimit: Double,
    ranges: List<AllowanceRange>,
) : AbstractAllowanceWithRanges(beginPos, endPos, capacitySpeedLimit, ranges.toMutableList()) {
    /** Compute the initial low bound for the binary search */
    override fun computeInitialLowBound(envelopeSection: Envelope): Double {
        return capacitySpeedLimit
    }

    /** Compute the initial high bound for the binary search */
    override fun computeInitialHighBound(
        envelopeSection: Envelope,
        rollingStock: PhysicsRollingStock,
    ): Double {
        return envelopeSection.maxSpeed
    }

    /**
     * Compute the core of linear allowance algorithm. This algorithm consists of a ratio that
     * scales speeds
     */
    override fun computeCore(
        base: Envelope,
        context: EnvelopeSimContext,
        speedCap: Double, // Max speed
    ): Envelope {
        val ratio = speedCap / base.maxSpeed
        return scaleEnvelope(base, ratio)
    }

    companion object {
        /** Scale an envelope, new speed = old speed * ratio */
        fun scaleEnvelope(envelope: Envelope, ratio: Double): Envelope {
            val builder = EnvelopeBuilder()
            for (part in envelope) builder.addPart(scalePart(part, ratio))
            return builder.build()
        }

        /** Scale a single part, new speed = old speed * ratio */
        private fun scalePart(part: EnvelopePart, ratio: Double): EnvelopePart {
            val positions = part.getPositions().map { obj: Double -> obj }.toDoubleArray()
            val speeds = part.getSpeeds()
            val scaledSpeeds = speeds.map { it * ratio }.toDoubleArray()
            val attr = part.getAttr(EnvelopeProfile::class.java)
            var attrs = listOf<SelfTypeHolder>()
            if (attr != null) attrs = listOf(attr)
            return generateTimes(attrs, positions, scaledSpeeds)
        }
    }
}
