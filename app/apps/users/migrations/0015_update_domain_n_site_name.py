from django.db import migrations
import os

def change_mydomain_name(apps, schema_editor):
    DOMAIN_NAME = os.getenv('DOMAIN', 'localhost')
    SITE_NAME = os.getenv('SITE_NAME', 'escriptorium')
    Sites = apps.get_model('sites', 'Site')
    try:
        site = Sites.objects.filter(id=1).first()
    except Sites.DoesNotExist:
        pass 
    else:
        site.name = SITE_NAME
        site.domain = DOMAIN_NAME
        site.save()

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0014_auto_20210324_1007'),
    ]

    operations = [
        migrations.RunPython(change_mydomain_name),
    ]