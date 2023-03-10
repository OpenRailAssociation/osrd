import sys
from io import BytesIO

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import HttpResponse
from PIL import Image
from rest_framework import mixins, serializers
from rest_framework.generics import get_object_or_404
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import RollingStock, RollingStockLivery
from osrd_infra.serializers import (
    CreateRollingStockLiverySerializer,
    LightRollingStockSerializer,
    RollingStockSerializer,
)
from osrd_infra.views.pagination import CustomPageNumberPagination


class RollingStockView(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = RollingStockSerializer
    pagination_class = CustomPageNumberPagination


class LightRollingStockView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = LightRollingStockSerializer
    pagination_class = CustomPageNumberPagination


class RollingStockLiveryView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    def retrieve(self, request, pk=None, rolling_stock_pk=None):
        queryset = RollingStockLivery.objects.all()
        livery = get_object_or_404(queryset, pk=pk)
        image_db = livery.compound_image.image

        if str(livery.rolling_stock.id) != rolling_stock_pk:
            raise ValueError(f"Livery {pk} does not belong to rolling stock {rolling_stock_pk}")

        stream = BytesIO(image_db)
        image = Image.open(stream)

        response = HttpResponse(content_type="image/png")
        image.save(response, "PNG")
        return response

    def validate_create_request(self, rolling_stock_id, livery_name):
        rolling_stock_queryset = RollingStock.objects.all()
        get_object_or_404(rolling_stock_queryset, id=rolling_stock_id)
        try:
            otherLivery = RollingStockLivery.objects.get(rolling_stock_id=rolling_stock_id, name=livery_name)
        except RollingStockLivery.DoesNotExist:
            return
        raise serializers.ValidationError(
            f"Livery with name '{livery_name}' already exist with id {otherLivery.id} for the rolling stock "
            f"with id {rolling_stock_id}."
        )

    def create_compound_image(self, images):
        separated_images = []
        max_height, total_length = 0, 0

        for i in range(len(images)):
            image = Image.open(images[i])
            max_height = max(max_height, image.size[1])
            total_length += image.size[0]
            separated_images.append(image)

        compound_image = Image.new("RGBA", (total_length, max_height), (255, 0, 0, 0))
        ind_width = 0
        for image in separated_images:
            compound_image.paste(image, (ind_width, max_height - image.size[1]))
            ind_width += image.size[0]
        compound_image_bytes = BytesIO()
        compound_image.save(compound_image_bytes, "PNG")
        return InMemoryUploadedFile(
            compound_image_bytes, None, "compound_image.png", "PNG", sys.getsizeof(compound_image_bytes), None
        )

    def create(self, request, *args, **kwargs):
        """
        Create a new livery, as well as its compound_image and separated_images
        """
        rolling_stock_id = kwargs["rolling_stock_pk"]
        livery_name = request.data["name"]
        self.validate_create_request(rolling_stock_id, livery_name)
        images = sorted(request.data.getlist("images"), key=lambda x: x.name)
        compound_image = self.create_compound_image(images)

        input_data = dict(
            rolling_stock_id=rolling_stock_id, livery_name=livery_name, images=images, compound_image=compound_image
        )

        input_serializer = CreateRollingStockLiverySerializer(data=input_data)
        input_serializer.is_valid(raise_exception=True)
        input_serializer.create(input_serializer.validated_data)

        image_final = Image.open(compound_image)
        response = HttpResponse(content_type="image/png")
        image_final.save(response, "PNG")
        return response
