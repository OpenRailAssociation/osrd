package fr.sncf.osrd.utils

import fr.sncf.osrd.envelope_sim.electrification.Electrification
import fr.sncf.osrd.envelope_sim.electrification.Electrified
import fr.sncf.osrd.envelope_sim.electrification.Neutral
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.utils.units.Distance


/**
 * Builds the ElectrificationMap
 */
fun buildElectrificationMap(path: PathProperties): DistanceRangeMap<Electrification> {
    val res: DistanceRangeMap<Electrification> = DistanceRangeMapImpl()
    res.put(Distance.ZERO, path.getLength().distance, NonElectrified())
    res.updateMap(
        path.getCatenary()
    ) { _: Electrification?, catenaryMode: String ->
        if (catenaryMode == "")
            NonElectrified()
        else
            Electrified(catenaryMode)
    }
    res.updateMap(
        path.getNeutralSections()
    ) { electrification: Electrification?, neutralSection: NeutralSection ->
        Neutral(neutralSection.lowerPantograph, electrification, neutralSection.isAnnouncement)
    }
    return res
}
