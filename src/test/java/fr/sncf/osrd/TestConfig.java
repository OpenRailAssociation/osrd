package fr.sncf.osrd;

import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.Helpers.runSimulation;
import static fr.sncf.osrd.config.Config.parseExtraRollingStocks;
import static fr.sncf.osrd.infra.Infra.parseRailJSONFromFile;
import static org.junit.jupiter.api.Assertions.fail;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.RJSSuccessionsParser;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.RJSSuccessions;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.moshi.MoshiUtils;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;


public class TestConfig {
    public RJSInfra rjsInfra;
    public RJSSimulation rjsSimulation;
    public RJSSuccessions rjsSuccessions;
    public ChangeConsumer changeConsumer = null;
    public HashMap<String, RollingStock> extraRollingStocks;
    public float timeStep = 1;

    private TestConfig(
            RJSInfra rjsInfra,
            RJSSimulation rjsSimulation,
            RJSSuccessions rjsSuccessions,
            HashMap<String, RollingStock> extraRollingStocks
    ) {
        this.rjsInfra = rjsInfra;
        this.rjsSimulation = rjsSimulation;
        this.rjsSuccessions = rjsSuccessions;
        this.extraRollingStocks = extraRollingStocks;
    }

    public TestConfig withChangeConsumer(ChangeConsumer consumer) {
        this.changeConsumer = consumer;
        return this;
    }

    /** Read the configuration and associated files at the given resource path */
    public static TestConfig readResource(String resourceConfigPath) {
        return read(getResourcePath(resourceConfigPath));
    }

    /** Read the configuration at the given path, as well as the associated resources */
    public static TestConfig read(Path configPath) {
        try {
            var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, configPath);

            var baseDirPath = configPath.getParent();

            var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
            var infra = parseRailJSONFromFile(jsonConfig.infraType, infraPath.toString());

            var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
            var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

            RJSSuccessions successions = null;
            if (jsonConfig.successionPath != null) {
                var successionPath = PathUtils.relativeTo(baseDirPath, jsonConfig.successionPath);
                successions = MoshiUtils.deserialize(RJSSuccessions.adapter, successionPath);
            }

            var extraRollingStocks = new HashMap<String, RollingStock>();
            if (jsonConfig.extraRollingStockDirs != null) {
                for (var extraRollingStockDir : jsonConfig.extraRollingStockDirs) {
                    var extraRollingStocksPath = PathUtils.relativeTo(baseDirPath, extraRollingStockDir);
                    parseExtraRollingStocks(extraRollingStocks, extraRollingStocksPath);
                }
            }
            return new TestConfig(infra, schedule, successions, extraRollingStocks);
        } catch (RuntimeException e) {
            fail(e);
            return null;  // appease the compiler
        } catch (Exception e) {
            fail(e);
            return null;  // appease the compiler
        }
    }

    /** Remove all allowances from the given configuration */
    public TestConfig clearAllowances() {
        for (var schedule : rjsSimulation.trainSchedules)
            schedule.allowances = new RJSAllowance[][] {};
        return this;
    }

    /** Remove all schedules */
    public TestConfig clearSchedules() {
        rjsSimulation.trainSchedules = new ArrayList<>();
        return this;
    }

    public TestConfig setAllAllowances(RJSAllowance allowance) {
        return setAllAllowances(new RJSAllowance[][] { { allowance } });
    }

    /** Set the allowances of all trains to the given specification */
    public TestConfig setAllAllowances(RJSAllowance[][] allowances) {
        for (var trainSchedule : rjsSimulation.trainSchedules)
            trainSchedule.allowances = allowances;
        return this;
    }

    public static final class TestSimulationState {
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public final Infra infra;
        public final List<TrainSchedule> schedules;
        public final Config config;
        public final Simulation sim;
        public ArrayList<TimelineEvent> events = null;

        TestSimulationState(
                Infra infra,
                List<TrainSchedule> schedules,
                Config config,
                Simulation sim
        ) {
            this.infra = infra;
            this.schedules = schedules;
            this.config = config;
            this.sim = sim;
        }

        public ArrayList<TimelineEvent> runWithExceptions() throws SimulationError {
            return Helpers.runWithExceptions(sim, config);
        }

        public ArrayList<TimelineEvent> run() {
            events = runSimulation(sim, config);
            return events;
        }
    }

    /** Parse the configuration, and return a package that is ready for execution */
    public TestSimulationState prepare() {
        try {
            var infra = RailJSONParser.parse(rjsInfra);

            var trainSchedules = RJSSimulationParser.parse(infra, rjsSimulation, extraRollingStocks);
            var config = new Config(
                    timeStep,
                    infra,
                    trainSchedules,
                    null,
                    0,
                    false,
                    false,
                    true
            );

            Simulation sim;
            if (this.rjsSuccessions == null)
                sim = Simulation.createFromInfraAndEmptySuccessions(infra, 0, changeConsumer);
            else {
                var succession = RJSSuccessionsParser.parse(rjsSuccessions);
                sim = Simulation.createFromInfraAndSuccessions(infra, succession, 0, null);
            }
            return new TestSimulationState(infra, trainSchedules, config, sim);
        } catch (InvalidInfraException | InvalidSuccession | InvalidSchedule | InvalidRollingStock e) {
            fail(e);
            return null;  // appeasing the compiler: this line will never be executed.
        }
    }

    public ArrayList<TimelineEvent> run() {
        return prepare().run();
    }
}
