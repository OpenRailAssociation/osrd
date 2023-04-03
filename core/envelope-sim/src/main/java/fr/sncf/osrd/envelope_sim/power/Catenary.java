package fr.sncf.osrd.envelope_sim.power;

public class Catenary implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    public double maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public double maxOutputPower;

    public SpeedDependantPowerCoefficient speedCoef;

    /** The efficiency of the catenary - pantograph transfer, between 0 and 1 */
    public final double efficiency;

    public Catenary(double maxInputPower,
                    double maxOutputPower,
                    double efficiency,
                    SpeedDependantPowerCoefficient speedCoef
    ) {
        this.maxInputPower = maxInputPower;
        this.maxOutputPower = maxOutputPower;
        this.speedCoef = speedCoef;
        this.efficiency = efficiency;
    }

    /** Return available power */
    public double getMaxOutputPower(double speed, boolean electrification){
        if (!electrification)
            return 0;
        double availablePower = maxOutputPower;
        availablePower *= speedCoef.getPowerCoefficientFromSpeed(speed);
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public double getMaxInputPower() {
        return maxInputPower;
    }

    @Override
    public void consumeEnergy(double energyDelta) { }

    @Override
    public int getPriority() {
        return 0;
    }

    public static Catenary newCatenary() {
        Point2d[] curveLowValueOnLowSpeed = {
                new Point2d(0.0,0.5),
                new Point2d(10.0,0.5),
                new Point2d(20.0,1.0),
                new Point2d(3000.0,1.0)
        };

        return new Catenary(
                0.,
                400.0,
                1.,
                new SpeedDependantPowerCoefficient(curveLowValueOnLowSpeed)
        );
    }
}
