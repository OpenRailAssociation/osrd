package fr.sncf.osrd

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.MRSPEnvelopeBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min

data class DriverBehaviour(
    val acceleratingPostponementOffset: Double = 50.0,
    val brakingAnticipationOffset: Double = 100.0,
    val signalingSystems: List<String> = listOf("BAL", "BAPR"),
) {
    /** Applies the driver behavior to the MRSP, adding reaction time for MRSP changes */
    fun applyToMRSP(
        mrsp: Envelope,
        optSignalingSystemRanges: DistanceRangeMap<String>? = null,
    ): Envelope {
        val signalingSystemRanges = optSignalingSystemRanges ?: distanceRangeMapOf()
        val builder = MRSPEnvelopeBuilder()
        val totalLength = mrsp.totalDistance
        for (part in mrsp) {
            var begin = part.beginPos
            var end = part.endPos
            // compute driver behaviour offsets
            if (signalingSystems.contains(signalingSystemRanges.get(begin.meters) ?: ""))
                begin -= this.brakingAnticipationOffset
            if (signalingSystems.contains(signalingSystemRanges.get(end.meters) ?: ""))
                end += this.acceleratingPostponementOffset
            begin = max(0.0, begin)
            end = min(totalLength, end)
            val speed = part.maxSpeed

            builder.addPart(
                EnvelopePart.generateTimes(
                    listOf(
                        EnvelopeProfile.CONSTANT_SPEED,
                        MRSPEnvelopeBuilder.LimitKind.SPEED_LIMIT,
                    ),
                    doubleArrayOf(begin, end),
                    doubleArrayOf(speed, speed),
                )
            )
        }
        return builder.build()
    }
}
