package fr.sncf.osrd.envelope_sim.power.storage;

public class EnergyStorage{

    /** How much energy the object can store (in Joules or Watts·Seconds) */
    double capacity;

    /** The State of Charge of the EnergyStorage, soc * capacity = actual stock of energy */
    double soc;
    public RefillLaw refillLaw;
    public double socMin;
    public double socMax;
    public SocDependantPowerCoefficient socDependency;

    public EnergyStorage(
            double capacity,
            double initialSoc,
            double socMin,
            double socMax,
            RefillLaw refillLaw,
            SocDependantPowerCoefficient socDependency
    ) {
        this.capacity = capacity;
        this.soc = initialSoc;
        this.refillLaw = refillLaw;
        this.socMin = socMin;
        this.socMax = socMax;
        this.socDependency = socDependency;
    }

    public void updateStateOfCharge(double energy){
        soc += energy/capacity;
        soc = Math.max(Math.min(soc, socMax), socMin);
    }

    public double getSoc() {
        return soc;
    }
}