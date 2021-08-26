package fr.sncf.osrd.speedcontroller;

public abstract class StopSpeedController extends SpeedController {
    /** Index of the stop the controller depends on if any, otherwise -1 */
    public int linkedStopIndex;

    public StopSpeedController(double beginPosition, double endPosition) {
        super(beginPosition, endPosition);
        linkedStopIndex = -1;
    }

    public StopSpeedController(double beginPosition, double endPosition, int linkedStopIndex) {
        super(beginPosition, endPosition);
        linkedStopIndex = linkedStopIndex;
    }

    /** Returns true if the position is in the active interval and the linked stop (if any) is still active */
    @Override
    public boolean isActive(double position, int currentStopIndex) {
        if (!super.isActive(position, currentStopIndex))
            return false;
        return linkedStopIndex < 0 || currentStopIndex <= linkedStopIndex;
    }
}
