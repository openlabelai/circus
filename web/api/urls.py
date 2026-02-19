from django.urls import path, include
from rest_framework.routers import DefaultRouter

from api import views

router = DefaultRouter()
router.register(r'artist-profiles', views.ArtistProfileViewSet)
router.register(r'projects', views.ProjectViewSet, basename='project')
router.register(r'personas', views.PersonaViewSet)
router.register(r'tasks', views.TaskViewSet)
router.register(r'results', views.TaskResultViewSet, basename='taskresult')
router.register(r'schedules', views.ScheduledTaskViewSet)
router.register(r'queue', views.QueuedRunViewSet, basename='queuedrun')
router.register(r'agents', views.AgentViewSet, basename='agent')
router.register(r'llm-config', views.LLMConfigViewSet)

urlpatterns = [
    path('llm-config/providers/', views.llm_providers),
    path('provider-keys/', views.provider_keys),
    path('provider-keys/<str:provider>/', views.provider_key_delete),
    path('', include(router.urls)),
    path('devices/', views.device_list),
    path('devices/refresh/', views.device_refresh),
    path('devices/<str:serial>/', views.device_detail),
    path('devices/<str:serial>/screen/', views.device_screen),
    path('devices/<str:serial>/screen/stream/', views.device_screen_stream),
    path('status/', views.status_overview),
    path('warming/activate/', views.warming_activate),
    path('warming/deactivate/', views.warming_deactivate),
    path('warming/status/', views.warming_status),
]
