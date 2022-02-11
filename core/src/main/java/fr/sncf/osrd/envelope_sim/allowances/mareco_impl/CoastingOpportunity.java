package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock;

public interface CoastingOpportunity {
    /** Returns the location at which coasting shall end */
    double getEndPosition();

    EnvelopePart compute(Envelope base, EnvelopeSimContext context, double v1, double vf);
}