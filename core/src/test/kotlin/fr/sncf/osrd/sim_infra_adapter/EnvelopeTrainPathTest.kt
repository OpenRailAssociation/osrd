package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.api.InfraMetadata
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSElectrification
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.meters
import java.util.stream.Stream
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

class EnvelopeTrainPathTest {

    @Test
    fun envelopeFromPathTestAverageGrades() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        for (track in rjsInfra.trackSections) {
            if (track.id.equals("TA0")) {
                track.slopes = listOf(RJSSlope(0.0, 1_000.0, 5.0), RJSSlope(1_000.0, 2_000.0, 15.0))
            }
            if (track.id.equals("TA1")) {
                track.slopes =
                    listOf(RJSSlope(0.0, 1_000.0, 10.0), RJSSlope(1_000.0, 1_950.0, 25.0))
            }
        }

        val infra = Helpers.fullInfraFromRJS(rjsInfra, InfraMetadata("modified_small_infra"))
        val path =
            pathFromTracks(
                infra,
                listOf("TA0", "TA1"),
                Direction.INCREASING,
                500.meters,
                3_500.meters,
            )
        Assertions.assertEquals(5.0, path.getAverageGrade(0.0, 500.0))
        Assertions.assertEquals(15.0, path.getAverageGrade(500.0, 1500.0))
        Assertions.assertEquals(10.0, path.getAverageGrade(1500.0, 2500.0))
        Assertions.assertEquals(25.0, path.getAverageGrade(2500.0, 3000.0))
        Assertions.assertEquals(11.0, path.getAverageGrade(0.0, 2500.0))
        Assertions.assertEquals(10.0, path.getAverageGrade(300.0, 700.0))
    }

    @ParameterizedTest
    @MethodSource("electrificationMapArguments")
    fun envelopeFromPathTestElectrificationMap(
        tracks: List<String>,
        direction: Direction,
        expectedMap: DistanceRangeMap<Electrification>,
    ) {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications =
            listOf(
                RJSElectrification(
                    "",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            0.0,
                            800.0,
                        )
                    ),
                ),
                RJSElectrification(
                    "1500V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            800.0,
                            2_000.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            0.0,
                            1_000.0,
                        ),
                    ),
                ),
                RJSElectrification(
                    "25000V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            1_100.0,
                            1_950.0,
                        )
                    ),
                ),
                // and there is already a deadSection on TA0 from 1900 to 1950 in the
                // Direction.INCREASING
            )
        val infra = Helpers.fullInfraFromRJS(rjsInfra, InfraMetadata("modified_small_infra"))
        val path = pathFromTracks(infra, tracks, direction, 500.meters, 3_600.meters)

        assertThat(path.getElectrificationMap(null, null, null)).isEqualTo(expectedMap)
    }

    @Test
    fun envelopeFromPathTestElectrificationMapByPowerClassIncreasingDirection() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications =
            listOf(
                RJSElectrification(
                    "",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            0.0,
                            1500.0,
                        )
                    ),
                ),
                RJSElectrification(
                    "1500V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            1500.0,
                            2_000.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            0.0,
                            500.0,
                        ),
                    ),
                ),
                RJSElectrification(
                    "25000V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            500.0,
                            1_950.0,
                        )
                    ),
                ),
                // and there is already a deadSection on TA0 from 1900 to 1950 in the
                // Direction.INCREASING
            )

        val infra = Helpers.fullInfraFromRJS(rjsInfra, InfraMetadata("modified_small_infra"))
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
                electricalProfileMapping = profileMap,
            )
        val electrificationByPowerClass = path.getElectrificationMap("1", null, null)
        val expected = DistanceRangeMapImpl<Electrification>()

        putInElectrificationMapByPowerClass(expected, 0, 500, NonElectrified(), "A")
        putInElectrificationMapByPowerClass(expected, 500, 600, Electrified("1500V"), "A")
        putInElectrificationMapByPowerClass(expected, 600, 800, Electrified("1500V"), "B")
        putInElectrificationMapByPowerClass(expected, 800, 960, Electrified("1500V"), "A")
        putInElectrificationMapByPowerClass(
            expected,
            960,
            1000,
            Neutral(true, Electrified("1500V"), false),
            "A",
        )
        putInElectrificationMapByPowerClass(expected, 1_000, 1_500, Electrified("1500V"), "B")
        putInElectrificationMapByPowerClass(expected, 1_500, 2_500, Electrified("25000V"), "B")
        Assertions.assertEquals(expected, electrificationByPowerClass)
    }

    @Test
    fun envelopeFromPathTestElectrificationMapByPowerClassDecreasingDirection() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications =
            listOf(
                RJSElectrification(
                    "1500V",
                    listOf(
                        RJSApplicableDirectionsTrackRange(
                            "TA0",
                            ApplicableDirection.BOTH,
                            0.0,
                            2_000.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA1",
                            ApplicableDirection.BOTH,
                            0.0,
                            1_950.0,
                        ),
                        RJSApplicableDirectionsTrackRange(
                            "TA2",
                            ApplicableDirection.BOTH,
                            0.0,
                            1_950.0,
                        ),
                    ),
                )
            )

        val infra = Helpers.fullInfraFromRJS(rjsInfra, InfraMetadata("modified_small_infra"))
        val rjsElectricalProfiles = getRjsElectricalProfileMapping_2()
        val profileMap = ElectricalProfileMapping()
        profileMap.parseRJS(rjsElectricalProfiles)
        val path =
            pathFromTracks(
                infra,
                listOf("TA2", "TA1", "TA0"),
                Direction.DECREASING,
                1_000.meters,
                5_000.meters,
                electricalProfileMapping = profileMap,
            )
        val electrificationPowerClass1 = path.getElectrificationMap("1", null, null)
        val expectedElectrificationPowerClass1 = DistanceRangeMapImpl<Electrification>()
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            0,
            700,
            Electrified("1500V"),
            "B",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            700,
            2_600,
            Electrified("1500V"),
            "A",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            2_600,
            2_910,
            Electrified("1500V"),
            "B",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            2_910,
            3_050,
            Neutral(false, Electrified("1500V"), false),
            "B",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            3_050,
            3_300,
            Electrified("1500V"),
            "B",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass1,
            3_300,
            4_000,
            Electrified("1500V"),
            "A",
        )

        Assertions.assertEquals(expectedElectrificationPowerClass1, electrificationPowerClass1)

        val electrificationPowerClass2 = path.getElectrificationMap("2", null, null)
        val expectedElectrificationPowerClass2 = DistanceRangeMapImpl<Electrification>()
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            0,
            950,
            Electrified("1500V"),
            "C",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            950,
            2_700,
            Electrified("1500V"),
            "D",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            2_700,
            2_910,
            Electrified("1500V"),
            "C",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            2_910,
            3_000,
            Neutral(false, Electrified("1500V"), false),
            "C",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            3_000,
            3_050,
            Neutral(false, Electrified("1500V"), false),
            "D",
        )
        putInElectrificationMapByPowerClass(
            expectedElectrificationPowerClass2,
            3_050,
            4_000,
            Electrified("1500V"),
            "D",
        )

        Assertions.assertEquals(expectedElectrificationPowerClass2, electrificationPowerClass2)
    }

    companion object {
        @JvmStatic
        private fun electrificationMapArguments(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(
                    listOf("TA0", "TA1"),
                    Direction.INCREASING,
                    distanceRangeMapOf(
                        DistanceRangeMap.RangeMapEntry(0.meters, 300.meters, NonElectrified()),
                        DistanceRangeMap.RangeMapEntry(
                            300.meters,
                            1_460.meters,
                            Electrified("1500V"),
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            1_460.meters,
                            1_500.meters,
                            Neutral(true, Electrified("1500V"), false),
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            1_500.meters,
                            2_500.meters,
                            Electrified("1500V"),
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            2_500.meters,
                            2_600.meters,
                            NonElectrified(),
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            2_600.meters,
                            3_100.meters,
                            Electrified("25000V"),
                        ),
                    ),
                ),
                Arguments.of(
                    listOf("TA1", "TA0"),
                    Direction.DECREASING,
                    distanceRangeMapOf(
                        DistanceRangeMap.RangeMapEntry(0.meters, 350.meters, Electrified("25000V")),
                        DistanceRangeMap.RangeMapEntry(350.meters, 450.meters, NonElectrified()),
                        DistanceRangeMap.RangeMapEntry(
                            450.meters,
                            1_460.meters,
                            Electrified("1500V"),
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            1_460.meters,
                            1_600.meters,
                            Neutral(false, Electrified("1500V"), false),
                        ),
                        DistanceRangeMap.RangeMapEntry(
                            1_600.meters,
                            2_650.meters,
                            Electrified("1500V"),
                        ),
                        DistanceRangeMap.RangeMapEntry(2_650.meters, 3_100.meters, NonElectrified()),
                    ),
                ),
            )
        }
    }
}

/** Puts the specified Electrification with according electricalProfile in the range lower upper */
private fun putInElectrificationMapByPowerClass(
    expectedElectrificationMapByPowerClass: DistanceRangeMap<Electrification>,
    lower: Int,
    upper: Int,
    electrification: Electrification,
    electricalProfile: String,
) {
    val elecWithProfile = electrification.withElectricalProfile(electricalProfile)
    expectedElectrificationMapByPowerClass.put(lower.meters, upper.meters, elecWithProfile)
}
