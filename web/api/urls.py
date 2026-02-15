from django.urls import path, include
from rest_framework.routers import DefaultRouter

from api import views

router = DefaultRouter()
router.register(r'personas', views.PersonaViewSet)
router.register(r'tasks', views.TaskViewSet)
router.register(r'results', views.TaskResultViewSet, basename='taskresult')

urlpatterns = [
    path('', include(router.urls)),
    path('devices/', views.device_list),
    path('devices/refresh/', views.device_refresh),
    path('devices/<str:serial>/', views.device_detail),
    path('status/', views.status_overview),
]
