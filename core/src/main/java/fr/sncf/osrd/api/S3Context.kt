package fr.sncf.osrd.api

import io.opentelemetry.api.trace.Span
import java.net.URI
import software.amazon.awssdk.auth.credentials.EnvironmentVariableCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
import software.amazon.awssdk.services.s3.model.PutObjectRequest

data class S3Context(val s3Client: S3Client, val bucketName: String) {
    /** Write a new file for a given stdcm request. */
    fun writeSTDCMFile(fileName: String, content: String) {
        val traceId = Span.current().spanContext.traceId
        val putObjectRequest =
            PutObjectRequest.builder()
                .bucket(bucketName)
                .key("stdcm/requests/$traceId/$fileName")
                .build()

        s3Client.putObject(putObjectRequest, RequestBody.fromString(content))
    }

    /**
     * Write a new file for a given stdcm request, with a dedicated function to generate the
     * content. Used for safe call syntax (?.) that doesn't generate the data if the S3Context is
     * null
     */
    fun writeSTDCMFile(fileName: String, generateContent: () -> String) {
        writeSTDCMFile(fileName, generateContent())
    }

    /** Returns true if the file exists. */
    fun fileExists(fileName: String): Boolean {
        return try {
            val headRequest = HeadObjectRequest.builder().bucket(bucketName).key(fileName).build()
            s3Client.headObject(headRequest)
            true
        } catch (_: NoSuchKeyException) {
            false
        }
    }
}

/** Returns an S3 context (client + bucket name), or null if the env variables aren't set. */
fun makeS3Context(): S3Context? {
    val url = System.getenv("AWS_ENDPOINT_URL_S3") ?: return null
    val bucket = System.getenv("BUCKET_NAME") ?: return null
    if (url == "" || bucket == "") return null

    val s3Config =
        S3Configuration.builder().chunkedEncodingEnabled(false).pathStyleAccessEnabled(true).build()

    val s3Client =
        S3Client.builder()
            // A region needs to be set, but it's not used with an endpoint override
            .region(Region.EU_WEST_1)
            .credentialsProvider(EnvironmentVariableCredentialsProvider.create())
            .endpointOverride(URI.create(url))
            .serviceConfiguration(s3Config)
            .build()
    return S3Context(s3Client, bucket)
}
