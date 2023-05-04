package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort

object EnvelopeSimContextBuilder {
    /** Computes the rolling stock effort curves that will be used and creates a context  */
    @JvmStatic
    fun build(
        rollingStock: RollingStock,
        path: EnvelopeSimPath,
        timeStep: Double,
        comfort: Comfort?
    ): EnvelopeSimContext {
        // Only electrification modes for now
        val elecCondMap = path.getElecCondMap(null, null, null, true)
        val curvesAndConditions = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort, path.getLength())
        return EnvelopeSimContext(rollingStock, path, timeStep, curvesAndConditions.curves)
    }
}
