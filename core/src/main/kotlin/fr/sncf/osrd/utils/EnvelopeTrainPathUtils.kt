package fr.sncf.osrd.utils

import fr.sncf.osrd.envelope_sim.electrification.Electrification
import fr.sncf.osrd.envelope_sim.electrification.Electrified
import fr.sncf.osrd.envelope_sim.electrification.Neutral
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.utils.units.Distance

/** Builds the ElectrificationMap */
fun buildElectrificationMap(path: PathProperties): DistanceRangeMap<Electrification> {
    val res: DistanceRangeMap<Electrification> = DistanceRangeMapImpl()
    res.put(Distance.ZERO, path.getLength(), NonElectrified())
    res.updateMapIntersection(path.getElectrification()) {
        _: Electrification?,
        electrificationMode: Set<String> ->
        // TODO: identify which mode to use
        if (electrificationMode.isEmpty()) NonElectrified()
        else Electrified(electrificationMode.first())
    }
    res.updateMapIntersection(path.getNeutralSections()) {
        electrification: Electrification?,
        neutralSection: NeutralSection ->
        Neutral(neutralSection.lowerPantograph, electrification, neutralSection.isAnnouncement)
    }
    return res
}
