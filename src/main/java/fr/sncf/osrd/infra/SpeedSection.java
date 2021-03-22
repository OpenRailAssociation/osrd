package fr.sncf.osrd.infra;

import fr.sncf.osrd.rollingstock.RollingStock;

public class SpeedSection {
    /**
     * Whether there are signals on the track telling the driver about this speed limit.
     * If there aren't, the driver must make sure the speed limit is taken care of anyway.
     */
    public final boolean isSignalized;

    public final double speedLimit;

    public SpeedSection(boolean isSignalized, double speedLimit) {
        this.isSignalized = isSignalized;
        this.speedLimit = speedLimit;
    }

    /**
     * Checks whether this speed section's limit applies to some train.
     * @param rollingStock the train
     * @return whether this speed section applies
     */
    public boolean isValidFor(RollingStock rollingStock) {
        return true;
    }
}
