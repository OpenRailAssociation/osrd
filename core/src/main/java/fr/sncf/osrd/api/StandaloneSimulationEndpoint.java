package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;


public class StandaloneSimulationEndpoint implements Take {
    private final InfraManager infraManager;

    public static final JsonAdapter<StandaloneSimulationRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
            .build()
            .adapter(StandaloneSimulationRequest.class);

    public StandaloneSimulationEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    @Override
    public Response act(Request req) throws
            InvalidRollingStock,
            InvalidSchedule {
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra
            var infra = infraManager.load(request.infra, request.expectedVersion);

            // Parse rolling stocks
            var rollingStocks = new HashMap<String, RollingStock>();
            for (var rjsRollingStock : request.rollingStocks)
                rollingStocks.put(rjsRollingStock.id, RJSRollingStockParser.parse(rjsRollingStock));

            // Parse trainsPath
            var trainsPath = TrainPathBuilder.from(infra, request.trainsPath);
            var envelopePath = EnvelopeTrainPath.from(trainsPath);

            // Parse train schedules
            var trainSchedules = new ArrayList<StandaloneTrainSchedule>();
            for (var rjsTrainSchedule : request.trainSchedules)
                trainSchedules.add(RJSStandaloneTrainScheduleParser.parse(
                        infra, request.timeStep, rollingStocks::get, rjsTrainSchedule, trainsPath, envelopePath));

            // Compute envelopes and extract metadata
            var result = StandaloneSim.run(
                    infra,
                    request.trainsPath,
                    trainsPath,
                    trainSchedules,
                    request.timeStep
            );

            return new RsJson(new RsWithBody(StandaloneSimResult.adapter.toJson(result)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class StandaloneSimulationRequest {
        /** Infra id */
        public String infra;

        /** Infra version */
        @Json(name = "expected_version")
        public String expectedVersion;

        /** The time step which shall be used for all simulations */
        @Json(name = "time_step")
        public double timeStep;

        /** A list of rolling stocks involved in this simulation */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /** A list of trains plannings */
        @Json(name = "train_schedules")
        public List<RJSStandaloneTrainSchedule> trainSchedules;

        /** The path used by trains */
        @Json(name = "trains_path")
        public RJSTrainPath trainsPath;

        /** Create a default SimulationRequest */
        public StandaloneSimulationRequest() {
            infra = null;
            expectedVersion = null;
            timeStep = 2.0;
            rollingStocks = null;
            trainSchedules = null;
            trainsPath = null;
        }

        /** Create SimulationRequest */
        public StandaloneSimulationRequest(
                String infra,
                String expectedVersion,
                double timeStep,
                List<RJSRollingStock> rollingStocks,
                List<RJSStandaloneTrainSchedule> trainSchedules,
                RJSTrainPath trainsPath
        ) {
            this.infra = infra;
            this.expectedVersion = expectedVersion;
            this.timeStep = timeStep;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.trainsPath = trainsPath;
        }
    }
}

