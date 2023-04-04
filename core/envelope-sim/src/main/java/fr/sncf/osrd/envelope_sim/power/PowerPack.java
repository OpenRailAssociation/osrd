package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;

import static fr.sncf.osrd.envelope_sim.power.SpeedDependantPower.constantPower;

public class PowerPack implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    public SpeedDependantPower maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public SpeedDependantPower maxOutputPower;

    /** The energy storage object of the power pack */
    public EnergyStorage storage;

    /** The efficiency of the power pack, between 0 and 1 */
    private final double efficiency;

    public PowerPack(SpeedDependantPower maxInputPower,
                     SpeedDependantPower maxOutputPower,
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
        double availablePower = maxOutputPower.get(speed);
        availablePower *= storage.getPowerCoefficientFromSoc();
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public double getMaxInputPower(double speed) {
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
        var pMin = constantPower(0);
        var pMax = constantPower(4e6);
        double volume = 4; // m^3
        double capacity = 10 * 3.6e6 * volume; // Joules
        var refillLaw = new RefillLaw(100,1,capacity);
        var storage = new EnergyStorage(capacity, 1, 0, 1, refillLaw);
        double efficiency = 1;
        return new PowerPack(pMin, pMax, storage, efficiency);
    }
}
