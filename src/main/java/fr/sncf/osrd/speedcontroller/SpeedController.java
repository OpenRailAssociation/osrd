package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.ChangeSerializer.SerializableDouble;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.utils.DeepComparable;

import java.util.Set;

public abstract class SpeedController implements DeepComparable<SpeedController> {
    @SerializableDouble
    public final double beginPosition;

    @SerializableDouble
    public final double endPosition;

    public SpeedController(double beginPosition, double endPosition) {
        this.beginPosition = beginPosition;
        this.endPosition = endPosition;
    }

    public boolean isActive(double position) {
        return (position >= beginPosition && position < endPosition);
    }

    public boolean isActive(TrainPositionTracker positionTracker) {
        var position = positionTracker.getPathPosition();
        return isActive(position);
    }

    public boolean isActive(TrainState state) {
        return isActive(state.location);
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST", "FE_FLOATING_POINT_EQUALITY"})
    protected boolean equalRange(SpeedController o) {
        return o.beginPosition == beginPosition && o.endPosition == endPosition;
    }

    /**
     * Returns the speed instructed by this controller.
     * Nan means coasting
     * @param pathPosition the position of the train relative to the beginning of the track
     * @return the speed limits at this point
     */
    public abstract SpeedDirective getDirective(double pathPosition);

    /**
     * Get and merge the speed directives of a given list of speed controllers.
     * @param controllers a list of speed controllers
     * @param pathPosition a position on the train's path
     * @return the merged speed directive
     */
    public static SpeedDirective getDirective(Set<SpeedController> controllers, double pathPosition) {
        var profile = SpeedDirective.getMax();
        for (var controller : controllers)
            if (controller.isActive(pathPosition))
                profile.mergeWith(controller.getDirective(pathPosition));
        return profile;
    }

    /** Returns a copy of the speed controller, with every speed scaled by scalingFactor*/
    public abstract SpeedController scaled(double scalingFactor);
}
