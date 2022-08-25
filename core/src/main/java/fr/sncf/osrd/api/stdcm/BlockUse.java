package fr.sncf.osrd.api.stdcm;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

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

    public final Block block;

    /** Create a new block occupancy */
    public BlockUse(Block block, double reservationStartTime, double reservationEndTime) {
        this.block = block;
        this.reservationStartTime = reservationStartTime;
        this.reservationEndTime = reservationEndTime;
    }

    public double impactWeight() {
        return getLength() * (reservationEndTime - reservationStartTime);
    }

    /**
     * ID of the entry signal.
     */
    public Signal<?> getEntrySig() {
        return block.entrySig;
    }

    /**
     * ID of the exit signal.
     */
    public Signal<?>  getExitSig() {
        return block.exitSig;
    }

    /**
     * The block occupancy identifier. It is a "debug" compound identifier.
     * It contains which GET this block occupancy comes from, as well as the route position in the GET, and more.
     * It cannot be used alone to compare the identity of two block occupancies.
     * The tuple (X, Xf, ID) uniquely identifies block occupancies.
     * The tuple (X, Xf) uniquely identifies blocks.
     * This is not the identifier of the physical block, but rather a compound identifier of the occupancy of the block.
     */
    public String getID() {
        return block.id;
    }

    /**
     * The length in meters, which is used for physics computations.
     */
    public double getLength() {
        return block.length;
    }

    /**
    * The max speed on this block. If it does not make sense, just take the lowest allowed speed in this block.
    */
    public double getMaxSpeed() {
        return block.maxSpeed;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("block", block)
                .add("reservationStartTime", reservationStartTime)
                .add("reservationEndTime", reservationEndTime)
                .toString();
    }
}
