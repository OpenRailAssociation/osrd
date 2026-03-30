package fr.sncf.osrd.envelope

import fr.sncf.osrd.envelope.part.EnvelopePart

/** Creates an envelope by concatenating envelope parts. Envelope parts must not overlap. */
class EnvelopeBuilder {
    private val parts: MutableList<EnvelopePart> = mutableListOf()
    private var isBuilt = false

    /** Adds a part to the envelope */
    fun addPart(part: EnvelopePart) {
        require(!isBuilt) { "build() was already called" }
        parts.add(part)
    }

    /** Adds a list of parts */
    fun addParts(parts: Array<EnvelopePart>) {
        require(!isBuilt) { "build() was already called" }
        for (part in parts) addPart(part)
    }

    /** Adds all parts of an envelope */
    fun addEnvelope(envelope: Envelope) {
        require(!isBuilt) { "build() was already called" }
        for (part in envelope) addPart(part)
    }

    /** Reverses the order of the parts */
    fun reverse() {
        require(!isBuilt) { "build() was already called" }
        parts.reverse()
    }

    /** Creates a new Envelope */
    fun build(): Envelope {
        require(!isBuilt) { "build() was already called" }
        isBuilt = true
        return Envelope.make(*parts.toTypedArray())
    }

    companion object {
        /** Concatenates multiple envelopes together */
        fun concatenate(vararg envelopes: Envelope): Envelope {
            val res = EnvelopeBuilder()
            for (envelope in envelopes) res.addEnvelope(envelope)
            return res.build()
        }
    }
}

fun concatenateAndShiftEnvelopes(envelopes: List<Envelope>): Envelope {
    var currentOffset = 0.0
    val envelopeParts = mutableListOf<EnvelopePart>()
    for (envelope in envelopes) {
        envelopeParts.addAll(envelope.map { it.copyAndShift(currentOffset) })
        currentOffset += envelope.endPos
    }
    return Envelope(envelopeParts.toTypedArray())
}
