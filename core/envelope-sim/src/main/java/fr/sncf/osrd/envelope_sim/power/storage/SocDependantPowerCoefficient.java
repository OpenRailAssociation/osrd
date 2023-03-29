package fr.sncf.osrd.envelope_sim.power.storage;

import fr.sncf.osrd.envelope_sim.Utils.*;

import static fr.sncf.osrd.envelope_sim.Utils.interpolate;

public class SocDependantPowerCoefficient{
    // x:speed values , y:associated dimensionless powerCoefficient which modulate output power
    // TODO : specify use case
    CurvePoint[] curve;

    public SocDependantPowerCoefficient(CurvePoint[] curve) {
        this.curve = curve;
    }

    public SocDependantPowerCoefficient(double constantValue) {
        this.curve = new CurvePoint[] {
            new CurvePoint(0. ,constantValue),
                new CurvePoint(1.,constantValue)
        };
    }

    /** Return Power Coefficient at a given SoC*/
    public double getPowerCoefficientFromSoc(double soc){
        return interpolate(soc, curve);
    }
}