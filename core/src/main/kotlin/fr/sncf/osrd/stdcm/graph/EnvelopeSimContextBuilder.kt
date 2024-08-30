package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.train.RollingStock

/** Computes the rolling stock effort curves that will be used and creates a context */
fun build(
    rollingStock: RollingStock,
    path: EnvelopeSimPath,
    timeStep: Double,
    comfort: Comfort?
): EnvelopeSimContext {
    val elecCondMap =
        path.getElectrificationMap(null, null, null, true) // Only electrification modes for now
    val curvesAndConditions = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort)
    return EnvelopeSimContext(rollingStock, path, timeStep, curvesAndConditions.curves)
}
