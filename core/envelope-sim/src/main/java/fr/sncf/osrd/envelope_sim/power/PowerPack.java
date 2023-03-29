package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.ManagementSystem;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;
import fr.sncf.osrd.envelope_sim.power.storage.SocDependantPowerCoefficient;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;

public class PowerPack implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The energy storage object of the power pack */
    public EnergyStorage storage;

    /** The efficiency of the power pack, between 0 and 1 */
    private double efficiency;

    public PowerPack(double pMin,
                     double pMax,
                     EnergyStorage storage,
                     double efficiency
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.storage = storage;
        this.efficiency = efficiency;
    }

    // METHODS :
    /** Return value restricted by EnergySource's Ceiling and Floor power limits : ES.pMin <= return <= ES.pMax*/
    public double clampPowerLimits(double power){
        return clamp(pMin, power, pMax);
    }

    /** Return available power */
    public double getPower(double speed, boolean electrification){
        double availablePower = pMax;
        availablePower *= efficiency;
        return clampPowerLimits(availablePower);
    }

    public static PowerPack newPowerPackDiesel() {
        double pMin = 0;
        double pMax = 4e6;
        double volume = 4; // m^3
        double capacity = 10 * 3.6e6 * volume; // Joules
        var refillLaw = new RefillLaw(100,1,capacity);
        var managementSystem = new ManagementSystem(1,0.2);  // to be used later
        var socCoef = new SocDependantPowerCoefficient(1);
        var storage = new EnergyStorage(capacity, 1, refillLaw, managementSystem, socCoef);
        double efficiency = 1;
        return new PowerPack(pMin, pMax, storage, efficiency);
    }
}