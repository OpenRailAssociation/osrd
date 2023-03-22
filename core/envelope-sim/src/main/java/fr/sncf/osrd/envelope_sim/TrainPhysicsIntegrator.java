package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;

/**
 * An utility class to help simulate the train, using numerical integration.
 * It's used when simulating the train, and it is passed to speed controllers so they can take decisions
 * about what action to make. Once speed controllers took a decision, this same class is used to compute
 * the next position and speed of the train.
 */
public final class TrainPhysicsIntegrator {
    // a position delta lower than this value will be considered zero
    public static final double POSITION_EPSILON = 1E-6;
    // a speed lower than this value will be considered zero
    public static final double SPEED_EPSILON = 1E-6;

    private final PhysicsRollingStock rollingStock;
    private final PhysicsPath path;
    private final Action action;
    private final double directionSign;

    private final RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap;

    private TrainPhysicsIntegrator(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            Action action,
            double directionSign,
            RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap
    ) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.action = action;
        this.directionSign = directionSign;
        this.tractiveEffortCurveMap = tractiveEffortCurveMap;
    }

    /** Simulates train movement */
    public static IntegrationStep step(
            EnvelopeSimContext context,
            double initialLocation,
            double initialSpeed,
            Action action,
            double directionSign
    ) {
        var integrator = new TrainPhysicsIntegrator(context.rollingStock, context.path, action, directionSign,
                context.tractiveEffortCurveMap);
        return integrator.step(context.timeStep, initialLocation, initialSpeed, directionSign);
    }

    /** Simulates train movement */
    private IntegrationStep step(
            double timeStep,
            double initialLocation,
            double initialSpeed,
            double directionSign
    ) {
        var halfStep = timeStep / 2;
        var step1 = step(halfStep, initialLocation, initialSpeed);
        var step2 = step(halfStep, initialLocation + step1.positionDelta, step1.endSpeed);
        var step3 = step(timeStep, initialLocation + step2.positionDelta, step2.endSpeed);
        var step4 = step(timeStep, initialLocation + step3.positionDelta, step3.endSpeed);

        var meanAcceleration = (
                step1.acceleration
                + 2 * step2.acceleration
                + 2 * step3.acceleration
                + step4.acceleration
        ) / 6.;
        return newtonStep(timeStep, initialSpeed, meanAcceleration, directionSign);
    }


    private IntegrationStep step(double timeStep, double position, double speed) {
        double tractionForce = 0;
        double brakingForce = 0;
        var tractiveEffortCurve = tractiveEffortCurveMap.get(position);
        assert tractiveEffortCurve != null;

        // CHANTIER PRISE EN COMPTE ENERGY SOURCE ******************************************
        var energySources = rollingStock.getEnergySources();
        boolean electrification = path.isElectrificated(position);//Simulate an electrification availability for tests further down
        // TODO : Validate the program with real test

        // Get EnergySources overall power capability
        var availableElectricalPower = rollingStock.getAvailableElectricalPower(speed);
        double availableElectricalPower = 0.0;              // Sum each available power from Energy Source of the train
        for(var source : EnergySources){availableElectricalPower += source.getPower(speed);}
        double maxTractionForceFromEnergySources = availableElectricalPower * rollingStock.motorEfficiency / speed;  // F = Pmeca/Speed
        /*                  HOW WE DEAL WE WITH MODULATING TRACTION POWER
         *                                      /!\ Vitesse = french("speed") /!\
         *     ▲ Force
         *     │
         *     │....................       │
         *     │         X        ....     │
         *     │          X         ...    │               .....   classic F(V) <=> Fixed power func(electrification)
         *     │           X          ..   │                                        *or nearly fixed power
         *     │            X          ... │
         *     │             X           ..│
         *     │              X           .│.              XXXXX   F(Pmax(V)) = maxMecaPower·motorEfficiency/V
         *     │               XX          │...
         *     │                XX         │  ..
         *     │                  X        │   ...
         *     │                    X      │      ..
         *     │                      X    │        ....
         *     │                        X  │          ....
         *     │                          X│             .....
         *     │                           │X                ......
         *     │                           │   X                 ................
         *     │                           │      X  X XXXXXXXX                 .....................
         * ────┼───────────────────────────┼───────────────────────────────────────────────────────────►
         *     │                           │                                                            Speed
         *     │                         Speed
         *
         * I imagine 2 options to account for variable available power :
         * Each point of the F(V) correspond to à given power (Power = Force x Vitesse)
         * then we could multpiply F by a coefficient, using K x F(V), we would get a variable power
         * But it wouldn't account for wheel slip the same way, we'd have to add complexity to avoid uncanny behaviors
         *
         * We prefer to use the min between an existing measured "best case, best power" curve and a computed curve:
         * the power each energy source can provide at a given time and speed, adds up and we can then compute
         * (Force = Power/Vitesse )
         * it guarantees us the train can't have unexpectedly high torque, or misrepresent its movement behavior
         */
        double maxTractionForce = Math.min(
                PhysicsRollingStock.getMaxEffort(speed, tractiveEffortCurve),
                maxTractionForceFromEnergySources
        );

        // Re-compute actual power used by traction for case where we're limited by ES power
        double actualElectricalTractionPower = rollingStock.motorEfficiency/(maxTractionForce*speed);
        double pBus = actualElectricalTractionPower + rollingStock.auxiliaryEquipmentPower;
        /*Ppwp|cat = Pbus + Prech + Pconvbat <=> Ppwp|cat = Paux + Ptrac + Prech + Pconvbat*/

        // Retrieve Pmax & Pmin depending on electrification availability (Powerpack or Catenary/Pantograph power)
        double Pmaxpwpcat = electrification ? energySources.get(0).pMax : 0.0; // Panto.pMax : Rien
        //double Pminpwpcat = electrification? EnergySources.get(0).pMin : 0; // Panto.pMax : Rien


        // TUTUT Battery try to recover from it's discharged state :
        double SoC = energySources.get(1).Storage.getSoc();
        double callForPower = energySources.get(1).Storage.refillLaw.getRefillPower(SoC);
        // Whatever the Traction+Auxiliary Power ( Bus power )
        // Limite de ce que peut recharger la batterie par la puissance restante dispo : pBus - Pmaxpwpcat
        double callForPowerFromPbusLeftsOver = RJSRollingStock.hardClipping(
                0,
                callForPower,
                pBus - Pmaxpwpcat
        );
        double pBat = energySources.get(1).clipToESPowerLimits(callForPowerFromPbusLeftsOver);
        double ppwpcat = energySources.get(0).clipToESPowerLimits(pBus - pBat);

        //double Ppwp_cat = PmaxBase - actualElectricalTractionPower + EnergySources.get(1).Storage.refillLaw.getRefillPower(0.6);
        //double  = Pbus - Pconvbat;


        /* /!\ Energy calculation STEP */

        EnergySources.get(1).Storage.updateStateOfCharge(pBat*timeStep);
        // FIN CHANTIER PRISE EN COMPTE ENERGY SOURCE ******************************************

        double rollingResistance = rollingStock.getRollingResistance(speed);
        double weightForce = getWeightForce(rollingStock, path, position);

        if (action == Action.ACCELERATE)
            tractionForce = maxTractionForce;

        if (action == Action.BRAKE)
            brakingForce = rollingStock.getMaxBrakingForce(speed);

        if (action == Action.MAINTAIN) {
            tractionForce = rollingResistance - weightForce;
            if (tractionForce <= maxTractionForce)
                return newtonStep(timeStep, speed, 0, directionSign);
            else tractionForce = maxTractionForce;
        }

        double acceleration = computeAcceleration(rollingStock, rollingResistance,
                weightForce, speed, tractionForce, brakingForce, directionSign);
        return newtonStep(timeStep, speed, acceleration, directionSign);
    }

    /** Compute the weight force of a rolling stock at a given position on a given path */
    public static double getWeightForce(PhysicsRollingStock rollingStock, PhysicsPath path, double headPosition) {
        var tailPosition = Math.min(Math.max(0, headPosition - rollingStock.getLength()), path.getLength());
        headPosition = Math.min(Math.max(0, headPosition), path.getLength());
        var averageGrade = path.getAverageGrade(tailPosition, headPosition);
        // get an angle from a meter per km elevation difference
        // the curve's radius is taken into account in meanTrainGrade
        var angle = Math.atan(averageGrade / 1000.0);  // from m/km to m/m
        return -rollingStock.getMass() * 9.81 * Math.sin(angle);
    }

    /** Compute the acceleration given a rolling stock, different forces, a speed, and a direction */
    public static double computeAcceleration(
            PhysicsRollingStock rollingStock,
            double rollingResistance,
            double weightForce,
            double currentSpeed,
            double tractionForce,
            double brakingForce,
            double directionSign) {

        assert brakingForce >= 0.;
        assert tractionForce >= 0.;

        if (brakingForce > 0 && rollingStock.getGammaType() == PhysicsRollingStock.GammaType.CONST)
            return rollingStock.getDeceleration();

        // the sum of forces that always go the direction opposite to the train's movement
        double oppositeForce = rollingResistance + brakingForce;
        if (currentSpeed == 0 && directionSign > 0) {
            // If we are stopped and if the forces are not enough to compensate the opposite force,
            // the rolling resistance and braking force don't apply and the speed stays at 0
            // Unless we integrate backwards, then we need the speed to increase
            var totalOtherForce = tractionForce + weightForce;
            if (Math.abs(totalOtherForce) < oppositeForce)
                return 0.0;
        }

        // as the oppositeForces are reaction forces, they need to be adjusted to be opposed to the other forces
        if (currentSpeed >= 0.0) {
            // if the train is moving forward or still, the opposite forces are negative
            return (tractionForce + weightForce - oppositeForce) / rollingStock.getInertia();
        } else {
            // if the train is moving backwards, the opposite forces are positive
            return (tractionForce + weightForce + oppositeForce) / rollingStock.getInertia();
        }
    }

    /** Integrate the Newton movement equations*/
    public static IntegrationStep newtonStep(
            double timeStep,
            double currentSpeed,
            double acceleration,
            double directionSign
    ) {
        var signedTimeStep = Math.copySign(timeStep, directionSign);
        var newSpeed = currentSpeed + acceleration * signedTimeStep;
        if (Math.abs(newSpeed) < SPEED_EPSILON)
            newSpeed = 0;

        // dx = currentSpeed * dt + 1/2 * acceleration * dt * dt
        var positionDelta = currentSpeed * signedTimeStep + 0.5 * acceleration * signedTimeStep * signedTimeStep;

        if (Math.abs(positionDelta) < POSITION_EPSILON)
            positionDelta = 0;
        return IntegrationStep.fromNaiveStep(
                timeStep, positionDelta,
                currentSpeed, newSpeed,
                acceleration, directionSign
        );
    }
}
