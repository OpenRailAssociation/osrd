package fr.sncf.osrd.path.legacy_objects

import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.units.Distance

/** Builds the ElectrificationMap */
fun buildElectrificationMap(path: TrainPath): DistanceRangeMap<Electrification> {
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
