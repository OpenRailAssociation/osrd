package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.train.TrainStop;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class RJSStopsParser {
    /** Parse a list of RJS stops given an infra and a path */
    public static List<TrainStop> parse(RJSTrainStop[] stops, Infra infra, TrainPath path)
            throws InvalidSchedule {
        var res = new ArrayList<TrainStop>();
        if (stops == null) {
            throw new InvalidSchedule("The train schedule must have at least one train stop");
        }
        for (var stop : stops) {
            if ((stop.position == null) == (stop.location == null))
                throw new InvalidSchedule("Train stop must specify exactly one of position or location");
            double position;
            if (stop.position != null)
                position = stop.position;
            else
                position = path.convertTrackLocation(RJSTrackLocationParser.parse(infra, stop.location));
            res.add(new TrainStop(position, stop.duration));
        }
        for (var stop : res)
            if (stop.position < 0)
                stop.position = path.length;
        res.sort(Comparator.comparingDouble(stop -> stop.position));
        return res;
    }

    /** Parse a list of RJS stops given an infra and a path */
    public static List<TrainStop> parseNew(RJSTrainStop[] stops, SignalingInfra infra, NewTrainPath path)
            throws InvalidSchedule {
        var res = new ArrayList<TrainStop>();
        if (stops == null) {
            throw new InvalidSchedule("The train schedule must have at least one train stop");
        }
        for (var stop : stops) {
            if ((stop.position == null) == (stop.location == null))
                throw new InvalidSchedule("Train stop must specify exactly one of position or location");
            double position;
            if (stop.position != null)
                position = stop.position;
            else
                position = path.convertTrackLocation(RJSTrackLocationParser.parseNew(infra, stop.location));
            res.add(new TrainStop(position, stop.duration));
        }
        for (var stop : res)
            if (stop.position < 0)
                stop.position = path.length();
        res.sort(Comparator.comparingDouble(stop -> stop.position));
        return res;
    }
}
