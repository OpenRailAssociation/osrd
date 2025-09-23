package fr.sncf.osrd.api;

import static fr.sncf.osrd.utils.takes.TakesUtils.readHeadResponse;
import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.takes.rq.RqFake;

public class WorkerLoadingTest extends ApiTest {
    @ParameterizedTest
    @CsvSource({"true, 400", "false, 204"})
    public void infraLoadEndpoint_act_request_returns_correct_responses(
            boolean isRequestNull, String expectedStatusCode) throws IOException {
        var request = isRequestNull ? null : new WorkerLoadEndpoint.WorkerLoadRequest("tiny_infra/infra.json", 1, null);
        var requestBody = WorkerLoadEndpoint.adapterRequest.toJson(request);
        var list = readHeadResponse(
                new WorkerLoadEndpoint(infraManager, null).act(new RqFake("POST", "/worker_load", requestBody)));
        assertTrue(list.get(0).contains(expectedStatusCode));
    }
}
