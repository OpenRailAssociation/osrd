package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.envelope_utils.DoubleUtils.clamp;
import static fr.sncf.osrd.utils.UnitEqualityKt.arePositionsEqual;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeInterpolate;
import fr.sncf.osrd.train.TrainStop;
import java.util.ArrayList;
import java.util.List;
import org.jetbrains.annotations.Nullable;

/** Wraps an envelope with stops, to include the stop durations when getting the time at any point.
 * When getting the time at an exact stop location, the stop *is included*. */
public class EnvelopeStopWrapper implements EnvelopeInterpolate {
    public final EnvelopeInterpolate envelope;
    public final List<TrainStop> stops;

    public EnvelopeStopWrapper(EnvelopeInterpolate envelope, List<TrainStop> stops) {
        this.envelope = envelope;
        this.stops = stops;
    }

    private double interpolate(double position, boolean isArrivalAt) {
        double stopTime = 0;
        for (var stop : stops) {
            if (arePositionsEqual(stop.position, position)) {
                if (isArrivalAt) break;
            } else if (position < stop.position) break;
            stopTime += stop.duration;
        }
        return stopTime
                + (isArrivalAt ? envelope.interpolateArrivalAt(position) : envelope.interpolateDepartureFrom(position));
    }

    @Override
    public double interpolateArrivalAt(double position) {
        return interpolate(position, true);
    }

    @Override
    public double interpolateDepartureFrom(double position) {
        return interpolate(position, false);
    }

    @Override
    public long interpolateArrivalAtUS(double position) {
        return (long) (this.interpolateArrivalAt(position) * 1_000_000);
    }

    @Override
    public long interpolateDepartureFromUS(double position) {
        return (long) (this.interpolateDepartureFrom(position) * 1_000_000);
    }

    @Override
    public double interpolateArrivalAtClamp(double position) {
        return interpolateArrivalAt(clamp(position, 0, envelope.getEndPos()));
    }

    @Override
    public double interpolateDepartureFromClamp(double position) {
        return interpolateDepartureFrom(clamp(position, 0, envelope.getEndPos()));
    }

    @Override
    public double getBeginPos() {
        return envelope.getBeginPos();
    }

    @Override
    public double getEndPos() {
        return envelope.getEndPos();
    }

    @Override
    public double getTotalTime() {
        return envelope.getTotalTime()
                + stops.stream().mapToDouble(stop -> stop.duration).sum();
    }

    @Override
    public @Nullable Envelope getRawEnvelopeIfSingle() {
        return envelope.getRawEnvelopeIfSingle();
    }

    /** Returns all the points as (time, speed, position), with time adjusted for stop duration */
    @Override
    public List<EnvelopePoint> iteratePoints() {
        var res = new ArrayList<EnvelopePoint>();
        double sumPreviousStopDuration = 0;
        int stopIndex = 0;
        for (var point : envelope.iteratePoints()) {
            var shiftedTime = point.time() + sumPreviousStopDuration;
            var shiftedPoint = new EnvelopePoint(shiftedTime, point.speed(), point.position());
            res.add(shiftedPoint);
            if (stopIndex < stops.size() && point.position() >= stops.get(stopIndex).position) {
                var stopDuration = stops.get(stopIndex).duration;
                res.add(new EnvelopePoint(shiftedTime + stopDuration, point.speed(), stops.get(stopIndex).position));
                stopIndex++;
                sumPreviousStopDuration += stopDuration;
            }
        }
        return res;
    }

    @Override
    public double maxSpeedInRange(double beginPos, double endPos) {
        return envelope.maxSpeedInRange(beginPos, endPos);
    }
}
