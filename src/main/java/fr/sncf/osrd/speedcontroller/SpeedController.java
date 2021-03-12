package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.simulation.ChangeSerializer.SerializableDouble;
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
        var position = state.location.getPathPosition();
        return (position >= beginPosition && position < endPosition);
    }

    /**
     * Returns the speed instructed by this controller.
     * Nan means coasting
     * @param trackPosition the position of the train relative to the beginning of the track
     * @return the speed limits at this point
     */
    public abstract SpeedDirective getDirective(double trackPosition);

    /**
     * Get and merge the speed directives of a given list of speed controllers.
     * @param controllers a list of speed controllers
     * @param pathPosition a position on the train's path
     * @return the merged speed directive
     */
    public static SpeedDirective getDirective(SpeedController[] controllers, double pathPosition) {
        var profile = SpeedDirective.maxLimits();
        for (var controller : controllers)
            profile.mergeWith(controller.getDirective(pathPosition));
        return profile;
    }
}
