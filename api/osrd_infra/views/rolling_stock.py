import sys
from io import BytesIO
from PIL import Image
from django.http import HttpResponse
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework import mixins, serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.viewsets import GenericViewSet, ViewSet

from osrd_infra.models import RollingStock, RollingStockLivery
from osrd_infra.serializers import (
    LightRollingStockSerializer, RollingStockSerializer, CreateRollingStockLiverySerializer
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

    @action(url_path="livery", detail=True, methods=["get"])
    def get_livery(self, request, pk=None):
        if "livery_id" not in request.query_params:
            raise ParseError("missing livery's id")
        livery_id = request.query_params["livery_id"]

        queryset = RollingStockLivery.objects.all()
        livery = get_object_or_404(queryset, id=livery_id)
        image_db = livery.compound_image.image

        if str(livery.rolling_stock.id) != pk:
            raise ValueError(f"Livery {livery_id} does not belong to rolling stock {pk}")

        stream = BytesIO(image_db)
        image = Image.open(stream)

        response = HttpResponse(content_type='image/png')
        image.save(response, "PNG")
        return response


class LightRollingStockView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = LightRollingStockSerializer
    pagination_class = CustomPageNumberPagination


class RollingStockLiveryView(ViewSet):
    def validate_create_request(self, data):
        rolling_stock_id = data["rolling_stock_id"]
        livery_name = data["name"]
        try:
            otherLivery = RollingStockLivery.objects.get(rolling_stock_id=rolling_stock_id, name=livery_name)
        except RollingStockLivery.DoesNotExist:
            return data
        raise serializers.ValidationError(
            f"an other livery (id {otherLivery.id}) with same name and rolling stock already exists"
        )

    def create_compound_image(self, images):
        """
        Create compound_image from separated images. Return an InMemoryUploadedFile.
        """
        separated_images = []
        max_height, total_length = 0, 0

        for i in range(len(images)):
            image = Image.open(images[i])
            max_height = max(max_height, image.size[1])
            total_length += image.size[0]
            separated_images.append(image)

        compound_image = Image.new('RGBA', (total_length, max_height), (255, 0, 0, 0))
        ind_width = 0
        for image in separated_images:
            compound_image.paste(image, (ind_width, max_height - image.size[1]))
            ind_width += image.size[0]
        compound_image_bytes = BytesIO()
        compound_image.save(compound_image_bytes, 'PNG')
        return InMemoryUploadedFile(
            compound_image_bytes, None, 'compound_image.png', 'PNG',
            sys.getsizeof(compound_image_bytes), None)


    def create(self, request, *args, **kwargs):
        """
        Create a new livery, as well as its compound_image and separated_images
        """
        data = self.validate_create_request(request.data)
        images = sorted(data.getlist("images"), key=lambda x: x.name)
        compound_image = self.create_compound_image(images)
        
        input_data = dict(
            rolling_stock_id=data["rolling_stock_id"],
            livery_name=data["name"],
            images=images,
            compound_image=compound_image
        )

        input_serializer = CreateRollingStockLiverySerializer(data=input_data)
        input_serializer.is_valid(raise_exception=True)
        input_serializer.create(input_serializer.validated_data)

        image_final = Image.open(compound_image)
        response = HttpResponse(content_type='image/png')
        image_final.save(response, "PNG")
        return response
