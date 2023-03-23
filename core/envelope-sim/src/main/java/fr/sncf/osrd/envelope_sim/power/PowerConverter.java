package fr.sncf.osrd.envelope_sim.power;

public class PowerConverter {
    // TODO : Should evolve into a variable efficiency
    double efficiency;
    public PowerConverter(double efficiency){
        this.efficiency = efficiency;
    }

    /** Account for conversion loss - adirectional -> no input or output
     * @param power power converted through
     * @return inferior or equals {@code power}
     */
    public double convert(double power){
        return  power * efficiency;
    }
}