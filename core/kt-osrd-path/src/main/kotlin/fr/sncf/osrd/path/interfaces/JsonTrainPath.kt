package fr.sncf.osrd.path.interfaces

import com.squareup.moshi.Json
import fr.sncf.osrd.path.implementations.PartialBlockRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min

data class JsonTrainPath(
    val blocks: List<ObjectRange<Block>>,
    val routes: List<ObjectRange<Route>>,
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackSectionRange>,
) {
    data class ObjectRange<T>(val id: String, val begin: Offset<T>, val end: Offset<T>) {
        init {
            require(begin <= end)
        }
    }

    data class TrackSectionRange(
        @Json(name = "track_section") val trackSection: String,
        val begin: Offset<TrackSection>,
        val end: Offset<TrackSection>,
        val direction: EdgeDirection,
    ) {
        init {
            require(begin <= end)
        }
    }

    fun toTrainPath(
        rawInfra: RawInfra,
        blockInfra: BlockInfra,
        electricalProfileMapping: ElectricalProfileMapping?,
    ): TrainPath {
        val blockRanges =
            buildRangeList(
                blocks.map {
                    PartialBlockRange(blockInfra.getBlockFromName(it.id)!!, it.begin, it.end)
                }
            )
        return buildTrainPathFromBlockRanges(
            rawInfra,
            blockInfra,
            blockRanges = blockRanges,
            routeNames = routes.map { it.id },
            electricalProfileMapping = electricalProfileMapping,
        )
    }
}

fun TrainPath.toJsonTrainPath(rawInfra: RawInfra, blockInfra: BlockInfra): JsonTrainPath {
    val tracks = mutableListOf<JsonTrainPath.TrackSectionRange>()
    for ((dirChunk, from, to) in getChunks()) {
        val track = rawInfra.getTrackFromChunk(dirChunk.value)
        val trackName = rawInfra.getTrackSectionName(track)
        val chunkStartOffset = rawInfra.getTrackChunkOffset(dirChunk.value)
        val chunkEndOffset =
            chunkStartOffset + rawInfra.getTrackChunkLength(dirChunk.value).distance
        val trackRange =
            if (dirChunk.direction == Direction.INCREASING)
                JsonTrainPath.TrackSectionRange(
                    trackName,
                    chunkStartOffset + from.distance,
                    chunkStartOffset + to.distance,
                    EdgeDirection.START_TO_STOP,
                )
            else
                JsonTrainPath.TrackSectionRange(
                    trackName,
                    chunkEndOffset - to.distance,
                    chunkEndOffset - from.distance,
                    EdgeDirection.STOP_TO_START,
                )
        val lastAddedRange = tracks.lastOrNull()
        if (lastAddedRange == null || lastAddedRange.trackSection != trackRange.trackSection) {
            tracks.add(trackRange)
        } else {
            val newLastRange =
                lastAddedRange.copy(
                    begin = min(lastAddedRange.begin, trackRange.begin),
                    end = max(lastAddedRange.end, trackRange.end),
                )
            // Check that we only extend the range, and only on one end
            require(
                lastAddedRange.begin == newLastRange.begin || lastAddedRange.end == newLastRange.end
            )
            require(
                newLastRange.begin <= lastAddedRange.begin && newLastRange.end >= lastAddedRange.end
            )
            tracks[tracks.lastIndex] = newLastRange
        }
    }
    return JsonTrainPath(
        getBlocks().map {
            JsonTrainPath.ObjectRange(
                blockInfra.getBlockName(it.value),
                it.objectBegin,
                it.objectEnd,
            )
        },
        getRoutes().map {
            JsonTrainPath.ObjectRange(rawInfra.getRouteName(it.value), it.objectBegin, it.objectEnd)
        },
        tracks,
    )
}
