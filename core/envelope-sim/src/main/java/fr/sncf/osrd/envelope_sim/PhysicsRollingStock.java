package fr.sncf.osrd.envelope_sim;


import fr.sncf.osrd.envelope_sim.power.EnergySource;

import java.util.ArrayList;

import static fr.sncf.osrd.envelope_sim.Utils.interpolate;

public interface PhysicsRollingStock {
    /** The mass of the train, in kilograms */
    double getMass();

    /** The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient) */
    double getInertia();

    /** The length of the train, in meters */
    double getLength();

    /** The maximum speed the train can reach, in m/s */
    double getMaxSpeed();

    /** The type of gamma input of the train */
    GammaType getGammaType();

    /** The resistance to movement at a given speed, in newtons */
    double getRollingResistance(double speed);

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    double getRollingResistanceDeriv(double speed);

    /** Get the effort the train can apply at a given speed, in newtons */
    double getMaxTractionForce(double speed, Utils.CurvePoint[] tractiveEffortCurve, boolean electrification);

    /** The maximum constant deceleration, in m/s^2 */
    double getDeceleration();

    /** The maximum braking force which can be applied at a given speed, in newtons */
    double getMaxBrakingForce(double speed);

    /** If relevant, compute the delta of state of charge */
    void updateEnergyStorages(double maxAvailableForce, double usedForce, double speed, double timeStep);

    enum GammaType {
        CONST,
        MAX
    }
}
