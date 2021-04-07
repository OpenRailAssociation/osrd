from rest_framework.routers import SimpleRouter

from infra.views import InfraViewSet


router = SimpleRouter()
router.register('', InfraViewSet, basename='infra')


urlpatterns = [
] + router.urls