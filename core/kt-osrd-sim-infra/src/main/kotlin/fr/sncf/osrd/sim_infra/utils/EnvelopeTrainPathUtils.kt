package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.envelope_sim.electrification.Electrification
import fr.sncf.osrd.envelope_sim.electrification.Electrified
import fr.sncf.osrd.envelope_sim.electrification.Neutral
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.sim_infra.impl.DeadSection
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.units.Distance


/**
 * Builds the ElectrificationMap
 */
fun buildElectrificationMap(path: Path): DistanceRangeMap<Electrification> {
    var res: DistanceRangeMap<Electrification> = DistanceRangeMapImpl()
    res.put(Distance.ZERO, path.getLength(), NonElectrified())
    res = res.updateMap(
        path.getCatenary()
    ) { _: Electrification?, catenaryMode: String ->
        if (catenaryMode == "") NonElectrified() else Electrified(catenaryMode)
    }
    res = res.updateMap(
        path.getDeadSections()
    ) { electrification: Electrification?, deadSection: DeadSection ->
        Neutral(deadSection.isDropPantograph, electrification)
    }
    return res
}
