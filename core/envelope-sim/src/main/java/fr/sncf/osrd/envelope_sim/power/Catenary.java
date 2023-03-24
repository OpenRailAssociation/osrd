package fr.sncf.osrd.envelope_sim.power;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;

public class Catenary implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The power conversion to account for power losses */
    public PowerConverter converter;

    /**
     *
     */
    public SpeedDependantPowerCoefficient speedCoef;

    public Catenary(double pMin,
                     double pMax,
                     PowerConverter converter,
                     SpeedDependantPowerCoefficient speedCoef
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.converter = converter;
        this.speedCoef = speedCoef;
    }

    // METHODS :
    /** Return value restricted by EnergySource's Ceiling and Floor power limits : ES.pMin <= return <= ES.pMax*/
    public double clampPowerLimits(double power){
        return clamp(pMin, power, pMax);
    }

    /** Return available power */
    public double getPower(double speed){
        double availablePower = pMax;
        if (converter!=null)
            availablePower = converter.convert(availablePower);
        return clampPowerLimits(availablePower);
    }
}