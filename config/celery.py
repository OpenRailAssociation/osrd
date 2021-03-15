from celery import Celery
from django.conf import settings

app = Celery('osrd',
             broker=settings.BROKER_URL,
             backend=settings.BACKEND_URL,
             include=['osrd.tasks'])

app.conf.broker_use_ssl = {'ssl_cert_reqs': 'none'}
app.conf.redis_backend_use_ssl = {'ssl_cert_reqs': 'none'}

app.conf.update(
    result_expires=3600
)

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

if __name__ == '__main__':
    print('starting celery worker')
    app.start()
