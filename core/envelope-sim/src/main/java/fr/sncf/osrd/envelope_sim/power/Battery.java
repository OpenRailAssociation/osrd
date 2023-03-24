package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.Utils.*;
import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.ManagementSystem;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;
import fr.sncf.osrd.envelope_sim.power.storage.SocDependantPowerCoefficient;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;

public class Battery implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The energy storage object of the battery */
    public EnergyStorage storage;

    /** The power conversion to account for power losses */
    public PowerConverter converter;

    public Battery(double pMin,
                   double pMax,
                   EnergyStorage storage,
                   PowerConverter converter
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.storage = storage;
        this.converter = converter;
    }

    // METHODS :
    /** Return value restricted by EnergySource's Ceiling and Floor power limits : ES.pMin <= return <= ES.pMax*/
    public double clampPowerLimits(double power){
        return clamp(pMin, power, pMax);
    }

    /** Return available power based on contextual state of charge */
    public double getPower(double speed){
        double availablePower = pMax;
        availablePower *= storage.socDependency.getPowerCoefficientFromSoc(storage.getSoc());
        if (converter!=null)
            availablePower = converter.convert(availablePower);
        return clampPowerLimits(availablePower);
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
        return new Battery(
                -400.,
                500.,
                new EnergyStorage(
                        150*3.6E6, 0.8,         // kWh to J : x3.6E6
                        new RefillLaw(97.6,0.8,150*3.6E6),
                        new ManagementSystem(0.9,0.2),  // to be used later
                        new SocDependantPowerCoefficient(curveHigherValueOnHighSpeed)
                ),
                new PowerConverter(0.8));
    }
}