package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.arePositionsEqual;

import fr.sncf.osrd.envelope.EnvelopeInterpolate;
import fr.sncf.osrd.train.TrainStop;
import java.util.ArrayList;
import java.util.List;

/** Wraps an envelope with stops, to include the stop durations when getting the time at any point.
 * When getting the time at an exact stop location, the stop *is included*. */
public class EnvelopeStopWrapper implements EnvelopeInterpolate {
    public final EnvelopeInterpolate envelope;
    public final List<TrainStop> stops;

    public EnvelopeStopWrapper(EnvelopeInterpolate envelope, List<TrainStop> stops) {
        this.envelope = envelope;
        this.stops = stops;
    }

    @Override
    public double interpolateTotalTime(double position) {
        double stopTime = 0;
        for (var stop : stops) {
            if (stop.position > position && !arePositionsEqual(stop.position, position)) break;
            stopTime += stop.duration;
        }
        return stopTime + envelope.interpolateTotalTime(position);
    }

    public long interpolateTotalTimeMS(double position) {
        return (long) (this.interpolateTotalTime(position) * 1000);
    }

    @Override
    public double interpolateTotalTimeClamp(double position) {
        position = Math.max(0, Math.min(envelope.getEndPos(), position));
        return interpolateTotalTime(position);
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

    /** Returns all the points as (time, speed, position), with time adjusted for stop duration */
    @Override
    public List<EnvelopePoint> iteratePoints() {
        var res = new ArrayList<EnvelopePoint>();
        double sumPreviousStopDuration = 0;
        int stopIndex = 0;
        for (var point : envelope.iteratePoints()) {
            var shiftedPoint =
                    new EnvelopePoint(point.time() + sumPreviousStopDuration, point.speed(), point.position());
            res.add(shiftedPoint);
            if (stopIndex < stops.size() && point.position() >= stops.get(stopIndex).position) {
                var stopDuration = stops.get(stopIndex).duration;
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
