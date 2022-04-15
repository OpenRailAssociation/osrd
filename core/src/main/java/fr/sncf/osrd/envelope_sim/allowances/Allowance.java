package fr.sncf.osrd.envelope_sim.allowances;

import fr.sncf.osrd.envelope.Envelope;

public interface Allowance {
    Envelope apply(Envelope base);

    double getDistance();

    double getAllowanceTime(double baseTime);
}
