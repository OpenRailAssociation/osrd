package fr.sncf.osrd.new_infra.api.signaling;

import com.google.errorprone.annotations.Immutable;

@Immutable
public interface SignalState {
    /** Returns the RGB Color for this signal state, as encoded by {@link java.awt.Color#getRGB}. */
    int getRGBColor();

    /** Returns true if the protected route is completely free: the train can go at full speed */
    boolean isFree();
}
