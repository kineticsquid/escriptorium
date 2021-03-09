from django.urls import path
from django.views.generic import TemplateView

from core.views import (Home,
                        DocumentsList,
                        DocumentDetail,
                        CreateDocument,
                        UpdateDocument,
                        EditPart,
                        DocumentImages,
                        ModelsList,
                        ModelDelete,
                        ModelCancelTraining,
                        PublishDocument,
                        ShareDocument,
                        DocumentPartsProcessAjax)

urlpatterns = [
    path('', Home.as_view(), name='home'),
    path('documents/', DocumentsList.as_view(), name='documents-list'),
    path('documents/<str:chain>/filter/', DocumentsList.as_view(), name='documents-list-filter'),
    path('document/<int:pk>/', DocumentDetail.as_view(), name='document-detail'),
    path('document/create/', CreateDocument.as_view(), name='document-create'),
    path('document/<int:pk>/edit/', UpdateDocument.as_view(), name='document-update'),
    path('document/<int:pk>/parts/edit/', EditPart.as_view(), name='document-part-edit'),
    path('document/<int:pk>/part/<int:part_pk>/edit/', EditPart.as_view(),
         name='document-part-edit'),
    path('document/<int:pk>/images/', DocumentImages.as_view(), name='document-images'),
    path('models/', ModelsList.as_view(), name='user-models'),
    path('model/<int:pk>/delete/', ModelDelete.as_view(), name='model-delete'),
    path('model/<int:pk>/cancel_training/', ModelCancelTraining.as_view(),
         name='model-cancel-training'),
    path('document/<int:document_pk>/models/', ModelsList.as_view(), name='document-models'),
    path('document/<int:pk>/publish/', PublishDocument.as_view(), name='document-publish'),
    path('document/<int:pk>/share/', ShareDocument.as_view(), name='document-share'),
    path('document/<int:pk>/process/', DocumentPartsProcessAjax.as_view(),
         name='document-parts-process'),

    path('test/', TemplateView.as_view(template_name='core/test.html')),
]
