package fr.sncf.osrd.api

import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.net.URI
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import mu.KotlinLogging
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
import software.amazon.awssdk.services.s3.model.PutObjectRequest

val s3Logger = KotlinLogging.logger {}

/**
 * Wraps S3 data and operations into a more convenient class.
 *
 * Note: as this S3 is only used to generate data that helps with viewing and debugging, errors are
 * never critical. All operations are wrapped into try/catch blocks with error logging.
 *
 * Some functions take either [ByteArray] or [String] as input, the versions that aren't used have
 * been skipped but may be added later on.
 */
data class S3Context(
    val s3Client: S3Client,
    val bucketName: String,
    // Dispatchers.IO should dispatch tasks to different threads without blocking
    val asyncDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {

    /** Write a new file. */
    @WithSpan(value = "Writing S3 file", kind = SpanKind.SERVER)
    private fun writeFile(fileName: String, requestBody: RequestBody) {
        runAsync {
            try {
                s3Logger.info { "Writing $fileName" }
                val putObjectRequest =
                    PutObjectRequest.builder().bucket(bucketName).key(fileName).build()
                s3Client.putObject(putObjectRequest, requestBody)
            } catch (e: Exception) {
                s3Logger.error { e }
            }
        }
    }

    /** Write a new file for a given stdcm request. */
    private fun writeSTDCMFile(fileName: String, requestBody: RequestBody) {
        val traceId = Span.current().spanContext.traceId
        val path = "stdcm/requests/$traceId/$fileName"
        writeFile(path, requestBody)
    }

    /**
     * Write a new file for a given stdcm request, with a dedicated function to generate the
     * content. Used for safe call syntax (?.) that doesn't generate the data if the S3Context is
     * null. The generating method is also delegated to a distinct thread, this entire method call
     * is non-blocking.
     */
    fun writeSTDCMFile(fileName: String, generateContent: () -> String?) {
        runAsync { generateContent()?.let { writeSTDCMFile(fileName, RequestBody.fromString(it)) } }
    }

    /**
     * Write a new file with a dedicated function to generate the content. Check first that the file
     * isn't already on the s3, stop otherwise. The generating method may return null (e.g. when
     * some error happened), in which case nothing is uploaded.
     */
    fun writeFileIfMissing(fileName: String, generateContent: () -> ByteArray?) {
        runAsync {
            if (!fileExists(fileName)) {
                generateContent()?.let { writeFile(fileName, RequestBody.fromBytes(it)) }
            }
        }
    }

    /** Returns true if the file exists. */
    fun fileExists(fileName: String): Boolean {
        return try {
            val headRequest = HeadObjectRequest.builder().bucket(bucketName).key(fileName).build()
            s3Client.headObject(headRequest)
            true
        } catch (_: NoSuchKeyException) {
            false
        } catch (e: Exception) {
            s3Logger.error { e }
            false
        }
    }

    /**
     * Run an async task in a "fire and forger" way. Used to write files to the s3 when we don't
     * need to wait for it to finish nor verify that it worked.
     */
    fun runAsync(func: suspend () -> Unit) {
        CoroutineScope(asyncDispatcher).launch { func() }
    }
}

/** Returns an S3 context (client + bucket name), or null if the env variables aren't set. */
fun makeS3Context(): S3Context? {
    val url = System.getenv("AWS_ENDPOINT_URL_S3")
    val bucket = System.getenv("BUCKET_NAME")
    if (bucket == null || bucket == "") {
        s3Logger.info {
            "s3 env variables are not set, not using it: AWS_ENDPOINT_URL_S3=$url, BUCKET_NAME=$bucket"
        }
        return null
    }

    val s3Config =
        S3Configuration.builder().chunkedEncodingEnabled(false).pathStyleAccessEnabled(true).build()

    val s3Builder = S3Client.builder().region(Region.EU_WEST_3).serviceConfiguration(s3Config)
    if (url != null && url != "") {
        s3Builder.endpointOverride(URI.create(url))
    }
    val s3Client = s3Builder.build()
    return S3Context(s3Client, bucket)
}
