from rest_framework.routers import SimpleRouter

from .views import InfraViewSet, TrackSectionViewSet, SignalViewSet


router = SimpleRouter()
router.register('infra', InfraViewSet, basename='infra')
router.register('track_section', TrackSectionViewSet, basename='track_section')
router.register('signal', SignalViewSet, basename='signal')


urlpatterns = [
] + router.urls


# lister les objets dans une infra
# faire les CRUD par objet
