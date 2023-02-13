package fr.sncf.osrd.envelope;

import fr.sncf.osrd.train.TrainStop;
import java.util.ArrayList;
import java.util.List;

public class EnvelopeStopWrapper implements EnvelopeTimeInterpolate {
    public final Envelope envelope;
    public final List<TrainStop> stops;

    public EnvelopeStopWrapper(Envelope envelope, List<TrainStop> stops) {
        this.envelope = envelope;
        this.stops = stops;
    }

    @Override
    public double interpolateTotalTime(double position) {
        double stopTime = 0;
        for (var stop : stops) {
            if (stop.position > position)
                break;
            stopTime += stop.duration;
        }
        return stopTime + envelope.interpolateTotalTime(position);
    }

    @Override
    public double interpolateTotalTimeClamp(double position) {
        position = Math.max(0, Math.min(envelope.getEndPos(), position));
        return interpolateTotalTime(position);
    }

    @Override
    public double getEndPos() {
        return envelope.getEndPos();
    }

    public record CurvePoint(double time, double speed, double position){}

    /** Returns all the points as (time, speed, position), with time adjusted for stop duration */
    public List<CurvePoint> iterateCurve() {
        var res = new ArrayList<CurvePoint>();
        double time = 0;
        for (var part : envelope) {
            // Add head position points
            for (int i = 0; i < part.pointCount(); i++) {
                var pos = part.getPointPos(i);
                var speed = part.getPointSpeed(i);
                res.add(new CurvePoint(time, speed, pos));
                if (i < part.stepCount())
                    time += part.getStepTime(i);
            }

            if (part.getEndSpeed() > 0)
                continue;

            // Add stop duration
            for (var stop : stops) {
                if (stop.duration == 0. || stop.position < part.getEndPos())
                    continue;
                if (stop.position > part.getEndPos())
                    break;
                time += stop.duration;
                res.add(new CurvePoint(time, 0, part.getEndPos()));
            }
        }
        return res;
    }
}
