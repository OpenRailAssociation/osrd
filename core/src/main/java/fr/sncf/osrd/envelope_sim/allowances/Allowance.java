package fr.sncf.osrd.envelope_sim.allowances;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;

public interface Allowance {
    Envelope apply(Envelope base);
}