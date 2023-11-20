package fr.sncf.osrd.stdcm

import fr.sncf.osrd.envelope.EnvelopeAttr

class BacktrackingEnvelopeAttr : EnvelopeAttr {
    override fun getAttrType(): Class<out EnvelopeAttr?> {
        return BacktrackingEnvelopeAttr::class.java
    }
}
