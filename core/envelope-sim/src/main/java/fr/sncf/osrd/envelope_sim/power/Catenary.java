package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.Utils.*;

public class Catenary implements EnergySource {

    /** Floor power limit */
    public double pMin;

    /** Ceiling power limit */
    public double pMax;

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

    /** Return available power */
    public double getPower(double speed, boolean electrification){
        if (!electrification)
            return 0;
        double availablePower = pMax;
        availablePower *= speedCoef.getPowerCoefficientFromSpeed(speed);
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public void updateStorage(double energyDelta) { }

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
