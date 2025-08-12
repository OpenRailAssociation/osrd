package fr.sncf.osrd.external_generated_inputs

import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ElectricalProfileMappingTest {
    @Test
    fun testRJSParsing() {
        val powerClass1TrackTA0 = DistanceRangeMapImpl<String>()
        powerClass1TrackTA0.put(0.meters, 1_600.meters, "A")
        powerClass1TrackTA0.put(1_600.meters, 1_800.meters, "B")
        powerClass1TrackTA0.put(1_800.meters, 2_000.meters, "A")
        val powerClass1TrackTA1 = DistanceRangeMapImpl<String>()
        powerClass1TrackTA1.put(0.meters, 1_950.meters, "B")
        val powerClass1Map =
            hashMapOf<String, DistanceRangeMap<String>>(
                Pair("TA0", powerClass1TrackTA0),
                Pair("TA1", powerClass1TrackTA1),
            )

        val powerClass2TrackTA0 = DistanceRangeMapImpl<String>()
        powerClass2TrackTA0.put(0.meters, 2_000.meters, "C")
        val powerClass2TrackTA1 = DistanceRangeMapImpl<String>()
        powerClass2TrackTA1.put(0.meters, 1_950.meters, "D")
        val powerClass2Map =
            hashMapOf<String, DistanceRangeMap<String>>(
                Pair("TA0", powerClass2TrackTA0),
                Pair("TA1", powerClass2TrackTA1),
            )

        val expectedProfileMapping = hashMapOf(Pair("1", powerClass1Map), Pair("2", powerClass2Map))

        val rjsElectricalProfiles = getRjsElectricalProfileMapping_1()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)

        assertThat(profileMap.mapping).isEqualTo(expectedProfileMapping)
    }

    @Test
    fun testGetProfilesOnPath() {
        // GIVEN
        val infra = Helpers.smallInfra
        val rjsElectricalProfiles = getRjsElectricalProfileMapping_1()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)
        val path =
            pathFromTracks(
                infra,
                listOf("TA0", "TA1"),
                Direction.INCREASING,
                1_000.meters,
                3_500.meters,
            )

        val powerClass1Map = DistanceRangeMapImpl<String>()
        powerClass1Map.put(0.meters, 600.meters, "A")
        powerClass1Map.put(600.meters, 800.meters, "B")
        powerClass1Map.put(800.meters, 1_000.meters, "A")
        powerClass1Map.put(1_000.meters, 2_500.meters, "B")

        val powerClass2Map = DistanceRangeMapImpl<String>()
        powerClass2Map.put(0.meters, 1_000.meters, "C")
        powerClass2Map.put(1_000.meters, 2_500.meters, "D")
        val expectedProfileMapping = hashMapOf(Pair("1", powerClass1Map), Pair("2", powerClass2Map))

        // WHEN
        val profilesOnPath = profileMap.getProfilesOnPath(infra.rawInfra, path)

        // THEN
        assertThat(profilesOnPath).isEqualTo(expectedProfileMapping)
    }
}
