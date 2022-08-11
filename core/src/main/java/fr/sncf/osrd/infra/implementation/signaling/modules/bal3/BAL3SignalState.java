package fr.sncf.osrd.infra.implementation.signaling.modules.bal3;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.awt.*;
import java.util.Objects;

public class BAL3SignalState implements SignalState {
    public final BAL3.Aspect aspect;
    private final BAL3Signal signal;

    public BAL3SignalState(BAL3Signal signal, BAL3.Aspect aspect) {
        this.signal = signal;
        this.aspect = aspect;
    }

    @Override
    public int getRGBColor() {
        return switch (aspect) {
            case GREEN -> Color.GREEN.getRGB();
            case YELLOW -> Color.YELLOW.getRGB();
            case RED -> Color.RED.getRGB();
        };
    }

    @Override
    public String getAspectLabel() {
        if (signal.getInitialState().aspect.equals(BAL3.Aspect.RED)) {
            // "Carre" signal (red by default)
            return switch (aspect) {
                case GREEN -> "CARRE VL";
                case YELLOW -> "CARRE A";
                case RED -> "CARRE";
            };
        }
        // Otherwise, "semaphore" signal
        return switch (aspect) {
            case GREEN -> "S VL";
            case YELLOW -> "S A";
            case RED -> "S";
        };
    }

    @Override
    public boolean isFree() {
        return aspect.equals(BAL3.Aspect.GREEN);
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("aspect", aspect)
                .toString();
    }

    @Override
    public boolean equals(Object o) {
        if (o instanceof BAL3SignalState other)
            return other.aspect == aspect;
        return false;
    }

    @Override
    public int hashCode() {
        return Objects.hash(aspect);
    }
}
