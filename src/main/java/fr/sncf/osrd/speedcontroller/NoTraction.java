package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.*;

public final class NoTraction extends SpeedController {
    public NoTraction(double startPosition, double endPosition) {
        super(startPosition, endPosition);
    }

    @Override
    public SpeedDirective getDirective(double headPosition) {
        return SpeedDirective.coast();
    }
}