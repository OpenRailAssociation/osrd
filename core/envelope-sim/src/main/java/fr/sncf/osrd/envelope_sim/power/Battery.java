package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;

import static fr.sncf.osrd.envelope_sim.power.SpeedDependantPower.constantPower;

public class Battery implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    private final SpeedDependantPower maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    private final SpeedDependantPower maxOutputPower;

    /** The energy storage object of the battery */
    public EnergyStorage storage;

    /** The efficiency of the battery, between 0 and 1 */
    public final double efficiency;

    public Battery(SpeedDependantPower maxInputPower,
                   SpeedDependantPower maxOutputPower,
                   EnergyStorage storage,
                   double efficiency
    ) {
        this.maxInputPower = maxInputPower;
        this.maxOutputPower = maxOutputPower;
        this.storage = storage;
        this.efficiency = efficiency;
    }

    /** Return available power based on contextual state of charge */
    public double getMaxOutputPower(double speed, boolean electrification){
        double availablePower = maxOutputPower.get(speed);
        availablePower *= storage.getPowerCoefficientFromSoc();
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public double getMaxInputPower(double speed) {
        var maxStorageInputPower = storage.getRefillPower();
        return Math.min(maxStorageInputPower, maxInputPower.get(speed));
    }

    @Override
    public void consumeEnergy(double energyDelta) {
        storage.updateStateOfCharge(-energyDelta);
    }

    @Override
    public int getPriority() {
        return 2;
    }

    public double getSoc() {
        return storage.getSoc();
    }

    public static Battery newBattery(
            double pInput,
            double pOutput,
            double capacity,
            double efficiency,
            double initialSoc
    ) {
        var maxInputPower = constantPower(pInput);
        var maxOutputPower = constantPower(pOutput);
        return new Battery(
                maxInputPower,
                maxOutputPower,
                new EnergyStorage(
                        capacity,
                        initialSoc,
                        0.2, 0.9,
                        new RefillLaw(1000,0.8, capacity)
                ),
                efficiency
        );
    }
}
