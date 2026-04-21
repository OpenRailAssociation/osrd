package fr.sncf.osrd.api

import fr.sncf.osrd.api.WorkerLoadEndpoint.WorkerLoadRequest
import fr.sncf.osrd.cli.JSONTimetableReader
import fr.sncf.osrd.cli.RqFake
import java.io.IOException
import kotlinx.serialization.ExperimentalSerializationApi
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@OptIn(ExperimentalSerializationApi::class)
class WorkerLoadingTest : ApiTest() {
    @ParameterizedTest
    @CsvSource("true, 400", "false, 200")
    @Throws(IOException::class)
    fun infraLoadEndpoint_act_request_returns_correct_responses(
        isRequestNull: Boolean,
        expectedStatusCode: Int,
    ) {
        val request =
            if (isRequestNull) null else WorkerLoadRequest("tiny_infra/infra.json", 1, null)
        val requestBody = WorkerLoadEndpoint.adapterRequest.toJson(request)
        val dummyCacheManager = TimetableCacheManager(JSONTimetableReader(""), osrdGitDescribe = "")
        val response = WorkerLoadEndpoint(infraManager, dummyCacheManager).act(RqFake(requestBody))
        Assertions.assertEquals(expectedStatusCode, response.statusCode())
    }
}
