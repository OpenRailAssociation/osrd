package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;

public class PowerPack implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    public double maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public double maxOutputPower;

    /** The energy storage object of the power pack */
    public EnergyStorage storage;

    /** The efficiency of the power pack, between 0 and 1 */
    private final double efficiency;

    public PowerPack(double maxInputPower,
                     double maxOutputPower,
                     EnergyStorage storage,
                     double efficiency
    ) {
        this.maxInputPower = maxInputPower;
        this.maxOutputPower = maxOutputPower;
        this.storage = storage;
        this.efficiency = efficiency;
    }

    /** Return available power */
    public double getMaxOutputPower(double speed, boolean electrification){
        double availablePower = maxOutputPower;
        availablePower *= storage.getPowerCoefficientFromSoc();
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public double getMaxInputPower() {
        return 0; // can't refill some gas while the train is running
    }

    @Override
    public void consumeEnergy(double energyDelta) {
        if (energyDelta <= 0)
            storage.updateStateOfCharge(energyDelta);
    }

    @Override
    public int getPriority() {
        return 1;
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
