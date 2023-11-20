package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.sim_infra.api.DirTrackSectionId
import fr.sncf.osrd.sim_infra.api.EndpointTrackSectionId
import fr.sncf.osrd.sim_infra.api.TrackNetworkInfra
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf

fun TrackNetworkInfra.getNextTrackSections(trackSection: DirTrackSectionId): DirStaticIdxList<TrackSection> {
    val nextTrackSections = mutableDirStaticIdxArrayListOf<TrackSection>()
    val node = getNextTrackNode(trackSection)
    if (!node.isNone) {
        val configs = getTrackNodeConfigs(node.asIndex())
        for (config in configs) {
            val nextTrackSection = getNextTrackSection(trackSection, config)
            if (!nextTrackSection.isNone)
                nextTrackSections.add(nextTrackSection.asIndex())
        }
    }
    return nextTrackSections
}
