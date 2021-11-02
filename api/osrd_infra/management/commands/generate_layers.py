from django.core.management.base import BaseCommand, CommandError
from osrd_infra.layers import generate_layers
from osrd_infra.models import Infra


def get_infras(infra_ids):
    if not infra_ids:
        return list(Infra.objects.all())

    try:
        infras = []
        for infra_id in infra_ids:
            infras.append(Infra.objects.get(pk=infra_id))
        return infras
    except Infra.DoesNotExist:
        raise CommandError('Infra "%s" does not exist' % infra_id)


class Command(BaseCommand):
    help = "Generates map layers"

    def add_arguments(self, parser):
        parser.add_argument('infra_ids', type=int, nargs="+")

    def handle(self, *args, **options):
        infras = get_infras(options["infra_ids"])
        for infra in infras:
            try:
                generate_layers(infra)
            except Exception as e:
                raise CommandError(
                    f"Error while generating layers for infra `{infra.name}' (#{infra.pk})"
                ) from e
