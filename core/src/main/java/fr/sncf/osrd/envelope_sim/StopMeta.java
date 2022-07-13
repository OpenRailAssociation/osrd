package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.envelope.EnvelopeAttr;

public final class StopMeta implements EnvelopeAttr {
    public final int stopIndex;

    public StopMeta(int stopIndex) {
        this.stopIndex = stopIndex;
    }

    @Override
    public Class<? extends EnvelopeAttr> getAttrType() {
        return StopMeta.class;
    }
}
