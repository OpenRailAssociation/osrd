package fr.sncf.osrd.envelope_sim.power.storage;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;

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
        //TODO: make sure getPower = 0 at socMin
        soc = clamp(socMin, soc, socMax);
    }

    public double getSoc() {
        return soc;
    }

    public double getPowerCoefficientFromSoc() {
        if (soc > socMin)
            return 1;
        return 0;
    }

    public double getRefillPower() {
        return refillLaw.getRefillPower(soc);
    }
}
