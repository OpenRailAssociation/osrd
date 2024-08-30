package fr.sncf.osrd.railjson.parser;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope_sim.allowances.Allowance;
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSPowerRestrictionRange;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.sim_infra.api.PathProperties;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.ScheduledPoint;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainScheduleOptions;
import fr.sncf.osrd.utils.units.Distance;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

public class RJSStandaloneTrainScheduleParser {
    /** Parses a RailJSON standalone train schedule */
    public static StandaloneTrainSchedule parse(
            FullInfra infra,
            Function<String, RollingStock> rollingStockGetter,
            RJSStandaloneTrainSchedule rjsTrainSchedule,
            PathProperties trainPath,
            EnvelopeSimPath envelopeSimPath)
            throws OSRDError {
        var rollingStockID = rjsTrainSchedule.rollingStock;
        var rollingStock = rollingStockGetter.apply(rollingStockID);
        if (rollingStock == null) throw OSRDError.newUnknownRollingStockError(rollingStockID);

        var initialSpeed = rjsTrainSchedule.initialSpeed;
        if (Double.isNaN(initialSpeed) || initialSpeed < 0)
            throw new OSRDError(ErrorType.InvalidScheduleInvalidInitialSpeed);

        // Parse comfort
        var comfort = rjsTrainSchedule.comfort;

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
                if (rjsSchedulePoints.pathOffset < 0)
                    scheduledPoints.add(
                            new ScheduledPoint(Distance.toMeters(trainPath.getLength()), rjsSchedulePoints.time));
                else if (rjsSchedulePoints.pathOffset > Distance.toMeters(trainPath.getLength()))
                    throw new OSRDError(ErrorType.InvalidSchedulePoint);
                else scheduledPoints.add(new ScheduledPoint(rjsSchedulePoints.pathOffset, rjsSchedulePoints.time));
            }
        }

        var tag = rjsTrainSchedule.tag;
        var stops = RJSStopsParser.parse(rjsTrainSchedule.stops, infra.rawInfra(), trainPath);
        return new StandaloneTrainSchedule(
                rollingStock,
                initialSpeed,
                scheduledPoints,
                stops,
                allowances,
                tag,
                comfort,
                powerRestrictionMap,
                options);
    }

    private static double getPositiveDoubleOrDefault(double rjsInput, double defaultValue) {
        if (Double.isNaN(rjsInput) || rjsInput < 0) return defaultValue;
        return rjsInput;
    }

    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    private static Allowance parseAllowance(EnvelopeSimPath envelopeSimPath, RJSAllowance rjsAllowance)
            throws OSRDError {

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
            throw new OSRDError(ErrorType.UnknownAllowanceType);
        }
        // parse allowance distribution
        return switch (allowanceDistribution) {
            case MARECO -> new MarecoAllowance(
                    beginPos, endPos, getPositiveDoubleOrDefault(rjsAllowance.capacitySpeedLimit, 30 / 3.6), ranges);
            case LINEAR -> new LinearAllowance(
                    beginPos, endPos, getPositiveDoubleOrDefault(rjsAllowance.capacitySpeedLimit, 30 / 3.6), ranges);
        };
    }

    private static List<AllowanceRange> parseAllowanceRanges(
            EnvelopeSimPath envelopeSimPath, RJSAllowanceValue defaultValue, RJSAllowanceRange[] ranges)
            throws OSRDError {
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
            if (range.beginPos < lastEndPos) throw new OSRDError(ErrorType.InvalidScheduleOverlappingAllowanceRanges);
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

    private static AllowanceRange parseAllowanceRange(RJSAllowanceRange range) throws OSRDError {
        return new AllowanceRange(range.beginPos, range.endPos, parseAllowanceValue(range.value));
    }

    /** Parses the RJSAllowanceValue into an AllowanceValue */
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public static AllowanceValue parseAllowanceValue(RJSAllowanceValue rjsValue) throws OSRDError {
        if (rjsValue.getClass() == RJSAllowanceValue.TimePerDistance.class) {
            var rjsTimePerDist = (RJSAllowanceValue.TimePerDistance) rjsValue;
            if (Double.isNaN(rjsTimePerDist.minutes)) throw new OSRDError(ErrorType.InvalidScheduleMissingMinute);
            return new AllowanceValue.TimePerDistance(rjsTimePerDist.minutes);
        }
        if (rjsValue.getClass() == RJSAllowanceValue.Time.class) {
            var rjsFixedTime = (RJSAllowanceValue.Time) rjsValue;
            if (Double.isNaN(rjsFixedTime.seconds)) throw new OSRDError(ErrorType.InvalidScheduleMissingSeconds);
            return new AllowanceValue.FixedTime(rjsFixedTime.seconds);
        }
        if (rjsValue.getClass() == RJSAllowanceValue.Percent.class) {
            var rjsPercentage = (RJSAllowanceValue.Percent) rjsValue;
            if (Double.isNaN(rjsPercentage.percentage)) throw new OSRDError(ErrorType.InvalidScheduleMissingPercentage);
            return new AllowanceValue.Percentage(rjsPercentage.percentage);
        }

        throw new OSRDError(ErrorType.UnknownAllowanceValueType);
    }

    private static ImmutableRangeMap<Double, String> parsePowerRestrictionRanges(RJSPowerRestrictionRange[] ranges) {
        var builder = ImmutableRangeMap.<Double, String>builder();
        if (ranges == null) return builder.build();
        for (var range : ranges) {
            builder.put(Range.openClosed(range.beginPosition, range.endPosition), range.powerRestrictionCode);
        }
        return builder.build();
    }
}
