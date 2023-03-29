package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.Utils.*;
import fr.sncf.osrd.envelope_sim.power.storage.EnergyStorage;
import fr.sncf.osrd.envelope_sim.power.storage.ManagementSystem;
import fr.sncf.osrd.envelope_sim.power.storage.RefillLaw;
import fr.sncf.osrd.envelope_sim.power.storage.SocDependantPowerCoefficient;

import static fr.sncf.osrd.envelope_sim.Utils.clamp;

public class Catenary implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

    /** The power conversion to account for power losses */
    public PowerConverter converter;

    /**
     *
     */
    public SpeedDependantPowerCoefficient speedCoef;

    /** The efficiency of the catenary - pantograph transfer, between 0 and 1 */
    public final double efficiency;

    public Catenary(double pMin,
                    double pMax,
                    double efficiency,
                    SpeedDependantPowerCoefficient speedCoef
    ) {
        this.pMin = pMin;
        this.pMax = pMax;
        this.speedCoef = speedCoef;
        this.efficiency = efficiency;
    }

    // METHODS :
    /** Return value restricted by EnergySource's Ceiling and Floor power limits : ES.pMin <= return <= ES.pMax*/
    public double clampPowerLimits(double power){
        return clamp(pMin, power, pMax);
    }

    /** Return available power */
    public double getPower(double speed){
        double availablePower = pMax;
        if (converter!=null)
            availablePower = converter.convert(availablePower);
        return clampPowerLimits(availablePower);
    }

    public static Catenary newCatenary() {
        CurvePoint[] curveLowValueOnLowSpeed = {
                new CurvePoint(0.0,0.5),
                new CurvePoint(10.0,0.5),
                new CurvePoint(20.0,1.0),
                new CurvePoint(3000.0,1.0)
        };

        return new Catenary(
                0.,
                400.0,
                1,
                new SpeedDependantPowerCoefficient(curveLowValueOnLowSpeed)
        );
    }
}