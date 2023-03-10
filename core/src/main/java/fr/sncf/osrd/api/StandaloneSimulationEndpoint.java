package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.DriverBehaviour;
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
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
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
import java.util.HashSet;
import java.util.List;


public class StandaloneSimulationEndpoint implements Take {
    private final InfraManager infraManager;

    private final ElectricalProfileSetManager electricalProfileSetManager;

    public static final JsonAdapter<StandaloneSimulationRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
            .build()
            .adapter(StandaloneSimulationRequest.class);

    public StandaloneSimulationEndpoint(InfraManager infraManager,
                                        ElectricalProfileSetManager electricalProfileSetManager) {
        this.infraManager = infraManager;
        this.electricalProfileSetManager = electricalProfileSetManager;
    }

    @Override
    public Response act(Request req) throws
            InvalidRollingStock,
            InvalidSchedule {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra
            var infra = infraManager.load(request.infra, request.expectedVersion, recorder);

            // load electrical profile set
            var electricalProfileMap = electricalProfileSetManager.getProfileMap(request.electricalProfileSet);

            // Parse rolling stocks
            var powerClasses = new HashSet<String>();
            var rollingStocks = new HashMap<String, RollingStock>();
            for (var rjsRollingStock : request.rollingStocks) {
                rollingStocks.put(rjsRollingStock.getID(), RJSRollingStockParser.parse(rjsRollingStock));
                powerClasses.add(rjsRollingStock.basePowerClass);
            }

            // Parse trainPath
            var trainPath = TrainPathBuilder.from(infra, request.trainsPath);
            var envelopePath = EnvelopeTrainPath.from(trainPath);

            if (electricalProfileMap.isPresent()) {
                envelopePath.setElectricalProfiles(
                        electricalProfileMap.get().getProfilesOnPath(trainPath, powerClasses));
            }

            // Parse train schedules
            var trainSchedules = new ArrayList<StandaloneTrainSchedule>();
            for (var rjsTrainSchedule : request.trainSchedules)
                trainSchedules.add(RJSStandaloneTrainScheduleParser.parse(
                        infra, request.timeStep, rollingStocks::get, rjsTrainSchedule, trainPath, envelopePath));

            // Compute envelopes and extract metadata
            DriverBehaviour driverBehaviour = new DriverBehaviour();
            var result = StandaloneSim.run(
                    infra,
                    trainPath,
                    envelopePath,
                    trainSchedules,
                    request.timeStep,
                    driverBehaviour
            );
            result.warnings = recorder.warnings;

            return new RsJson(new RsWithBody(StandaloneSimResult.adapter.toJson(result)));
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class StandaloneSimulationRequest {
        /**
         * Infra id
         */
        public String infra;

        /**
         * Electrical profile set id
         */
        @Json(name = "electrical_profile_set")
        public String electricalProfileSet;

        /**
         * Infra version
         */
        @Json(name = "expected_version")
        public String expectedVersion;

        /**
         * The time step which shall be used for all simulations
         */
        @Json(name = "time_step")
        public double timeStep;

        /**
         * A list of rolling stocks involved in this simulation
         */
        @Json(name = "rolling_stocks")
        public List<RJSRollingStock> rollingStocks;

        /**
         * A list of trains plannings
         */
        @Json(name = "train_schedules")
        public List<RJSStandaloneTrainSchedule> trainSchedules;

        /**
         * The path used by trains
         */
        @Json(name = "trains_path")
        public RJSTrainPath trainsPath;

        /**
         * Create a default SimulationRequest
         */
        public StandaloneSimulationRequest() {
            infra = null;
            electricalProfileSet = null;
            expectedVersion = null;
            timeStep = 2.0;
            rollingStocks = null;
            trainSchedules = null;
            trainsPath = null;
        }

        /**
         * Create SimulationRequest without  an electrical profile set selected
         */
        public StandaloneSimulationRequest(
                String infra,
                String expectedVersion,
                double timeStep,
                List<RJSRollingStock> rollingStocks,
                List<RJSStandaloneTrainSchedule> trainSchedules,
                RJSTrainPath trainsPath
        ) {
            this.infra = infra;
            this.electricalProfileSet = null;
            this.expectedVersion = expectedVersion;
            this.timeStep = timeStep;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.trainsPath = trainsPath;
        }

        /**
         * Create SimulationRequest with an electrical profile set selected
         */
        public StandaloneSimulationRequest(
                String infra,
                String electricalProfileSet,
                String expectedVersion,
                double timeStep,
                List<RJSRollingStock> rollingStocks,
                List<RJSStandaloneTrainSchedule> trainSchedules,
                RJSTrainPath trainsPath
        ) {
            this.infra = infra;
            this.electricalProfileSet = electricalProfileSet;
            this.expectedVersion = expectedVersion;
            this.timeStep = timeStep;
            this.rollingStocks = rollingStocks;
            this.trainSchedules = trainSchedules;
            this.trainsPath = trainsPath;
        }
    }
}

