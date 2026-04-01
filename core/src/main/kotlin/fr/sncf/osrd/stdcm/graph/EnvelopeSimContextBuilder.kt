package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.path.interfaces.PhysicsPath

/** Computes the rolling stock effort curves that will be used and creates a context */
fun build(
    rollingStock: PhysicsRollingStock,
    path: PhysicsPath,
    timeStep: Double,
    comfort: Comfort?,
): EnvelopeSimContext {
    val elecCondMap =
        path.getElectrificationMap(null, null, null, true) // Only electrification modes for now
    val curves = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort).curves
    return EnvelopeSimContext(rollingStock, path, timeStep, curves)
}
