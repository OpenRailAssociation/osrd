from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import Timetable
from osrd_infra.serializers import TimetableSerializer
from osrd_infra.views.pagination import CustomPageNumberPagination


class TimetableView(
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = TimetableSerializer
    pagination_class = CustomPageNumberPagination
    queryset = Timetable.objects.order_by("-pk")

    def retrieve(self, request, pk):
        timetable = self.get_object()
        serializer = TimetableSerializer(timetable)
        train_schedules = [
            {
                "id": train.pk,
                "train_name": train.train_name,
                "departure_time": train.departure_time,
                "train_path": train.path_id,
            }
            for train in timetable.train_schedules.all()
        ]
        return Response({**serializer.data, "train_schedules": train_schedules})
