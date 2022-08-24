package fr.sncf.osrd.envelope_sim;

public interface PhysicsRollingStock {
    /** The mass of the train, in kilograms */
    double getMass();

    /** The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient) */
    double getInertia();

    /** The length of the train, in meters */
    double getLength();

    /** The maximum speed the train can reach, in m/s */
    double getMaxSpeed();

    /** The resistance to movement at a given speed, in newtons */
    double getRollingResistance(double speed);

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    double getRollingResistanceDeriv(double speed);

    /** The maximum traction effort which can be deployed at a given speed, in newtons */
    double getMaxEffort(double speed);

    /** The maximum constant deceleration used for timetable calculation, in m/s^2 */
    double getTimetableDeceleration();

    /** The maximum braking force which can be applied at a given speed, in newtons */
    double getMaxBrakingForce(double speed);

    /** The emergency braking force which can be applied at a given speed, in newtons */
    double getSafeBrakingForce(double speed);

    /** The service braking force which can be applied at a given speed, in newtons */
    double getServiceBrakingForce(double speed);

    /** The normal service braking force which can be applied at a given speed, in newtons */
    double getNormalServiceBrakingForce(double speed);
}
