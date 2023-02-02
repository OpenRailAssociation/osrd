package fr.sncf.osrd.train;

public class EnergyStorage {
    /**
     * The total capacity of the power pack, in J
     */
    public final double capacity;
    /**
     * The minimum state of charge of the power pack
     */
    public final double socMin;
    /**
     * The maximum state of charge of the power pack
     */
    public final double socMax;
    /**
     * The reference state of charge of the power pack
     */
    public final double socRef;
    /**
     * The current state of charge of the power pack
     */
    public double soc;

    public EnergyStorage(
            double capacity,
            double socMin,
            double socMax,
            double socRef,
            double socInit
    ) {
        this.capacity = capacity;
        this.socMin = socMin;
        this.socMax = socMax;
        this.socRef = socRef;
        this.soc = socInit;
    }
}
