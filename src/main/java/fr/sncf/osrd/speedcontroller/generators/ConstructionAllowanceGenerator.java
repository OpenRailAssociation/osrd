package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.HashSet;
import java.util.Set;

/** Adds a construction margin to the given speed limits
 * The allowanceValue is in seconds, added over the whole phase */
public class ConstructionAllowanceGenerator extends DichotomyControllerGenerator {

    private final double value;

    public ConstructionAllowanceGenerator(TrainPath path, TrackSectionLocation begin, TrackSectionLocation end,
                                          double allowanceValue) {
        super(path, begin, end, 0.1);
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) {
        return baseTime + value;
    }

    @Override
    protected double getFirstLowEstimate() {
        return 0;
    }

    @Override
    protected double getFirstHighEstimate() {
        double max = 0;
        double position = sectionBegin;
        while (position < sectionEnd) {
            double val = SpeedController.getDirective(maxSpeedControllers, position).allowedSpeed;
            if (val > max)
                max = val;
            position += 1;
        }
        return max;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule, double value, double begin, double end) {
        var res = new HashSet<>(maxSpeedControllers);
        res.add(new MaxSpeedController(value, begin, end));
        //res.add(new MaxSpeedController(value, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY));
        return res;
    }
}