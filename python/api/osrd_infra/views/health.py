from django.http import HttpResponse


async def health(request):
    return HttpResponse("")
