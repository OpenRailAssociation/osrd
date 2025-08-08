package fr.sncf.osrd.envelope_sim.allowances

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeSpeedCap
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.AcceleratingSlopeCoast.Companion.findAll
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.BrakingPhaseCoast.Companion.findAll
import fr.sncf.osrd.envelope_sim.allowances.mareco_impl.CoastingOpportunity
import fr.sncf.osrd.envelope_sim.pipelines.addAccelerationAndConstantSpeedParts
import fr.sncf.osrd.utils.SelfTypeHolder
import kotlin.math.max

/**
 * Applies the allowance while maximizing the energy saved. The algorithm and formulas are described
 * in the MARECO paper, which can be read [here](https://osrd.fr/pdf/MARECO.pdf)
 */
class MarecoAllowance(
    beginPos: Double,
    endPos: Double,
    capacitySpeedLimit: Double,
    ranges: List<AllowanceRange>,
) : AbstractAllowanceWithRanges(beginPos, endPos, capacitySpeedLimit, ranges.toMutableList()) {
    init {
        assert(capacitySpeedLimit >= 1) {
            "capacity speed limit can't be lower than 1m/s for mareco allowances"
        }
    }

    class MarecoSpeedLimit : SelfTypeHolder {
        override val selfType: Class<out SelfTypeHolder>
            get() = MarecoSpeedLimit::class.java
    }

    /**
     * Given a ceiling speed v1 compute vf, the speed at which the train should end coasting and
     * start braking
     */
    private fun computeVf(v1: Double, rollingStock: PhysicsRollingStock): Double {
        // formulas given by MARECO
        val wle = v1 * v1 * rollingStock.getRollingResistanceDeriv(v1)
        val vf = wle * v1 / (wle + rollingStock.getRollingResistance(v1) * v1)

        // Prevents coasting from starting below capacity speed limit
        return max(vf, capacitySpeedLimit)
    }

    /** Compute the initial low bound for the binary search */
    override fun computeInitialLowBound(envelopeSection: Envelope): Double {
        return capacitySpeedLimit
    }

    /**
     * Compute the initial high bound for the binary search The high bound ensures that the speed vf
     * will be higher than the max speed of the envelope
     */
    override fun computeInitialHighBound(
        envelopeSection: Envelope,
        rollingStock: PhysicsRollingStock,
    ): Double {
        val sectionMaxSpeed = envelopeSection.maxSpeed
        var maxSpeed = sectionMaxSpeed
        var vf = computeVf(maxSpeed, rollingStock)
        while (vf < sectionMaxSpeed) {
            maxSpeed *= 2
            vf = computeVf(maxSpeed, rollingStock)
        }
        return maxSpeed
    }

    /**
     * Compute the core of Mareco algorithm. This algorithm consists of a speed cap at v1 and
     * several coasting opportunities before braking or before accelerating slopes for example.
     */
    override fun computeCore(
        base: Envelope,
        context: EnvelopeSimContext,
        speedCap: Double, // v1
    ): Envelope {
        val vf = computeVf(speedCap, context.rollingStock)

        // 1) cap the core base envelope at v1 and check if v1 is physically reachable
        var cappedEnvelope = EnvelopeSpeedCap.from(base, listOf(MarecoSpeedLimit()), speedCap)
        val initialPosition = cappedEnvelope.beginPos
        val initialSpeed = cappedEnvelope.beginSpeed
        cappedEnvelope =
            addAccelerationAndConstantSpeedParts(
                context,
                cappedEnvelope,
                initialPosition,
                initialSpeed,
            )

        // 2) find accelerating slopes on constant speed limit regions
        val coastingOpportunities = mutableListOf<CoastingOpportunity>()
        coastingOpportunities.addAll(findAll(cappedEnvelope, context, vf))

        // 3) find coasting opportunities related to braking
        coastingOpportunities.addAll(findAll(cappedEnvelope, speedCap, vf))

        // 4) evaluate coasting opportunities in reverse order, thus skipping overlapping ones
        coastingOpportunities.sortBy { it.endPosition }
        coastingOpportunities.reverse()

        val builder = OverlayEnvelopeBuilder.backward(cappedEnvelope)
        var lastCoastBegin = Double.POSITIVE_INFINITY
        for (opportunity in coastingOpportunities) {
            if (lastCoastBegin < opportunity.endPosition) continue
            val overlay = opportunity.compute(cappedEnvelope, context, speedCap, vf) ?: continue
            lastCoastBegin = overlay.beginPos
            builder.addPart(overlay)
        }

        val res = builder.build()
        // check for continuity of the core phase
        assert(res.continuous) { "Discontinuity in MARECO core phase" }
        return res
    }
}
