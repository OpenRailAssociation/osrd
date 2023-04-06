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
    public double getMaxInputPower(double speed, boolean electrification) {
        return 0; // can't refill gas while the train is running
    }

    @Override
    public void consumeEnergy(double energyDelta) {
        assert energyDelta > 0;
        storage.updateStateOfCharge(-energyDelta);
    }

    @Override
    public void sendEnergy(double energyDelta) {
        assert energyDelta > 0;
        storage.updateStateOfCharge(energyDelta);
    }

    @Override
    public int getPriority() {
        return 1;
    }

    public double getSoc() {
        return storage.getSoc();
    }

    public static PowerPack newPowerPackDiesel(
            double pInput,
            double pOutput,
            double capacity,
            double efficiency,
            double initialSoc
    ) {
        var maxInputPower = constantPower(pInput);
        var maxOutputPower = constantPower(pOutput);
        var refillLaw = new RefillLaw(100,1,capacity);
        var storage = new EnergyStorage(capacity, initialSoc, 0, 1, refillLaw);
        return new PowerPack(maxInputPower, maxOutputPower, storage, efficiency);
    }
}
