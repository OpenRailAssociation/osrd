package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.utils.SelfTypeHolder;
import org.jetbrains.annotations.NotNull;

/**
 * The shape of an envelope part. Please DO NOT add new items to this enum, and create new attribute
 * types instead.
 */
public enum EnvelopeProfile implements SelfTypeHolder {
    ACCELERATING,
    CONSTANT_SPEED,
    CATCHING_UP,
    COASTING,
    BRAKING,
    ;

    @Override
    public @NotNull Class<? extends SelfTypeHolder> getSelfType() {
        return EnvelopeProfile.class;
    }
}
