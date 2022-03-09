package fr.sncf.osrd.new_infra.api.signaling;

import com.google.errorprone.annotations.Immutable;

@Immutable
public interface SignalState {
    /** Returns the RGB Color for this signal state, as encoded by {@link java.awt.Color#getRGB}. */
    int getRGBColor();
}
