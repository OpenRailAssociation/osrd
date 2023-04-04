package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;

import static fr.sncf.osrd.envelope_sim.power.SpeedDependantPower.constantPower;

public class Battery implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    public SpeedDependantPower maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public SpeedDependantPower maxOutputPower;

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
        return Math.max(maxStorageInputPower, maxInputPower.get(speed));
    }

    @Override
    public void consumeEnergy(double energyDelta) {
        storage.updateStateOfCharge(energyDelta);
    }

    @Override
    public int getPriority() {
        return 2;
    }

    public static Battery newBattery() {
        var pMin = constantPower(-400.);
        var pMax = constantPower(500);
        double capacity = 150 * 3.6e6;
        return new Battery(
                pMin,
                pMax,
                new EnergyStorage(
                        capacity,
                        0.8,
                        0.2, 0.9,
                        new RefillLaw(97.6,0.8, capacity)
                ),
                1.
        );
    }

    public void sendPower(double powerSentToBattery, double timeDelta) {
        var deltaSoc = powerSentToBattery * timeDelta;
        storage.updateStateOfCharge(deltaSoc);
    }
}
