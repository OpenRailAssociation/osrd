package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_utils.Point2d;

public class Catenary implements EnergySource {

    /** Floor power limit : the max power the source can capture (<=0) */
    public SpeedDependantPower maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public SpeedDependantPower maxOutputPower;

    /** The efficiency of the catenary - pantograph transfer, between 0 and 1 */
    public final double efficiency;

    public Catenary(SpeedDependantPower maxInputPower,
                    SpeedDependantPower maxOutputPower,
                    double efficiency
    ) {
        this.maxInputPower = maxInputPower;
        this.maxOutputPower = maxOutputPower;
        this.efficiency = efficiency;
    }

    /** Return available power */
    public double getMaxOutputPower(double speed, boolean electrification){
        if (!electrification)
            return 0;
        double availablePower = maxOutputPower.get(speed);
        availablePower *= efficiency;
        return availablePower;
    }

    @Override
    public double getMaxInputPower(double speed) {
        return maxInputPower.get(speed);
    }

    @Override
    public void consumeEnergy(double energyDelta) { }

    @Override
    public int getPriority() {
        return 0;
    }

    public static Catenary newCatenary() {
        var speeds = new double[] {0., 10., 20., 30.};
        var maxInputPowers = new double[] {0., 0., 0., 0.};
        var maxOutputPowers = new double[] {200., 200., 400., 400.};

        return new Catenary(
                new SpeedDependantPower(speeds, maxInputPowers),
                new SpeedDependantPower(speeds, maxOutputPowers),
                1.
        );
    }
}
