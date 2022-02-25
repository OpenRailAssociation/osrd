package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.envelope.EnvelopeAttr;

/**
 * The shape of an envelope part.
 * Please DO NOT add new items to this enum,
 * and create new attribute types instead.
 */
public enum EnvelopeProfile implements EnvelopeAttr {
    ACCELERATING,
    CONSTANT_SPEED,
    COASTING,
    BRAKING,
}
