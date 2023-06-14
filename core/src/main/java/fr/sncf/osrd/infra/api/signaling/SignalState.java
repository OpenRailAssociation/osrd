package fr.sncf.osrd.infra.api.signaling;

import com.google.errorprone.annotations.Immutable;

@Immutable
public interface SignalState {
    /** Returns the RGB Color for this signal state, as encoded by {@link java.awt.Color#getRGB}. */
    int getRGBColor();

    /** Returns the string representing the signal aspect.
     *
     * @see <a href="https://github.com/osrd-project/osrd/blob/dev/front/src/common/Map/Consts/SignalsNames.ts">
     *     signal names
     *     </a>
     */
    String getAspectLabel();

    /** Returns true if the protected route is completely free: the train can go at full speed */
    boolean isFree();
}
