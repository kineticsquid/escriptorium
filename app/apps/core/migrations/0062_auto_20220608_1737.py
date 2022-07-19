# Generated by Django 3.1.14 on 2022-06-08 17:37

from django.db import migrations, models

import core.models
import core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0061_auto_20220419_1414'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='document',
            options={'ordering': ['-updated_at']},
        ),
        migrations.AlterModelOptions(
            name='metadata',
            options={'ordering': ['name']},
        ),
        migrations.AlterModelOptions(
            name='ocrmodel',
            options={'ordering': ['-version_updated_at'], 'permissions': (('can_train', 'Can train models'),)},
        ),
        migrations.AlterModelOptions(
            name='project',
            options={'ordering': ['-updated_at']},
        ),
        migrations.AlterModelOptions(
            name='script',
            options={'ordering': ['name']},
        ),
        migrations.AlterModelOptions(
            name='transcription',
            options={'ordering': ['-updated_at']},
        ),
        migrations.AlterField(
            model_name='block',
            name='box',
            field=models.JSONField(validators=[core.models.validate_polygon, core.models.validate_3_points]),
        ),
        migrations.AlterField(
            model_name='line',
            name='baseline',
            field=models.JSONField(blank=True, null=True, validators=[core.models.validate_polygon, core.models.validate_2_points]),
        ),
        migrations.AlterField(
            model_name='line',
            name='mask',
            field=models.JSONField(blank=True, null=True, validators=[core.models.validate_polygon, core.models.validate_3_points]),
        ),
        migrations.AlterField(
            model_name='linetranscription',
            name='graphs',
            field=models.JSONField(blank=True, null=True, validators=[core.validators.JSONSchemaValidator(limit_value={'items': {'properties': {'c': {'maxLength': 1, 'minLength': 1, 'type': 'string'}, 'confidence': {'maximum': 1, 'minimum': 0, 'type': 'number'}, 'poly': {'items': {'contains': {'type': 'number'}, 'maxItems': 2, 'minItems': 2, 'type': 'array'}, 'minItems': 3, 'type': 'array'}}, 'type': 'object'}, 'type': 'array'})]),
        ),
        migrations.AlterField(
            model_name='linetranscription',
            name='versions',
            field=models.JSONField(default=list, editable=False),
        ),
        migrations.AlterField(
            model_name='ocrmodel',
            name='versions',
            field=models.JSONField(default=list, editable=False),
        ),
    ]