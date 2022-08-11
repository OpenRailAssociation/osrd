package fr.sncf.osrd.api.stdcm;

/** A block occupancy "time span" */
public class BlockUse {

    /**
     * The time at which the block starts to be occupied, which includes the driver lookahead and aspect cascade.
     * By definition equal to Tv.
     */
    public double reservationStartTime;

    /**
     * The time at which the block stops to be occupied, which includes the driver lookahead and aspect cascade.
     * By definition equal to Tfj.
     */
    public double reservationEndTime;

    /**
     * ID of the entry signal.
     */
    public String entrySig;

    /**
     * ID of the exit signal.
     */
    public String exitSig;

    /**
     * The block occupancy identifier. It is a "debug" compound identifier.
     * It contains which GET this block occupancy comes from, as well as the route position in the GET, and more.
     * It cannot be used alone to compare the identity of two block occupancies.
     * The tuple (X, Xf, ID) uniquely identifies block occupancies.
     * The tuple (X, Xf) uniquely identifies blocks.
     * This is not the identifier of the physical block, but rather a compound identifier of the occupancy of the block.
     */
    public final String id;

    /**
     * The length in meters, which is used for physics computations.
     */
    public final double length;

    /**
    * The max speed on this block. If it does not make sense, just take the lowest allowed speed in this block.
    */
    public final double maxSpeed;

    /** Create a new block occupancy */
    public BlockUse(double reservationStartTime, double reservationEndTime, String entrySig, String exitSig, String id, double length, double maxSpeed) {
        this.reservationStartTime = reservationStartTime;
        this.reservationEndTime = reservationEndTime;
        this.entrySig = entrySig;
        this.exitSig = exitSig;
        this.id = id;
        this.length = length;
        this.maxSpeed = maxSpeed;
    }

    public double impactWeight() {
        return length * (reservationEndTime - reservationStartTime);
    }
}
