package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.envelope.EnvelopeAttr;

public final class BacktrackingEnvelopeAttr implements EnvelopeAttr {
    @Override
    public Class<? extends EnvelopeAttr> getAttrType() {
        return BacktrackingEnvelopeAttr.class;
    }
}
