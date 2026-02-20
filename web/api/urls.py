from django.urls import path, include
from rest_framework.routers import DefaultRouter

from api import views

router = DefaultRouter()
router.register(r'artist-profiles', views.ArtistProfileViewSet)
router.register(r'campaigns', views.CampaignViewSet, basename='campaign')
router.register(r'personas', views.PersonaViewSet)
router.register(r'tasks', views.TaskViewSet)
router.register(r'results', views.TaskResultViewSet, basename='taskresult')
router.register(r'schedules', views.ScheduledTaskViewSet)
router.register(r'queue', views.QueuedRunViewSet, basename='queuedrun')
router.register(r'agents', views.AgentViewSet, basename='agent')
router.register(r'accounts', views.AccountViewSet, basename='account')
router.register(r'devices', views.DeviceViewSet, basename='device')
router.register(r'proxies', views.ProxyViewSet, basename='proxy')
router.register(r'llm-config', views.LLMConfigViewSet)

urlpatterns = [
    path('llm-config/providers/', views.llm_providers),
    path('provider-keys/', views.provider_keys),
    path('provider-keys/<str:provider>/', views.provider_key_delete),
    path('', include(router.urls)),
    path('status/', views.status_overview),
    path('warming/activate/', views.warming_activate),
    path('warming/deactivate/', views.warming_deactivate),
    path('warming/status/', views.warming_status),
]
