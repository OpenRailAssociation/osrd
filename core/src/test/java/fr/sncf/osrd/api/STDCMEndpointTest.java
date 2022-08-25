package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.utils.takes.TakesUtils.readBodyResponse;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.api.stdcm.STDCMResponse;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import java.util.*;


public class STDCMEndpointTest extends ApiTest {

    @Test
    public void simpleEmptyTimetable() throws Exception {
        var requestBody = STDCMEndpoint.adapterRequest.toJson(new STDCMRequest(
                "tiny_infra/infra.json",
                "1",
                parseRollingStockDir(getResourcePath("rolling_stocks/")).get(0),
                Set.of(),
                Set.of(new PathfindingWaypoint(
                        "ne.micro.foo_b",
                        100,
                        EdgeDirection.START_TO_STOP
                )),
                Set.of(new PathfindingWaypoint(
                        "ne.micro.bar_a",
                        100,
                        EdgeDirection.START_TO_STOP
                )),
                0,
                0
        ));

        var result = readBodyResponse(
                new STDCMEndpoint(infraHandlerMock).act(
                        new RqFake("POST", "/stdcm", requestBody))
        );

        var response = STDCMResponse.adapter.fromJson(result);
        assert response != null;
        var routes = response.path.routePaths.stream()
                .map(route -> route.route.id.id)
                .toList();
        assertEquals(List.of(
                "rt.buffer_stop_b->tde.foo_b-switch_foo",
                "rt.tde.foo_b-switch_foo->buffer_stop_c"
        ), routes);
    }
}
