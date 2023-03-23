package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_sim.Utils.*;

import static fr.sncf.osrd.envelope_sim.Utils.interpolate;

public record SpeedDependantPowerCoefficient(CurvePoint[] curve){
    /* Use cases :
     * you need to modulate power with speed to simulate catenary/pantograph limitation
     * you need to modulate power with speed to simulate a fuel cell behavior
     * x:speed values , y:associated dimensionless powerCoefficient which modulate output power
     */

    /** Return Power Coefficient at a given speed*/
    double getPowerCoefficientFromSpeed(double speed){
        return interpolate(speed,this.curve);
    }
}
