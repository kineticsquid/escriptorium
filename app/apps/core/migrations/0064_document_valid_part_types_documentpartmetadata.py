# Generated by Django 4.0.5 on 2022-07-26 11:03

import django.db.models.deletion
from django.db import migrations, models


def forward(apps, se):
    DocumentPartType = apps.get_model('core', 'DocumentPartType')
    for type_ in ['Cover', 'Page']:
        DocumentPartType.objects.get_or_create(
            DocumentPartType(name=type_, default=True, public=True)
        )


def backward(apps, se):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0063_linetranscription_avg_confidence'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='valid_part_types',
            field=models.ManyToManyField(blank=True, related_name='valid_in', to='core.documentparttype'),
        ),

        migrations.AddField(
            model_name='documentpart',
            name='comments',
            field=models.TextField(blank=True, null=True),
        ),

        migrations.CreateModel(
            name='DocumentPartMetadata',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.CharField(max_length=512)),
                ('key', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.metadata')),
                ('part', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='metadata', to='core.documentpart')),
            ],
        ),
        migrations.RunPython(forward, backward),
    ]
