package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;

public interface CoastingOpportunity {
    /** Returns the location at which coasting shall end */
    double getEndPosition();

    EnvelopePart compute(Envelope base, EnvelopeSimContext context, double v1, double vf);
}