package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class RJSSimulationParser {
    /** Parse the description of a simulation */
    public static List<TrainSchedule> parse(
            Infra infra,
            RJSSimulation rjsSimulation
    ) throws InvalidSchedule, InvalidRollingStock {
        var rollingStocks = new HashMap<String, RollingStock>();
        for (var rjsRollingStock : rjsSimulation.rollingStocks) {
            var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);
            rollingStocks.put(rollingStock.id, rollingStock);
        }

        var schedules = new ArrayList<TrainSchedule>();
        for (var rjsSchedule : rjsSimulation.trainSchedules)
            schedules.add(RJSTrainScheduleParser.parse(infra, rollingStocks::get, rjsSchedule));
        return schedules;
    }
}
