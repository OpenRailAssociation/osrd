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
        return maxOutputPower.get(speed) * efficiency;
    }

    @Override
    public double getMaxInputPower(double speed, boolean electrification) {
        if (!electrification)
            return 0;
        return maxInputPower.get(speed) / efficiency;
    }

    @Override
    public void consumeEnergy(double energyDelta) {}

    @Override
    public void sendEnergy(double energyDelta) {}

    @Override
    public int getPriority() {
        return 0;
    }

    /** Create a simple instance of Catenary with a speed dependancy (constant - incresing linearly - constant) */
    public static Catenary newCatenary(
            double pInput,
            double pOutput,
            double speedTransLow,
            double speedTransHigh,
            double efficiency
    ) {
        var speeds = new double[] {speedTransLow, speedTransHigh};
        var maxInputPowers = new double[] {pInput / 2, pInput};
        var maxOutputPowers = new double[] {pOutput / 2, pOutput};

        return new Catenary(
                new SpeedDependantPower(speeds, maxInputPowers),
                new SpeedDependantPower(speeds, maxOutputPowers),
                efficiency
        );
    }
}
