package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.Utils.*;
import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;

public class Battery implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    public double maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public double maxOutputPower;

    /** The energy storage object of the battery */
    public EnergyStorage storage;

    /** The efficiency of the battery, between 0 and 1 */
    public final double efficiency;

    public Battery(double maxInputPower,
                   double maxOutputPower,
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
        double availablePower = maxOutputPower;
        availablePower *= storage.getPowerCoefficientFromSoc();
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public double getMaxInputPower() {
        var maxStorageInputPower = storage.getRefillPower();
        return Math.max(maxStorageInputPower, maxInputPower);
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
        CurvePoint[] curveHigherValueOnHighSpeed = {
                new CurvePoint(0.0,0.1),
                new CurvePoint(10.0,0.1),
                new CurvePoint(20.0,1.0),
                new CurvePoint(110.0,1.0),
                new CurvePoint(120.0,1.5),
                new CurvePoint(3000.0,1.5)
        };
        double pMin = -400.;
        double pMax = 500;
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
