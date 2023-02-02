from io import BytesIO

from django.db.models import Q
from django.http import HttpResponse
from PIL import Image
from rest_framework import filters, generics, mixins, status
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import Project, Scenario, Study, Timetable
from osrd_infra.schemas.study import StudyState, StudyType
from osrd_infra.serializers import (
    ProjectSerializer,
    ScenarioSerializer,
    StudySerializer,
)
from osrd_infra.views.pagination import CustomPageNumberPagination


class ScenarioView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_class = ScenarioSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["name", "creation_date", "last_modification"]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        """this function will disappear to be replaced by the generic search"""
        project = get_object_or_404(Project.objects.all(), pk=self.kwargs["project_pk"])
        study = get_object_or_404(Study.objects.all(), pk=self.kwargs["study_pk"], project=project)
        queryset = Scenario.objects.filter(study__project=project, study=study)
        name = self.request.query_params.get("name", None)
        description = self.request.query_params.get("description", None)
        tags = self.request.query_params.get("tags", None)
        filters = Q()
        if name:
            filters = filters | Q(name__icontains=name)
        if description:
            filters = filters | Q(description__icontains=description)
        if tags:
            filters = filters | Q(tags__icontains=tags)
        return queryset.filter(filters)

    def create(self, request, *args, **kwargs):
        project = get_object_or_404(Project.objects.all(), pk=self.kwargs["project_pk"])
        study = get_object_or_404(Study.objects.all(), pk=self.kwargs["study_pk"], project=project)
        scenario_name = request.data["name"]
        infra_id = request.data.pop("infra")
        timetable_name = f"timetable for {scenario_name}"
        timetable = Timetable.objects.create(name=timetable_name)
        scenario = Scenario.objects.create(timetable=timetable, study_id=study.id, infra_id=infra_id, **request.data)
        serializer = ScenarioSerializer(scenario, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk, project_pk=None, study_pk=None):
        scenario = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ScenarioSerializer(scenario, context={"request": request})

        train_schedules = [
            {
                "id": train.pk,
                "train_name": train.train_name,
                "departure_time": train.departure_time,
                "train_path": train.path_id,
            }
            for train in scenario.timetable.train_schedules.all()
        ]

        return Response({**serializer.data, "infra_name": scenario.infra.name, "train_schedules": train_schedules})

    def partial_update(self, request, pk=None, project_pk=None, study_pk=None):
        scenario = get_object_or_404(self.get_queryset(), pk=pk)
        scenario.study.save()  # update last_modification field of the study
        scenario.study.project.save()  # update last_modification field of the project
        serializer = ScenarioSerializer(scenario, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(data=serializer.data, status=status.HTTP_202_ACCEPTED)


class StudyView(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_class = StudySerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["name", "creation_date", "last_modification"]
    search_fields = ("name", "description", "tags")
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        """this function will disappear to be replaced by the generic search"""
        project = get_object_or_404(Project.objects.all(), pk=self.kwargs["project_pk"])
        queryset = Study.objects.filter(project=project)
        name = self.request.query_params.get("name", None)
        description = self.request.query_params.get("description", None)
        tags = self.request.query_params.get("tags", None)
        filters = Q()
        if name:
            filters = filters | Q(name__icontains=name)
        if description:
            filters = filters | Q(description__icontains=description)
        if tags:
            filters = filters | Q(tags__icontains=tags)
        return queryset.filter(filters)

    def create(self, request, *args, **kwargs):
        project = get_object_or_404(Project.objects.all(), pk=self.kwargs["project_pk"])
        study = Study.objects.create(project_id=project.id, **request.data)
        serializer = StudySerializer(study, context={"request": request})
        return Response(serializer.data)

    def partial_update(self, request, pk=None, project_pk=None):
        op_study = get_object_or_404(self.get_queryset(), pk=pk)
        op_study.project.save()  # update last_modification field of the project
        serializer = StudySerializer(op_study, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(data=serializer.data, status=status.HTTP_202_ACCEPTED)


class ProjectView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.UpdateModelMixin,
    generics.ListAPIView,
    GenericViewSet,
):
    serializer_class = ProjectSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["name", "creation_date", "last_modification"]
    search_fields = ("name", "description", "tags")
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        """this function will disappear to be replaced by the generic search"""
        queryset = Project.objects.order_by("-pk")
        name = self.request.query_params.get("name", None)
        description = self.request.query_params.get("description", None)
        tags = self.request.query_params.get("tags", None)
        filters = Q()
        if name:
            filters = filters | Q(name__icontains=name)
        if description:
            filters = filters | Q(description__icontains=description)
        if tags:
            filters = filters | Q(tags__icontains=tags)
        return queryset.filter(filters)

    @action(url_path="image", detail=True, methods=["get"])
    def get_image(self, request, pk=None):

        queryset = Project.objects.all()
        project = get_object_or_404(queryset, pk=pk)
        image_db = project.image
        if image_db:
            stream = BytesIO(image_db)
            image = Image.open(stream)
            response = HttpResponse(content_type="image/png")
            image.save(response, "PNG")
            return response
        return Response({"image": "null"})

    @action(url_path="study_types", detail=True, methods=["get"])
    def get_types(self, request, pk=None):
        return Response([x.value for x in StudyType])

    @action(url_path="study_states", detail=True, methods=["get"])
    def get_states(self, request, pk=None):
        return Response([x.value for x in StudyState])

    def create(self, request, pk=None):
        input_serializer = ProjectSerializer(data=request.data, context={"request": request})
        input_serializer.is_valid(raise_exception=True)
        if "image" in input_serializer.validated_data.keys():
            image = input_serializer.validated_data["image"]
            input_serializer.validated_data["image"] = image.read()
        input_serializer.save()
        return Response(data=input_serializer.data, status=201)

    def partial_update(self, request, pk=None, project_pk=None):
        project = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ProjectSerializer(project, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if "image" in serializer.validated_data.keys():
            image = serializer.validated_data["image"]
            serializer.validated_data["image"] = image.read()
            print(image)
        serializer.save()
        project.save()
        return Response(data=serializer.data, status=202)
