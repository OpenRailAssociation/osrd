package fr.sncf.osrd.railjson.parser;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.*;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

public class RJSStandaloneTrainScheduleParser {
    /** Parses a RailJSON standalone train schedule */
    public static StandaloneTrainSchedule parse(
            SignalingInfra infra,
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

        var stops = RJSStopsParser.parse(rjsTrainSchedule.stops, infra, trainPath);

        var initialSpeed = rjsTrainSchedule.initialSpeed;
        if (Double.isNaN(initialSpeed) || initialSpeed < 0)
            throw new InvalidSchedule("invalid initial speed");

        // parse allowances
        var allowances = new ArrayList<Allowance>();
        if (rjsTrainSchedule.allowances != null)
            for (int i = 0; i < rjsTrainSchedule.allowances.length; i++) {
                var rjsAllowance = rjsTrainSchedule.allowances[i];
                allowances.add(
                        parseAllowance(timeStep, rollingStock, envelopePath, rjsAllowance)
                );
            }

        return new StandaloneTrainSchedule(rollingStock, initialSpeed, stops, allowances);
    }

    private static double getPositiveDoubleOrDefault(double rjsInput, double defaultValue) {
        if (Double.isNaN(rjsInput) || rjsInput < 0)
            return defaultValue;
        return rjsInput;
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static Allowance parseAllowance(
            double timeStep,
            RollingStock rollingStock,
            EnvelopePath envelopePath,
            RJSAllowance rjsAllowance
    ) throws InvalidSchedule {

        var allowanceDistribution = rjsAllowance.distribution;
        double beginPos;
        double endPos;
        List<AllowanceRange> ranges;
        // parse allowance type
        if (rjsAllowance instanceof RJSAllowance.EngineeringAllowance engineeringAllowance) {
            beginPos = engineeringAllowance.beginPosition;
            endPos = Math.min(envelopePath.length, engineeringAllowance.endPosition);
            ranges = List.of(new AllowanceRange(beginPos, endPos, parseAllowanceValue(engineeringAllowance.value)));
        } else if (rjsAllowance instanceof RJSAllowance.StandardAllowance standardAllowance) {
            beginPos = 0;
            endPos = envelopePath.getLength();
            ranges = parseAllowanceRanges(envelopePath, standardAllowance.defaultValue, standardAllowance.ranges);
        } else {
            throw new RuntimeException("unknown allowance type");
        }
        // parse allowance distribution
        if (allowanceDistribution == RJSAllowanceDistribution.MARECO) {
            return new MarecoAllowance(
                    new EnvelopeSimContext(rollingStock, envelopePath, timeStep),
                    beginPos,
                    endPos,
                    getPositiveDoubleOrDefault(rjsAllowance.capacitySpeedLimit, 30 / 3.6),
                    ranges
            );
        }
        if (allowanceDistribution == RJSAllowanceDistribution.LINEAR) {
            return new LinearAllowance(
                    new EnvelopeSimContext(rollingStock, envelopePath, timeStep),
                    beginPos,
                    endPos,
                    getPositiveDoubleOrDefault(rjsAllowance.capacitySpeedLimit, 30 / 3.6),
                    ranges
            );
        }
        throw new RuntimeException("unknown allowance distribution");
    }

    private static List<AllowanceRange> parseAllowanceRanges(
            EnvelopePath envelopePath,
            RJSAllowanceValue defaultValue,
            RJSAllowanceRange[] ranges
    ) throws InvalidSchedule {
        var value = parseAllowanceValue(defaultValue);
        // if no ranges have been defined, just return the default value
        if (ranges == null || ranges.length == 0) {
            return List.of(new AllowanceRange(0, envelopePath.getLength(), value));
        }

        // sort the range list by begin position
        var sortedRanges = Arrays.stream(ranges)
                .sorted(Comparator.comparingDouble(range -> range.beginPos))
                .toList();
        var res = new ArrayList<AllowanceRange>();
        var lastEndPos = 0.0;
        for (var range : sortedRanges) {
            // if some ranges are overlapping, return an error
            if (range.beginPos < lastEndPos)
                throw new InvalidSchedule("overlapping allowance ranges");
            // if there is a gap between two ranges, fill it with default value
            if (range.beginPos > lastEndPos) {
                res.add(new AllowanceRange(lastEndPos, range.beginPos, value));
            }
            lastEndPos = range.endPos;
            res.add(parseAllowanceRange(range));
        }
        if (lastEndPos < envelopePath.getLength())
            res.add(new AllowanceRange(lastEndPos, envelopePath.getLength(), value));
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
