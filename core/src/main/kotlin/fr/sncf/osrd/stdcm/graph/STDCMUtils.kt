package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsPath
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.graph.Pathfinding.EdgeRange
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.math.min

/** Combines all the envelopes in the given edge ranges  */
fun mergeEnvelopeRanges(
    edges: List<EdgeRange<STDCMEdge, STDCMEdge>>,
    path: PhysicsPath
): Envelope {
    val parts = ArrayList<EnvelopePart>()
    var offset = 0.0
    for (edge in edges) {
        val envelope = edge.edge.envelope
        var sliceUntil = min(envelope.endPos, (edge.end - edge.start).absoluteValue.meters)
        if (sliceUntil == 0.0)
            continue
        if (TrainPhysicsIntegrator.arePositionsEqual(sliceUntil, envelope.endPos))
            sliceUntil = envelope.endPos // The diff between longs and floats can break things here
        val slicedEnvelope = Envelope.make(*envelope.slice(0.0, sliceUntil))
        for (part in slicedEnvelope)
            parts.add(part.copyAndShift(offset, 0.0, path.length))
        offset = parts[parts.size - 1].endPos
    }
    val newEnvelope = Envelope.make(*parts.toTypedArray<EnvelopePart>())
    assert(newEnvelope.continuous)
    return newEnvelope
}

/** Combines all the envelopes in the given edges  */
fun mergeEnvelopes(
    graph: STDCMGraph,
    edges: List<STDCMEdge>,
    context: EnvelopeSimContext
): Envelope {
    return mergeEnvelopeRanges(
        edges.stream()
            .map { e: STDCMEdge -> EdgeRange(e, Offset(0.meters), e.length) }
            .toList(),
        context.path
    )
}

/** Returns the offset of the stops on the given block, starting at startOffset */
fun getStopOnBlock(
    graph: STDCMGraph,
    infraExplorer: InfraExplorer,
    startOffset: Offset<Block>,
    waypointIndex: Int
): Offset<Block>? {
    var mutWaypointIndex = waypointIndex
    val res = ArrayList<Offset<Block>>()
    while (mutWaypointIndex + 1 < graph.steps.size && !graph.steps[mutWaypointIndex + 1].stop)
        mutWaypointIndex++ // Only the next point where we actually stop matters here
    if (mutWaypointIndex + 1 >= graph.steps.size)
        return null
    val nextStep = graph.steps[mutWaypointIndex + 1]
    if (!nextStep.stop)
        return null
    for (endLocation in nextStep.locations) {
        if (endLocation.edge == infraExplorer.getCurrentBlock()) {
            val offset = endLocation.offset - startOffset.distance
            if (offset >= Offset(0.meters))
                res.add(offset)
        }
    }
    return if (res.isEmpty())
        null
    else
        Collections.min(res)
}

/** Create a TrainPath instance from a list of edge ranges  */
fun makeChunkPathFromRanges(graph: STDCMGraph, ranges: List<EdgeRange<STDCMEdge, STDCMEdge>>): ChunkPath {
    val blocks = ranges.stream()
        .map { range -> range.edge.block }
        .distinct()
        .toList()
    val totalPathLength = Length<Path>(Distance(millimeters = ranges.stream()
        .mapToLong { range -> (range.end - range.start).millimeters }
        .sum()))
    val firstOffset = Offset<Path>(ranges[0].edge.envelopeStartOffset.distance + ranges[0].start.distance)
    val lastOffset = totalPathLength + firstOffset.distance
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    for (block in blocks)
        for (chunk in graph.blockInfra.getTrackChunksFromBlock(block))
            chunks.add(chunk)
    return buildChunkPath(graph.rawInfra, chunks, firstOffset, lastOffset)
}

/** Converts an offset on an STDCM edge into an offset on its underlying block */
fun convertOffsetToBlock(edgeOffset: Offset<STDCMEdge>, envelopeStartOffset: Offset<Block>): Offset<Block> {
    return Offset(edgeOffset.distance + envelopeStartOffset.distance)
}

/** Converts an offset on a block into an offset on its STDCM edge */
fun convertOffsetToEdge(blockOffset: Offset<Block>, envelopeStartOffset: Offset<Block>): Offset<STDCMEdge> {
    return Offset(blockOffset.distance - envelopeStartOffset.distance)
}
