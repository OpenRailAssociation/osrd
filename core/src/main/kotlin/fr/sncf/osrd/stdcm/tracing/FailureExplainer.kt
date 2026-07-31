package fr.sncf.osrd.stdcm.tracing

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.S3Context
import fr.sncf.osrd.conflicts.RequirementId
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.toGeoPoint
import java.io.File
import java.time.Duration
import java.time.ZonedDateTime
import java.util.PriorityQueue

/**
 * Keep track of some of the most relevant conflicts encountered during the search.
 *
 * Keep track of:
 * * The 10 conflicts that require the most added delay to be avoided
 * * The 10 conflicts that happened the closest to the destination
 *
 * The number of tracked conflicts may be parametrized.
 */
class FailureExplainer(
    val originalStartTime: ZonedDateTime,
    val rawInfra: RawInfra,
    val blockInfra: BlockInfra,
    maxLargestConflicts: Int = 10,
    maxClosestConflicts: Int = 10,
) {
    private val largestConflicts = SmallestNValues(maxLargestConflicts) { -it.timeLost }
    private val closestConflicts = SmallestNValues(maxClosestConflicts) { it.bestRemainingTime }

    /** Class to keep track of a given conflict, its node and some relevant data. */
    data class PendingConflict(
        val parentNode: STDCMNode,
        val timeLost: Double,
        val cause: RequirementId,
        val bestRemainingTime: Double,
    ) {
        private val nodeStr = parentNode.toString()

        fun generateReport(
            rawInfra: RawInfra,
            blockInfra: BlockInfra,
            originalStartTime: ZonedDateTime,
        ): ConflictReport {
            val remainingTime = parentNode.remainingTimeEstimation
            val travelTime = parentNode.timeData.totalRunningTime
            val geoPoint = parentNode.toGeoPoint(rawInfra, blockInfra)
            val trainPath = parentNode.infraExplorer.buildFullPath(rawInfra, blockInfra)
            val lastOPName =
                trainPath
                    .getOperationalPointParts()
                    .asSequence()
                    .mapNotNull { rawInfra.getOperationalPointPartProps(it.value)["name"] }
                    .lastOrNull()
            val geoLineString = trainPath.getGeo()
            val pathGeometry =
                RJSLineString(
                    "LineString",
                    geoLineString.getPoints().map { listOf(it.lon, it.lat) },
                )
            return ConflictReport(
                originalStartTime.plus(
                    Duration.ofSeconds(parentNode.timeData.earliestReachableTime.toLong())
                ),
                wrapDoubleForJson(timeLost),
                wrapDoubleForJson(remainingTime),
                travelTime,
                cause,
                geoPoint.lat,
                geoPoint.lon,
                lastOPName,
                pathGeometry,
            )
        }

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (javaClass != other?.javaClass) return false
            val other = other as PendingConflict
            return other.timeLost == timeLost && other.nodeStr == nodeStr && other.cause == cause
        }

        override fun hashCode(): Int {
            var result = timeLost.hashCode()
            result = 31 * result + nodeStr.hashCode()
            result = 31 * result + cause.hashCode()
            return result
        }
    }

    data class Report(
        @Json(name = "largest_conflicts") val largestConflicts: List<ConflictReport>,
        @Json(name = "closest_conflicts") val closestConflicts: List<ConflictReport>,
    ) {
        companion object {
            val adapter: JsonAdapter<Report> =
                Moshi.Builder()
                    .addLast(UnitAdapterFactory())
                    .addLast(KotlinJsonAdapterFactory())
                    .build()
                    .adapter(Report::class.java)
        }
    }

    /** Describes a given conflict in JSON format. Infinite values are converted into -1. */
    data class ConflictReport(
        val at: ZonedDateTime,
        @Json(name = "time_lost") val timeLost: Double,
        @Json(name = "best_remaining_time") val bestRemainingTime: Double,
        @Json(name = "current_travel_time") val currentTravelTime: Double,
        val source: RequirementId,
        val lat: Double,
        val lon: Double,
        val lastOPName: String?,
        @Json(name = "path_geometry") val pathGeometry: RJSLineString,
    )

    /** Register a new conflict. */
    fun conflictCallback(parentNode: STDCMNode, timeLost: Double, cause: RequirementId) {
        val pendingConflict =
            PendingConflict(parentNode, timeLost, cause, parentNode.remainingTimeEstimation)
        largestConflicts.register(pendingConflict)
        closestConflicts.register(pendingConflict)
    }

    /** Generates a JSON serializable report object. */
    fun makeReport(): Report {
        return Report(
            largestConflicts.list().map {
                it.generateReport(rawInfra, blockInfra, originalStartTime)
            },
            closestConflicts.list().map {
                it.generateReport(rawInfra, blockInfra, originalStartTime)
            },
        )
    }

    /**
     * Save the report, into the s3 if set, and into a JSON file if the env variable is set. If
     * neither is set, this does nothing.
     */
    fun saveReport(s3: S3Context?) {
        val report by lazy { Report.adapter.toJson(makeReport()) }
        val filename = System.getenv("STDCM_FAILURE_DATA_FILENAME")
        if (filename != null) {
            File(filename).writeText(report)
        }
        s3?.writeSTDCMFile("failure.json") { report }
    }
}

/** Convert values that can't be saved in JSON (NaN and infinite) into -1.0 */
private fun wrapDoubleForJson(x: Double): Double {
    return if (x.isInfinite() || x.isNaN()) -1.0 else x
}

/**
 * Keep track of the n smallest given values, according to the given comparator. Doesn't keep
 * duplicates.
 *
 * Expected complexity is O(log(n)) per insert if lower weight entries are uncommon (for example if
 * evenly distributed), O(n) otherwise.
 */
private class SmallestNValues(
    val n: Int,
    val getWeight: (FailureExplainer.PendingConflict) -> Double,
) {
    private val queue =
        PriorityQueue<FailureExplainer.PendingConflict>(
            Comparator.comparingDouble { -getWeight(it) }
        )

    fun register(value: FailureExplainer.PendingConflict) {
        val isFull = queue.size >= n
        if (isFull && getWeight(queue.peek()) <= getWeight(value)) return
        if (queue.contains(value)) return // duplicate
        if (isFull) queue.remove()
        queue.add(value)
    }

    fun list(): List<FailureExplainer.PendingConflict> {
        return queue.sortedBy { getWeight(it) }
    }
}
