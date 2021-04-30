from rest_framework.viewsets import ReadOnlyModelViewSet

from osrd_infra.models import Infra

from osrd_infra.serializers import InfraSerializer, ALL_ENTITY_SERIALIZERS


class InfraViewSet(ReadOnlyModelViewSet):
    serializer_class = InfraSerializer
    queryset = Infra.objects.all()


ALL_ENTITY_VIEWSETS = []


for entity_serializer in ALL_ENTITY_SERIALIZERS:
    model = entity_serializer.Meta.model

    def make_get_queryset(model):
        """
        the model local variable needs to be captured:
        the one in the loop changes
        """

        def _get_queryset(self):
            return model.objects.all()

        return _get_queryset

    viewset_attrs = {
        "serializer_class": entity_serializer,
        "get_queryset": make_get_queryset(model),
    }
    viewset_name = model.__name__ + "ViewSet"
    entity_viewset = type(
        viewset_name,
        (ReadOnlyModelViewSet,),
        viewset_attrs,
    )
    globals()[viewset_name] = entity_viewset
    ALL_ENTITY_VIEWSETS.append((model, entity_viewset))
