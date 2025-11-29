package fr.sncf.osrd.api;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.cli.RqFake;
import java.io.IOException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

public class WorkerLoadingTest extends ApiTest {
    @ParameterizedTest
    @CsvSource({"true, 400", "false, 204"})
    public void infraLoadEndpoint_act_request_returns_correct_responses(boolean isRequestNull, int expectedStatusCode)
            throws IOException {
        var request = isRequestNull ? null : new WorkerLoadEndpoint.WorkerLoadRequest("tiny_infra/infra.json", 1, null);
        var requestBody = WorkerLoadEndpoint.adapterRequest.toJson(request);
        var response = new WorkerLoadEndpoint(infraManager, null).act(new RqFake(requestBody));
        assertEquals(expectedStatusCode, response.statusCode());
    }
}
