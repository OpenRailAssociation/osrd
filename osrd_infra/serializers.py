from rest_framework.serializers import (
    ModelSerializer,
    CharField,
    FloatField,
    PrimaryKeyRelatedField,
    StringRelatedField,
    ChoiceField,
)

from osrd_infra.models import (
    # infra
    Infra,
    IdentifierComponent,
    TrackSectionLocationComponent,
    TrackSectionRangeComponent,
    TrackSectionComponent,
    TrackSectionLinkComponent,
    TrackSectionEntity,
    SwitchEntity,
    OperationalPointEntity,
    SignalEntity,

    # ecs
    Entity
)

from osrd_infra.models.common import Endpoint, EnumSerializer


class ComponentSerializer(ModelSerializer):
    def __init__(self, *args, omit_entity_id=False, omit_component_id=False, **kwargs):
        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        assert "entity" in self.fields
        assert "component_id" in self.fields

        if omit_entity_id:
            self.fields.pop("entity")

        if omit_component_id:
            self.fields.pop("component_id")


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        fields = "__all__"


# component serializers


class IdentifierComponentSerializer(ComponentSerializer):
    database = StringRelatedField()

    class Meta:
        model = IdentifierComponent
        fields = "__all__"


class TrackSectionLocationComponentSerializer(ComponentSerializer):
    class Meta:
        model = TrackSectionLocationComponent
        fields = "__all__"


class TrackSectionRangeComponentSerializer(ComponentSerializer):
    class Meta:
        model = TrackSectionRangeComponent
        fields = "__all__"


class TrackSectionComponentSerializer(ComponentSerializer):
    class Meta:
        model = TrackSectionComponent
        exclude = ["infra"]


class TrackSectionLinkComponentSerializer(ComponentSerializer):
    begin_endpoint = EnumSerializer(Endpoint)
    end_endpoint = EnumSerializer(Endpoint)

    class Meta:
        model = TrackSectionLinkComponent
        fields = "__all__"


# entity serializers


class EntitySerializer(type(ModelSerializer)):
    def __new__(cls, name, bases, attrs):
        meta = attrs.get("Meta", None)
        if meta is None:
            return super().__new__(cls, name, bases, attrs)

        model = meta.model
        entity_meta = getattr(model, "_entity_meta", None)
        assert entity_meta is not None, "the model of the EntitySerializer isn't an entity"
        components = entity_meta.components

        if not hasattr(meta, "fields"):
            meta.fields = ["entity_id"]
            for component_name in components:
                meta.fields.append(component_name)

        # extract component_specific meta
        component_name = getattr(meta, "component_name", None)
        assert component_name is not None, f"{name}'s Meta is missing a component_name"
        del meta.component_name

        # call the model serializer superclass
        return super().__new__(cls, name, bases, attrs)


class TrackSectionSerializer(ModelSerializer):
    identifiers = IdentifierComponentSerializer(many=True, omit_entity_id=True, read_only=True)
    track_section = TrackSectionComponentSerializer(omit_entity_id=True, read_only=True)

    class Meta:
        model = TrackSectionEntity
        fields = ["entity_id", "identifiers", "track_section"]


class SwitchSerializer(ModelSerializer):
    identifiers = IdentifierComponentSerializer(many=True, omit_entity_id=True, read_only=True)
    track_section_link = TrackSectionLinkComponentSerializer(omit_entity_id=True, many=True, read_only=True)

    class Meta:
        model = SwitchEntity
        fields = ["entity_id", "identifiers", "track_section_link"]


class OperationalPointSerializer(ModelSerializer):
    identifiers = IdentifierComponentSerializer(many=True, omit_entity_id=True, read_only=True)
    track_section_link = TrackSectionLinkComponentSerializer(omit_entity_id=True, many=True, read_only=True)

    class Meta:
        model = OperationalPointEntity
        fields = "__all__"


class SignalSerializer(ModelSerializer):
    identifiers = IdentifierComponentSerializer(many=True, omit_entity_id=True, read_only=True)
    location = TrackSectionLocationComponentSerializer(omit_entity_id=True)

    class Meta:
        model = SignalEntity
        fields = "__all__"
