package fr.sncf.osrd.railjson.parser;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.*;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.train.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

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
        var allowances = new ArrayList<HardenedMarecoAllowance>();
        if (rjsTrainSchedule.allowances != null)
            for (int i = 0; i < rjsTrainSchedule.allowances.length; i++)
                allowances.add(parseAllowance(timeStep, rollingStock, envelopePath, rjsTrainSchedule.allowances[i]));

        return new StandaloneTrainSchedule(rollingStock, initialSpeed, stops, allowances);
    }

    private static double getPositiveDoubleOrDefault(double rjsInput, double defaultValue) {
        if (Double.isNaN(rjsInput) || rjsInput < 0)
            return defaultValue;
        return rjsInput;
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static HardenedMarecoAllowance parseAllowance(
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
            return new HardenedMarecoAllowance(
                    new EnvelopeSimContext(rollingStock, envelopePath, timeStep),
                    rjsConstruction.beginPosition, rjsConstruction.endPosition,
                    getPositiveDoubleOrDefault(rjsConstruction.capacitySpeedLimit, 30 / 3.6),
                    List.of(
                            new AllowanceRange(
                                    rjsConstruction.beginPosition,
                                    rjsConstruction.endPosition,
                                    parseAllowanceValue(rjsConstruction.value)
                            )
                    )
            );
        }
        if (rjsAllowance.getClass() == RJSAllowance.Mareco.class) {
            var rjsMareco = (RJSAllowance.Mareco) rjsAllowance;
            if (rjsMareco.defaultValue == null)
                throw new InvalidSchedule("missing mareco default_value");
            return new HardenedMarecoAllowance(
                    new EnvelopeSimContext(rollingStock, envelopePath, timeStep),
                    0, envelopePath.getLength(),
                    getPositiveDoubleOrDefault(rjsMareco.capacitySpeedLimit, 30 / 3.6),
                    parseAllowanceRanges(envelopePath, rjsMareco.defaultValue, rjsMareco.ranges)
            );
        }

        throw new RuntimeException("unknown allowance type");
    }

    private static List<AllowanceRange> parseAllowanceRanges(
            EnvelopePath envelopePath,
            RJSAllowanceValue defaultValue,
            RJSAllowanceRange[] ranges
    ) throws InvalidSchedule {
        // if no ranges have been defined, just return the default value
        if (ranges == null || ranges.length == 0) {
            return List.of(new AllowanceRange(0, envelopePath.getLength(), parseAllowanceValue(defaultValue)));
        }

        // sort the range list by begin position
        var sortedRanges = Arrays.stream(ranges)
                        .sorted(Comparator.comparingDouble(range -> range.beginPos))
                        .collect(Collectors.toList());
        var res = new ArrayList<AllowanceRange>();
        var lastEndPos = 0.0;
        for (var range : sortedRanges) {
            // if some ranges are overlapping, return an error
            if (range.beginPos < lastEndPos)
                throw new InvalidSchedule("overlapping allowance ranges");
            // if there is a gap between two ranges, fill it with default value
            if (range.beginPos > lastEndPos) {
                res.add(new AllowanceRange(lastEndPos, range.beginPos, parseAllowanceValue(defaultValue)));
            }
            lastEndPos = range.endPos;
            res.add(parseAllowanceRange(range));
        }
        if (lastEndPos < envelopePath.getLength())
            res.add(new AllowanceRange(lastEndPos, envelopePath.getLength(), parseAllowanceValue(defaultValue)));
        return res;
    }

    private static AllowanceRange parseAllowanceRange(RJSAllowanceRange range) throws InvalidSchedule {
        return new AllowanceRange(range.beginPos, range.endPos, parseAllowanceValue(range.value));
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static AllowanceValue parseAllowanceValue(RJSAllowanceValue rjsValue) throws InvalidSchedule {
        if (rjsValue.getClass() == RJSAllowanceValue.TimePerDistance.class) {
            var rjsTimePerDist = (RJSAllowanceValue.TimePerDistance) rjsValue;
            if (Double.isNaN(rjsTimePerDist.minutes))
                throw new InvalidSchedule("missing minutes in time per distance allowance");
            return new AllowanceValue.TimePerDistance(AllowanceDistribution.DISTANCE_RATIO, rjsTimePerDist.minutes);
        }
        if (rjsValue.getClass() == RJSAllowanceValue.Time.class) {
            var rjsFixedTime = (RJSAllowanceValue.Time) rjsValue;
            if (Double.isNaN(rjsFixedTime.seconds))
                throw new InvalidSchedule("missing seconds in time allowance");
            return new AllowanceValue.FixedTime(AllowanceDistribution.TIME_RATIO, rjsFixedTime.seconds);
        }
        if (rjsValue.getClass() == RJSAllowanceValue.Percent.class) {
            var rjsPercentage = (RJSAllowanceValue.Percent) rjsValue;
            if (Double.isNaN(rjsPercentage.percentage))
                throw new InvalidSchedule("missing percentage in percentage allowance");
            return new AllowanceValue.Percentage(AllowanceDistribution.TIME_RATIO, rjsPercentage.percentage);
        }

        throw new RuntimeException("unknown allowance value type");
    }
}
