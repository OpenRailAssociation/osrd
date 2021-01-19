package fr.sncf.osrd.infra;

import fr.sncf.osrd.train.RollingStock;

public abstract class SpeedSection {
    /**
     * Whether there are signals on the track telling the driver about this speed limit.
     * If there aren't, the driver must make sure the speed limit is taken care of anyway.
     */
    public final boolean isSignaled;

    public final double speedLimit;

    public SpeedSection(boolean isSignaled, double speedLimit) {
        this.isSignaled = isSignaled;
        this.speedLimit = speedLimit;
    }

    /**
     * Checks whether this speed section's limit applies to some train.
     * @param rollingStock the train
     * @return whether this speed section applies
     */
    abstract boolean isValidFor(RollingStock rollingStock);
}
