package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;

public class PowerPack implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The energy storage object of the power pack */
    public EnergyStorage storage;

    /** The power conversion to account for power losses */
    public PowerConverter converter;

    public PowerPack(double pMin,
                     double pMax,
                     EnergyStorage storage,
                     PowerConverter converter
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.storage = storage;
        this.converter = converter;
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

    public static PowerPack newPowerPackDiesel() {
        // TODO: add parameters
        return PowerPack(0, );
    }
}