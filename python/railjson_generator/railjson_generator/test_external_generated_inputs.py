from osrd_schemas import external_generated_inputs, infra

from railjson_generator.external_generated_inputs import (
    ElectricalProfile,
    ExternalGeneratedInputs,
)
from railjson_generator.schema.infra.range_elements import TrackRange
from railjson_generator.schema.infra.track_section import TrackSection


class TestElectricalProfile:
    def test_add_track_range(self):
        ep = ElectricalProfile(value="dummy", power_class="dummy")
        assert ep.track_ranges == []
        track = TrackSection(length=1)

        ep.add_track_range(track=track, begin=0, end=1)

        assert ep.track_ranges == [TrackRange(track=track, begin=0, end=1)]

    def test_to_rjs(self):
        ep = ElectricalProfile(value="value", power_class="power_class")
        track = TrackSection(length=1)
        ep.add_track_range(track=track, begin=0, end=1)

        assert ep.to_rjs() == external_generated_inputs.ElectricalProfile(
            value="value", power_class="power_class", track_ranges=[infra.TrackRange(track=track.id, begin=0, end=1)]
        )


class TestExternalGeneratedInputs:
    def test_add_electrical_profile(self):
        egi = ExternalGeneratedInputs()
        assert egi.electrical_profiles == []

        egi.add_electrical_profile(value="value", power_class="power_class")

        assert egi.electrical_profiles == [ElectricalProfile(value="value", power_class="power_class")]

    def test_to_rjs(self):
        egi = ExternalGeneratedInputs()
        egi.add_electrical_profile(value="value", power_class="power_class")
        track = TrackSection(length=1)
        egi.electrical_profiles[0].add_track_range(track=track, begin=0, end=1)

        assert egi.to_rjs() == external_generated_inputs.ElectricalProfileSet(
            levels=[
                external_generated_inputs.ElectricalProfile(
                    value="value",
                    power_class="power_class",
                    track_ranges=[infra.TrackRange(track=track.id, begin=0, end=1)],
                )
            ],
            level_order={"25000V": ["25000V", "22500V", "20000V"]},
        )

    def test_save(self, tmp_path):
        import json

        egi = ExternalGeneratedInputs()
        egi.add_electrical_profile(value="value", power_class="power_class")
        track = TrackSection(length=1)
        egi.electrical_profiles[0].add_track_range(track=track, begin=0, end=1)
        path = tmp_path / "test_external_generated_inputs_test_save.json"

        egi.save(path)

        with open(path) as f:
            assert external_generated_inputs.ElectricalProfileSet(**json.load(f)) == egi.to_rjs()
