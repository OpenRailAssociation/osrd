package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarecoAllowance.MarginType;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.CoastingSpeedController;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;

import java.util.HashSet;
import java.util.Set;

public class MarecoAllowanceGenerator extends DichotomyControllerGenerator {

    private final RJSAllowance.MarecoAllowance.MarginType allowanceType;
    private final double value;

    public MarecoAllowanceGenerator(double allowanceValue, MarginType allowanceType, RJSTrainPhase phase) {
        super(phase, 0.5);
        this.allowanceType = allowanceType;
        this.value = allowanceValue;
    }

    @Override
    protected double getTargetTime(double baseTime) { return baseTime + value; }

    @Override
    protected double getFirstLowEstimate() {
        return 0;
    }

    @Override
    protected double getFirstHighEstimate() {
        double max = 0;
        double position = findPhaseInitialLocation(schedule);
        double endLocation = findPhaseEndLocation(schedule);
        while (position < endLocation) {
            double val = SpeedController.getDirective(maxSpeedControllers, position).allowedSpeed;
            if (val > max)
                max = val;
            position += 1;
        }
        // TODO find better way to define it
        return max*10;
    }

    @Override
    protected Set<SpeedController> getSpeedControllers(TrainSchedule schedule, double value) {
        var v1 = value;
        var wle = (2 * schedule.rollingStock.C * v1 + schedule.rollingStock.B) * v1 * v1;
        var vf = wle * v1 / (wle + schedule.rollingStock.rollingResistance(v1) * v1);
        double startLocation = findPhaseInitialLocation(schedule);
        double endLocation = findPhaseEndLocation(schedule);

        var NewMaxSpeedController = new MaxSpeedController(value, startLocation, endLocation);
        //TODO implement CoastingSpeedController for not constant gamma
        var NewCoastingSpeedController = new CoastingSpeedController(vf, startLocation, endLocation, 0.5);
        var res = new HashSet<>(maxSpeedControllers);
        res.add(NewMaxSpeedController);
        res.add(NewCoastingSpeedController);
        return res;
    }
}
