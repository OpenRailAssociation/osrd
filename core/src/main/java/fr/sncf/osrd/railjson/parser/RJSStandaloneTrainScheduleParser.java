package fr.sncf.osrd.railjson.parser;

import static fr.sncf.osrd.railjson.parser.RJSRollingStockParser.parseComfort;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
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
import fr.sncf.osrd.train.ScheduledPoint;
import fr.sncf.osrd.train.TrainScheduleOptions;
import java.util.*;
import java.util.function.Function;

public class RJSStandaloneTrainScheduleParser {
    /** Parses a RailJSON standalone train schedule */
    public static StandaloneTrainSchedule parse(
            SignalingInfra infra,
            Function<String, RollingStock> rollingStockGetter,
            RJSStandaloneTrainSchedule rjsTrainSchedule,
            TrainPath trainPath,
            EnvelopeSimPath envelopeSimPath
    ) throws InvalidSchedule {
        var rollingStockID = rjsTrainSchedule.rollingStock;
        var rollingStock = rollingStockGetter.apply(rollingStockID);
        if (rollingStock == null)
            throw new UnknownRollingStock(rollingStockID);

        var initialSpeed = rjsTrainSchedule.initialSpeed;
        if (Double.isNaN(initialSpeed) || initialSpeed < 0)
            throw new InvalidSchedule("invalid initial speed");

        // Parse comfort
        var comfort = parseComfort(rjsTrainSchedule.comfort);

        // Parse options
        var options = new TrainScheduleOptions(rjsTrainSchedule.options);

        // parse power restrictions
        var powerRestrictionMap = parsePowerRestrictionRanges(rjsTrainSchedule.powerRestrictionRanges);

        // parse allowances
        var allowances = new ArrayList<Allowance>();
        if (rjsTrainSchedule.allowances != null)
            for (int i = 0; i < rjsTrainSchedule.allowances.length; i++) {
                var rjsAllowance = rjsTrainSchedule.allowances[i];
                allowances.add(parseAllowance(envelopeSimPath, rjsAllowance));
            }

        // parse timed waypoints
        var scheduledPoints = new ArrayList<ScheduledPoint>();
        if (rjsTrainSchedule.scheduledPoints != null) {
            for (var rjsSchedulePoints : rjsTrainSchedule.scheduledPoints) {
                if (rjsSchedulePoints.position < 0)
                    scheduledPoints.add(new ScheduledPoint(trainPath.length(), rjsSchedulePoints.time));
                else if (rjsSchedulePoints.position > trainPath.length())
                    throw new InvalidSchedule("invalid scheduled point: position greater that path length");
                else
                    scheduledPoints.add(new ScheduledPoint(rjsSchedulePoints.position, rjsSchedulePoints.time));
            }
        }

        var tag = rjsTrainSchedule.tag;
        var stops = RJSStopsParser.parse(rjsTrainSchedule.stops, infra, trainPath);
        return new StandaloneTrainSchedule(rollingStock, initialSpeed, scheduledPoints, stops, allowances, tag, comfort,
                powerRestrictionMap, options);
    }

    private static double getPositiveDoubleOrDefault(double rjsInput, double defaultValue) {
        if (Double.isNaN(rjsInput) || rjsInput < 0)
            return defaultValue;
        return rjsInput;
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static Allowance parseAllowance(
            EnvelopeSimPath envelopeSimPath,
            RJSAllowance rjsAllowance
    ) throws InvalidSchedule {

        var allowanceDistribution = rjsAllowance.distribution;
        double beginPos;
        double endPos;
        List<AllowanceRange> ranges;
        // parse allowance type
        if (rjsAllowance instanceof RJSAllowance.EngineeringAllowance engineeringAllowance) {
            beginPos = engineeringAllowance.beginPosition;
            endPos = Math.min(envelopeSimPath.length, engineeringAllowance.endPosition);
            ranges = List.of(new AllowanceRange(beginPos, endPos, parseAllowanceValue(engineeringAllowance.value)));
        } else if (rjsAllowance instanceof RJSAllowance.StandardAllowance standardAllowance) {
            beginPos = 0;
            endPos = envelopeSimPath.getLength();
            ranges = parseAllowanceRanges(envelopeSimPath, standardAllowance.defaultValue, standardAllowance.ranges);
        } else {
            throw new RuntimeException("unknown allowance type");
        }
        // parse allowance distribution
        return switch (allowanceDistribution) {
            case MARECO -> new MarecoAllowance(
                    beginPos,
                    endPos,
                    getPositiveDoubleOrDefault(rjsAllowance.capacitySpeedLimit, 30 / 3.6),
                    ranges
            );
            case LINEAR -> new LinearAllowance(
                    beginPos,
                    endPos,
                    getPositiveDoubleOrDefault(rjsAllowance.capacitySpeedLimit, 30 / 3.6),
                    ranges
            );
        };
    }

    private static List<AllowanceRange> parseAllowanceRanges(
            EnvelopeSimPath envelopeSimPath,
            RJSAllowanceValue defaultValue,
            RJSAllowanceRange[] ranges
    ) throws InvalidSchedule {
        var value = parseAllowanceValue(defaultValue);
        // if no ranges have been defined, just return the default value
        if (ranges == null || ranges.length == 0) {
            return List.of(new AllowanceRange(0, envelopeSimPath.getLength(), value));
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
        if (lastEndPos < envelopeSimPath.getLength())
            res.add(new AllowanceRange(lastEndPos, envelopeSimPath.getLength(), value));
        return res;
    }

    private static AllowanceRange parseAllowanceRange(RJSAllowanceRange range) throws InvalidSchedule {
        return new AllowanceRange(range.beginPos, range.endPos, parseAllowanceValue(range.value));
    }

    /** Parses the RJSAllowanceValue into an AllowanceValue */
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public static AllowanceValue parseAllowanceValue(RJSAllowanceValue rjsValue) throws InvalidSchedule {
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

    private static ImmutableRangeMap<Double, String> parsePowerRestrictionRanges(RJSPowerRestrictionRange[] ranges) {
        var builder = ImmutableRangeMap.<Double, String>builder();
        if (ranges == null)
            return builder.build();
        for (var range : ranges) {
            builder.put(Range.openClosed(range.beginPosition, range.endPosition), range.powerRestrictionCode);
        }
        return builder.build();
    }
}
