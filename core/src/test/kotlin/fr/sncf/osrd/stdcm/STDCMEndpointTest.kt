package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.utils.Helpers.getExampleRollingStock
import fr.sncf.osrd.utils.takes.TakesUtils
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.takes.rq.RqFake

class STDCMEndpointTest : ApiTest() {
    @Test
    @Throws(Exception::class)
    fun simpleEmptyTimetable() {
        val requestBody =
            STDCMRequest.adapter.toJson(
                STDCMRequest(
                    "tiny_infra/infra.json",
                    "1",
                    getExampleRollingStock("fast_rolling_stock.json"),
                    setOf(),
                    listOf(
                        STDCMRequest.STDCMStep(
                            0.0,
                            true,
                            setOf(
                                PathfindingWaypoint(
                                    "ne.micro.foo_b",
                                    100.0,
                                    EdgeDirection.START_TO_STOP
                                )
                            )
                        ),
                        STDCMRequest.STDCMStep(
                            0.0,
                            true,
                            setOf(
                                PathfindingWaypoint(
                                    "ne.micro.bar_a",
                                    100.0,
                                    EdgeDirection.START_TO_STOP
                                )
                            )
                        )
                    ),
                    0.0,
                    0.0,
                    "foo",
                    0.0,
                    0.0,
                    (12 * 3600).toDouble()
                )
            )
        val result =
            TakesUtils.readBodyResponse(
                STDCMEndpoint(infraManager).act(RqFake("POST", "/stdcm", requestBody))
            )
        val response = STDCMResponse.adapter.fromJson(result)!!
        val routes =
            response.path.routePaths.stream().map { route: RJSRoutePath? -> route!!.route }.toList()
        Assertions.assertEquals(
            listOf(
                "rt.buffer_stop_b->tde.foo_b-switch_foo",
                "rt.tde.foo_b-switch_foo->buffer_stop_c"
            ),
            routes
        )
    }
}
