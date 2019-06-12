# Generated by Django 2.1.4 on 2019-05-02 08:23

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_auto_20190429_1033'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='read_direction',
            field=models.CharField(choices=[('ltr', 'Left to right'), ('rtl', 'Right to left')], default='ltr', help_text='{insert help text here}', max_length=3),
        ),
    ]