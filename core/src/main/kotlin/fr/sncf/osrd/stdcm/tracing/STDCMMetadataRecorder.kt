package fr.sncf.osrd.stdcm.tracing

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.S3Context
import fr.sncf.osrd.api.stdcm.STDCMRequest
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import io.opentelemetry.api.trace.Span
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Sets a span attribute, and records the value in the STDCM metadata file saved in osrd s3. The
 * purpose of the generated file is to keep any data that we'd like to inspect and run statistics
 * on.
 */
fun recordSTDCMMetadata(key: String, value: Any?) {
    STDCMMetadataRecorder.current()?.put(key, value)
    val span = Span.current()
    when (value) {
        null -> {}
        is String -> span.setAttribute(key, value)
        is Boolean -> span.setAttribute(key, value)
        is Int -> span.setAttribute(key, value.toLong())
        is Long -> span.setAttribute(key, value)
        is Number -> span.setAttribute(key, value.toDouble())
        else -> span.setAttribute(key, value.toString())
    }
}

/**
 * Request-scoped metadata, made accessible through a `ScopedValue`. The whole file is re-written on
 * each flush, so that early data is saved even if the request crashes or gets interrupted.
 */
class STDCMMetadataRecorder private constructor(private val s3Context: S3Context?) {
    private val data = ConcurrentHashMap<String, Any>()
    private val writeLock = Mutex()
    private val path = "stdcm/requests/${Span.current().spanContext.traceId}/core_metadata.json"

    fun put(key: String, value: Any?) {
        if (value != null) data[key] = value
    }

    /**
     * Writes the current data. Writes are serialized, an older snapshot never overrides a newer
     * one.
     */
    fun writeFile() {
        val s3 = s3Context ?: return
        s3.runAsync { writeLock.withLock { s3.writeFileSync(path, adapter.toJson(data)) } }
    }

    companion object {
        private val CURRENT: ScopedValue<STDCMMetadataRecorder> = ScopedValue.newInstance()

        fun current(): STDCMMetadataRecorder? = if (CURRENT.isBound) CURRENT.get() else null

        /** Runs the block with a new recorder bound as current, writes the file at the end. */
        fun <T> withNewRecorder(s3Context: S3Context?, block: () -> T): T {
            val recorder = STDCMMetadataRecorder(s3Context)
            return ScopedValue.where(CURRENT, recorder).call<T, RuntimeException> {
                try {
                    block()
                } finally {
                    recorder.writeFile()
                }
            }
        }

        private val adapter: JsonAdapter<Map<String, Any>> =
            Moshi.Builder()
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(
                    Types.newParameterizedType(
                        Map::class.java,
                        String::class.java,
                        Any::class.java,
                    ),
                )
    }
}

fun recordSTDCMInputMetadata(payload: STDCMRequest) {
    recordSTDCMMetadata("infra_id", payload.infra)
    recordSTDCMMetadata("timetable_id", payload.timetableId)
    recordSTDCMMetadata("temporary_speed_limit_count", payload.temporarySpeedLimits.size)
    recordSTDCMMetadata("work_schedule_count", payload.workSchedules.size)
    recordSTDCMMetadata("allowed_track_section_count", payload.allowedTrackSections.count())
    recordSTDCMMetadata("forced_op_stop_count", payload.forcedOpStops.count())
    recordSTDCMMetadata("max_run_time", payload.maximumRunTime.seconds)

    val recorder = STDCMMetadataRecorder.current() ?: return

    // Too large for span attributes
    recorder.put("path_items", payload.pathItems)

    recorder.writeFile()
}
