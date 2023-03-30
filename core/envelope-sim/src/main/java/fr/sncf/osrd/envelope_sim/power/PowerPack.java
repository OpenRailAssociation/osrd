package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;

public class PowerPack implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The energy storage object of the power pack */
    public EnergyStorage storage;

    /** The efficiency of the power pack, between 0 and 1 */
    private final double efficiency;

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

    /** Return available power */
    public double getPower(double speed, boolean electrification){
        double availablePower = pMax;
        availablePower *= storage.getPowerCoefficientFromSoc();
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public void updateStorage(double energyDelta) {
        if (energyDelta <= 0)
            storage.updateStateOfCharge(energyDelta);
    }

    public static PowerPack newPowerPackDiesel() {
        double pMin = 0;
        double pMax = 4e6;
        double volume = 4; // m^3
        double capacity = 10 * 3.6e6 * volume; // Joules
        var refillLaw = new RefillLaw(100,1,capacity);
        var storage = new EnergyStorage(capacity, 1, 0, 1, refillLaw);
        double efficiency = 1;
        return new PowerPack(pMin, pMax, storage, efficiency);
    }
}
