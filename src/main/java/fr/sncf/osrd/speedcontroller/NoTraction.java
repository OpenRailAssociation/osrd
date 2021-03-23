package fr.sncf.osrd.speedcontroller;

public final class NoTraction extends SpeedController {
    public NoTraction(double startPosition, double endPosition) {
        super(startPosition, endPosition);
    }

    @Override
    public SpeedDirective getDirective(double headPosition) {
        return SpeedDirective.coast();
    }

    @Override
    public boolean deepEquals(SpeedController other) {
        if (!equalRange(other))
            return false;
        return other.getClass() == NoTraction.class;
    }
}