from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.models import *
from api.serializers import *


class DocumentViewSet(ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    paginate_by = 10


class PartViewSet(ModelViewSet):
    queryset = Document.objects.all()
    paginate_by = 10
    
    def get_queryset(self):
        return DocumentPart.objects.filter(document=self.kwargs['document_pk'])
    
    def get_serializer_class(self):
        # different serializer because we don't want to query all the lines in the list view
        if self.action == 'retrieve':
            return PartDetailSerializer
        else:  # list & create
            return PartSerializer
        return super(MyModelViewSet, self).get_serializer_class()
    
    @action(detail=True, methods=['post'])
    def move(self, request, document_pk=None, pk=None):
        part = DocumentPart.objects.get(document=document_pk, pk=pk)
        serializer = PartMoveSerializer(part=part, data=request.data)
        if serializer.is_valid():
            serializer.move()
            return Response({'status': 'deleted'})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BlockViewSet(ModelViewSet):
    queryset = Block.objects.all()
    serializer_class = BlockSerializer

    def get_queryset(self):
        return Block.objects.filter(document_part=self.kwargs['part_pk'])


class LineViewSet(ModelViewSet):
    queryset = Line.objects.all()
    serializer_class = LineSerializer
    
    def get_queryset(self):
        return Line.objects.filter(document_part=self.kwargs['part_pk'])
