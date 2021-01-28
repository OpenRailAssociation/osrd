package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.simulation.utils.ChangeSerializer.SerializableDouble;
import fr.sncf.osrd.train.*;

public abstract class SpeedController {
    @SerializableDouble
    public final double beginPosition;

    @SerializableDouble
    public final double endPosition;

    public SpeedController(double beginPosition, double endPosition) {
        this.beginPosition = beginPosition;
        this.endPosition = endPosition;
    }

    public boolean isActive(TrainState state) {
        var position = state.location.getHeadPathPosition();
        return (position >= beginPosition && position < endPosition);
    }

    /**
     * Returns the speed instructed by this controller.
     * Nan means coasting
     * @param trackPosition the position of the train relative to the beginning of the track
     * @return the speed limits at this point
     */
    public abstract SpeedDirective getDirective(double trackPosition);
}
