package fr.sncf.osrd.envelope_sim.allowances;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;

public interface Allowance {
    Envelope apply(Envelope base, EnvelopeSimContext context);
}
