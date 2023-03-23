package fr.sncf.osrd.envelope_sim.power.storage;

public class EnergyStorage{

    /** How much energy the object can store (in Joules or Watts·Seconds) */
    double capacity;

    /** The State of Charge of the EnergyStorage, soc * capacity = actual stock of energy */
    double soc;//
    public RefillLaw refillLaw;
    public ManagementSystem management;
    public SocDependantPowerCoefficient socDependency;

    public EnergyStorage(
            double capacity,
            double soc,
            RefillLaw refillLaw,
            ManagementSystem management,
            SocDependantPowerCoefficient socDependency
    ) {
        this.capacity = capacity;
        this.soc = soc;
        this.refillLaw = refillLaw;
        this.management = management;
        this.socDependency = socDependency;
    }

    public void updateStateOfCharge(double energy){
        soc += energy/capacity;
    }

    public double getSoc() {
        return soc;
    }
}