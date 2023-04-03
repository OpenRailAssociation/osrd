package fr.sncf.osrd.railjson.schema.rollingstock;

public class RJSEnergyStorage {

    /** How much energy the object can store (in Joules or Watts·Seconds) */
    public double capacity;

    /** The State of Charge of the EnergyStorage, soc * capacity = actual stock of energy */
    public double soc;

    public RJSRefillLaw refillLaw;

    public double socMin;

    public double socMax;
}
