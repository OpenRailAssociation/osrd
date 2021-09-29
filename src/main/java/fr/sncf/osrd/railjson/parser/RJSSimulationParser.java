package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra_state.regulator.TrainSuccessionTable;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.parser.exceptions.MissingSuccessionTableField;
import fr.sncf.osrd.railjson.schema.schedule.RJSVirtualPoint;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import java.util.*;

public class RJSSimulationParser {
    /** Parse a simulation manifest, without any extra rolling stocks */
    public static List<TrainSchedule> parse(
            Infra infra,
            RJSSimulation rjsSimulation
    ) throws InvalidSchedule, InvalidRollingStock {
        return parse(infra, rjsSimulation, new TreeMap<>(), null);
    }

    public static List<TrainSchedule> parse(
            Infra infra,
            RJSSimulation rjsSimulation,
            Map<String, RollingStock> extraRollingStocks
    ) throws InvalidSchedule, InvalidRollingStock {
        return parse(infra, rjsSimulation, extraRollingStocks, null);
    }

    /** Parse a simulation manifest */
    public static List<TrainSchedule> parse(
            Infra infra,
            RJSSimulation rjsSimulation,
            Map<String, RollingStock> extraRollingStocks,
            List<RJSVirtualPoint> virtualPoints
    ) throws InvalidSchedule, InvalidRollingStock {
        var rollingStocks = new HashMap<String, RollingStock>();
        rollingStocks.putAll(extraRollingStocks);
        for (var rjsRollingStock : rjsSimulation.rollingStocks) {
            var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);
            rollingStocks.put(rollingStock.id, rollingStock);
        }

        var schedules = new ArrayList<TrainSchedule>();
        for (var rjsSchedule : rjsSimulation.trainSchedules)
            schedules.add(RJSTrainScheduleParser.parse(infra, rollingStocks::get, rjsSchedule, virtualPoints));
        RJSTrainScheduleParser.resolveScheduleDependencies(rjsSimulation.trainSchedules, schedules);
        return schedules;
    }

    /** Parses succession tables */
    public static List<TrainSuccessionTable> parseTrainSuccessionTables(
            RJSSimulation rjsSimulation
    ) throws InvalidSuccession {
        var results = new ArrayList<TrainSuccessionTable>();
        if (rjsSimulation.trainSuccessionTables == null)
            return results;

        for (var rjsTrainSuccessionTable : rjsSimulation.trainSuccessionTables) {
            if (rjsTrainSuccessionTable.switchID == null)
                throw new MissingSuccessionTableField("switch");

            if (rjsTrainSuccessionTable.trainOrder == null)
                throw new MissingSuccessionTableField("train_order");

            var trainOrder = new ArrayDeque<>(Arrays.asList(rjsTrainSuccessionTable.trainOrder));
            results.add(new TrainSuccessionTable(rjsTrainSuccessionTable.switchID, trainOrder));
        }
        return results;
    }
}