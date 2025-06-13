package fr.sncf.osrd.envelope_sim.allowances.mareco_impl

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext

interface CoastingOpportunity {
    /** Returns the location at which coasting shall end */
    val endPosition: Double

    fun compute(base: Envelope, context: EnvelopeSimContext, v1: Double, vf: Double): EnvelopePart?
}
