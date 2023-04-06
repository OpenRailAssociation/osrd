package fr.sncf.osrd.envelope_sim.power.storage;

import fr.sncf.osrd.envelope_utils.DoubleUtils;

public class EnergyStorage{

    /** How much energy the object can store (in Joules or Watts·Seconds) */
    double capacity;

    /** The State of Charge of the EnergyStorage, soc * capacity = actual stock of energy */
    double soc;
    public RefillLaw refillLaw;
    public double socMin;
    public double socMax;

    public EnergyStorage(
            double capacity,
            double initialSoc,
            double socMin,
            double socMax,
            RefillLaw refillLaw
    ) {
        this.capacity = capacity;
        this.soc = initialSoc;
        this.socMin = socMin;
        this.socMax = socMax;
        this.refillLaw = refillLaw;
    }

    public void updateStateOfCharge(double energy){
        soc += energy/capacity;
        soc = DoubleUtils.clamp(socMin, soc, socMax);
    }

    public double getPowerCoefficientFromSoc() {
        if (soc > socMin)
            return 1;
        return 0;
    }

    public double getRefillPower() {
        return refillLaw.getRefillPower(soc);
    }

    public double getSoc() {
        return soc;
    }
}
