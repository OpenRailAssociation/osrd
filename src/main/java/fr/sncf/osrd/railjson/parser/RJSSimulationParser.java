package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.railjson.schema.schedule.RJSVirtualPoint;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

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
        return schedules;
    }
}
