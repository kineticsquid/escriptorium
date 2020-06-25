# Generated by Django 2.1.4 on 2020-06-15 09:06

from django.db import migrations


def forward(apps, se):
    # link existing Documents with default typology
    BlockType = apps.get_model('core', 'BlockType')
    LineType = apps.get_model('core', 'LineType')

    to_create = []
    regions_types = ['Title', 'Main', 'Commentary', 'Illustration']
    for type_ in regions_types:
        to_create.append(BlockType(name=type_,
                                   default=True, public=True))
    BlockType.objects.bulk_create(to_create)

    to_create = []
    lines_types = ['Main', 'Numbering', 'Correction', 'Signature']
    for type_ in lines_types:
        to_create.append(LineType(name=type_,
                                  default=False, public=True))
    LineType.objects.bulk_create(to_create)


def backward(apps, se):
    BlockType = apps.get_model('core', 'BlockType')
    LineType = apps.get_model('core', 'LineType')
    BlockType.objects.filter(public=True).delete()
    LineType.objects.filter(public=True).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0038_auto_20200616_0929'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]