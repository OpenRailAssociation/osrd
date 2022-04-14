package fr.sncf.osrd.infra.implementation.signaling.modules.bal3;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.awt.*;
import java.util.Objects;

public class BAL3SignalState implements SignalState {
    public final BAL3.Aspect aspect;

    public BAL3SignalState(BAL3.Aspect aspect) {
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
