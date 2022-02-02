package fr.sncf.osrd.railjson.parser;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.train.*;
import java.util.ArrayList;
import java.util.function.Function;

public class RJSStandaloneTrainScheduleParser {
    /** Parses a RailJSON standalone train schedule */
    public static StandaloneTrainSchedule parse(
            Infra infra,
            double timeStep,
            Function<String, RollingStock> rollingStockGetter,
            RJSStandaloneTrainSchedule rjsTrainSchedule,
            TrainPath trainPath,
            EnvelopePath envelopePath
    ) throws InvalidSchedule {
        var rollingStockID = rjsTrainSchedule.rollingStock;
        var rollingStock = rollingStockGetter.apply(rollingStockID);
        if (rollingStock == null)
            throw new UnknownRollingStock(rollingStockID);

        var stops = (ArrayList<TrainStop>) RJSStopsParser.parse(rjsTrainSchedule.stops, infra, trainPath);

        var initialSpeed = rjsTrainSchedule.initialSpeed;
        if (Double.isNaN(initialSpeed) || initialSpeed < 0)
            throw new InvalidSchedule("invalid initial speed");

        // parse allowances
        var allowances = new ArrayList<MarecoAllowance>();
        if (rjsTrainSchedule.allowances != null)
            for (var rjsAllowance : rjsTrainSchedule.allowances)
                allowances.add(parseAllowance(timeStep, rollingStock, envelopePath, rjsAllowance));

        return new StandaloneTrainSchedule(rollingStock, initialSpeed, stops, allowances);
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static MarecoAllowance parseAllowance(
            double timeStep,
            RollingStock rollingStock,
            EnvelopePath envelopePath,
            RJSAllowance rjsAllowance
    ) throws InvalidSchedule {
        if (rjsAllowance.getClass() == RJSAllowance.Construction.class) {
            var rjsConstruction = (RJSAllowance.Construction) rjsAllowance;
            if (Double.isNaN(rjsConstruction.beginPosition))
                throw new InvalidSchedule("missing construction allowance begin_position");
            if (Double.isNaN(rjsConstruction.endPosition))
                throw new InvalidSchedule("missing construction allowance end_position");
            return new MarecoAllowance(
                    rollingStock, envelopePath, timeStep,
                    rjsConstruction.beginPosition, rjsConstruction.endPosition,
                    30 / 3.6,
                    parseAllowanceValue(rjsConstruction.value)
            );
        }
        if (rjsAllowance.getClass() == RJSAllowance.Mareco.class) {
            var rjsMareco = (RJSAllowance.Mareco) rjsAllowance;
            if (rjsMareco.ranges != null && rjsMareco.ranges.length > 0)
                throw new InvalidSchedule("mareco value ranges aren't yet implemented");
            if (rjsMareco.defaultValue == null)
                throw new InvalidSchedule("missing mareco default_value");
            return new MarecoAllowance(
                    rollingStock, envelopePath, timeStep,
                    0, envelopePath.getLength(),
                    0,
                    parseAllowanceValue(rjsMareco.defaultValue)
            );
        }

        throw new RuntimeException("unknown allowance type");
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static AllowanceValue parseAllowanceValue(RJSAllowanceValue rjsValue) throws InvalidSchedule {
        if (rjsValue.getClass() == RJSAllowanceValue.TimePerDistance.class) {
            var rjsTimePerDist = (RJSAllowanceValue.TimePerDistance) rjsValue;
            if (Double.isNaN(rjsTimePerDist.minutes))
                throw new InvalidSchedule("missing minutes in time per distance allowance");
            return new AllowanceValue.TimePerDistance(rjsTimePerDist.minutes);
        }
        if (rjsValue.getClass() == RJSAllowanceValue.Time.class) {
            var rjsFixedTime = (RJSAllowanceValue.Time) rjsValue;
            if (Double.isNaN(rjsFixedTime.seconds))
                throw new InvalidSchedule("missing seconds in time allowance");
            return new AllowanceValue.FixedTime(rjsFixedTime.seconds);
        }
        if (rjsValue.getClass() == RJSAllowanceValue.Percent.class) {
            var rjsPercentage = (RJSAllowanceValue.Percent) rjsValue;
            if (Double.isNaN(rjsPercentage.percentage))
                throw new InvalidSchedule("missing percentage in percentage allowance");
            return new AllowanceValue.Percentage(rjsPercentage.percentage);
        }

        throw new RuntimeException("unknown allowance value type");
    }
}
