package fr.sncf.osrd.api;

import static fr.sncf.osrd.Helpers.loadExampleSimulationResource;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.takes.rq.RqFake;
import org.takes.rs.RsPrint;

public class SimulationTest extends ApiTest {
    @Test
    public void simple() throws Exception {
        var rjsSimulation = loadExampleSimulationResource(getClass(), "tiny_infra/simulation.json");
        var requestBody = SimulationEndpoint.adapterRequest.toJson(new SimulationEndpoint.SimulationRequest(
                "tiny_infra/infra.json",
                rjsSimulation.rollingStocks,
                rjsSimulation.trainSchedules
        ));
        var result = new RsPrint(
                new SimulationEndpoint(infraHandlerMock).act(new RqFake("POST", "/simulation", requestBody))
        ).printBody();

        var simResult =  SimulationEndpoint.adapterResult.fromJson(result);
        assert simResult != null;
        var trainResult = simResult.trains.get("Test.");
        var positions = trainResult.headPositions.toArray(new SimulationEndpoint.SimulationResultPosition[0]);
        for (int i = 1; i < positions.length; i++)
            assert positions[i - 1].time <= positions[i].time;
        positions = trainResult.tailPositions.toArray(new SimulationEndpoint.SimulationResultPosition[0]);
        for (int i = 1; i < positions.length; i++)
            assert positions[i - 1].time <= positions[i].time;
        var speeds = trainResult.speeds.toArray(new SimulationEndpoint.SimulationResultSpeed[0]);
        for (int i = 1; i < speeds.length; i++)
            assert speeds[i - 1].position <= speeds[i].position;
    }

    @Test
    public void oneSingleEndPhase() throws Exception {
        var rjsSimulation = loadExampleSimulationResource(getClass(), "tiny_infra/simulation.json");
        var requestBody = SimulationEndpoint.adapterRequest.toJson(new SimulationEndpoint.SimulationRequest(
                        "tiny_infra/infra.json",
                        rjsSimulation.rollingStocks,
                        rjsSimulation.trainSchedules
                ));
        var result = new RsPrint(
                new SimulationEndpoint(infraHandlerMock).act(new RqFake("POST", "/simulation", requestBody))
        ).printBody();

        var simResult =  SimulationEndpoint.adapterResult.fromJson(result);
        assert simResult != null;
        var trainResult = simResult.trains.get("Test.");
        assertEquals(1, trainResult.stopReaches.size());
    }
}
